import { supabase } from '../auth/supabase'
import type { NexconnSession } from './nexconnApi'

export type NexconnCallNotice =
  | { kind: 'incoming'; callId: string; userId: string; video: boolean }
  | { kind: 'calling'; callId: string; userId: string; video: boolean }
  | { kind: 'connecting'; callId: string; userId: string; video: boolean }
  | { kind: 'connected'; callId: string; userId: string; video: boolean }
  | { kind: 'ended'; callId: string; userId: string; video: boolean }

type CallListener = (notice: NexconnCallNotice) => void

interface NexconnRuntime {
  userId: string
  app: import('@nexconn/chatui').NCChatUIApplication
  callEngine?: import('@nexconn/call').NCCallEngine
}

let runtime: NexconnRuntime | null = null
let setupPromise: Promise<NexconnRuntime> | null = null
let initializedAppKey: string | null = null
let connectedUserId: string | null = null
let callListener: CallListener | null = null

function emitCallNotice(notice: NexconnCallNotice) {
  callListener?.(notice)
}

async function disconnectNexconn() {
  runtime?.app.destroy()
  runtime = null
  callListener = null
  if (connectedUserId) {
    const { NCEngine } = await import('@nexconn/chat')
    await NCEngine.disconnect()
    connectedUserId = null
  }
}

supabase?.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    void disconnectNexconn().catch(() => {
      console.warn('Nexconn did not disconnect cleanly after sign-out.')
    })
  }
})

export async function connectNexconn(
  session: NexconnSession,
  displayName: string,
  listener: CallListener,
): Promise<NexconnRuntime> {
  callListener = listener
  if (runtime?.userId === session.userId) return runtime
  if (setupPromise) return setupPromise

  setupPromise = (async () => {
    if (runtime || connectedUserId) await disconnectNexconn()

    const { AreaCode, LogLevel, NCEngine } = await import('@nexconn/chat')
    const { NCChatUIApplication } = await import('@nexconn/chatui')
    const areaCode = session.region === 'us'
      ? AreaCode.NA
      : AreaCode.SG

    if (initializedAppKey && initializedAppKey !== session.appKey) {
      throw new Error('The active Nexconn app key changed. Reload the page before connecting again.')
    }

    const callSdk = session.callsEnabled ? await import('@nexconn/call') : null
    if (callSdk && !initializedAppKey) callSdk.NCCallEngine.install()

    if (!initializedAppKey) {
      NCEngine.initialize({
        appKey: session.appKey,
        areaCode,
        logLevel: LogLevel.WARN,
      })
      initializedAppKey = session.appKey
    }

    const callEngine = callSdk?.NCCallEngine.initialize({})
    callEngine?.setCallEventHandler({
      onCallReceived: ({ session: callSession }) => {
        emitCallNotice({
          kind: 'incoming',
          callId: callSession.getCallId(),
          userId: callSession.getCallerUserId(),
          video: callSession.getMediaType() === callSdk?.NCCallMediaType.AUDIO_VIDEO,
        })
      },
      onCallConnected: ({ session: callSession }) => {
        emitCallNotice({
          kind: 'connected',
          callId: callSession.getCallId(),
          userId: callSession.getRemoteParticipants()[0]?.userId ?? '',
          video: callSession.getMediaType() === callSdk?.NCCallMediaType.AUDIO_VIDEO,
        })
      },
      onCallEnded: ({ session: callSession }) => {
        emitCallNotice({
          kind: 'ended',
          callId: callSession.getCallId(),
          userId: callSession.getRemoteParticipants()[0]?.userId ?? '',
          video: callSession.getMediaType() === callSdk?.NCCallMediaType.AUDIO_VIDEO,
        })
      },
    })

    const hooks: import('@nexconn/chatui').ServiceHooks = {
      async reqUserProfiles(userIds) {
        return userIds.map((userId) => ({
          userId,
          name: userId === session.userId ? displayName : userId,
        }))
      },
      async reqGroupProfiles() {
        return []
      },
      async reqSystemProfiles() {
        return []
      },
      async reqGroupMembers() {
        return []
      },
    }
    const app = NCChatUIApplication.initialize({ hooks, language: 'en_US' })
    if (!app) throw new Error('Nexconn ChatUI could not initialize.')
    app.ready()

    const connection = await NCEngine.connect({ token: session.token })
    if (!connection.isOk) {
      app.destroy()
      throw new Error(`Nexconn connection failed (${connection.code}).`)
    }
    connectedUserId = session.userId

    const connectedRuntime: NexconnRuntime = {
      userId: session.userId,
      app,
      ...(callEngine ? { callEngine } : {}),
    }
    runtime = connectedRuntime
    return connectedRuntime
  })()

  try {
    return await setupPromise
  } finally {
    setupPromise = null
  }
}

export function mountNexconnChat(host: HTMLElement): () => void {
  if (!runtime) throw new Error('Nexconn ChatUI is not connected.')
  const provider = document.createElement('nc-chat-ui-app-provider')
  provider.style.display = 'block'
  provider.style.width = '100%'
  provider.style.height = '100%'
  host.replaceChildren(provider)
  return () => {
    provider.remove()
  }
}

export async function openNexconnDirectChannel(targetId: string): Promise<void> {
  if (!runtime) throw new Error('Nexconn ChatUI is not connected.')
  const { DirectChannelIdentifier } = await import('@nexconn/chat')
  const result = await runtime.app.openChannel(new DirectChannelIdentifier(targetId))
  if (!result.isOk) throw new Error(`Nexconn could not open the direct chat (${result.code}).`)
}

function requireCallEngine(): Promise<{
  engine: import('@nexconn/call').NCCallEngine
  types: typeof import('@nexconn/call')
}> {
  const engine = runtime?.callEngine
  if (!engine) {
    return Promise.reject(new Error('Nexconn calling is not enabled for this app.'))
  }
  return import('@nexconn/call').then((types) => ({
    engine,
    types,
  }))
}

export async function startNexconnCall(
  targetId: string,
  video: boolean,
  localVideo: HTMLVideoElement | null,
  remoteVideo: HTMLVideoElement | null,
): Promise<string> {
  if (!/^[a-zA-Z0-9]{1,64}$/.test(targetId)) {
    throw new Error('Enter a valid Nexconn user ID (letters and numbers only).')
  }
  if (runtime?.userId === targetId) throw new Error('You cannot call your own Nexconn ID.')
  const { engine, types } = await requireCallEngine()

  if (video && localVideo && remoteVideo) {
    const localResult = engine.setLocalVideoView({ videoElement: localVideo })
    const remoteResult = engine.setRemoteVideoView([{
      userId: targetId,
      videoElement: remoteVideo,
      enableLowResolutionStream: false,
    }])
    if (localResult.code !== types.NCCallCode.SUCCESS || remoteResult.code !== types.NCCallCode.SUCCESS) {
      throw new Error('The video call views could not be initialized.')
    }
  }

  const result = await engine.startCall({
    calleeIds: [targetId],
    callType: types.NCCallType.SINGLE,
    mediaType: video ? types.NCCallMediaType.AUDIO_VIDEO : types.NCCallMediaType.AUDIO,
  })
  if (result.code !== types.NCCallCode.SUCCESS || !result.callId) {
    throw new Error(`Nexconn could not start the call (${result.code}).`)
  }
  const callId = result.callId
  if (!callId) throw new Error('Nexconn started a call without returning its call ID.')
  emitCallNotice({
    kind: 'calling',
    callId,
    userId: targetId,
    video,
  })
  return callId
}

export async function answerNexconnCall(
  callId: string,
  remoteUserId: string,
  video: boolean,
  localVideo: HTMLVideoElement | null,
  remoteVideo: HTMLVideoElement | null,
): Promise<void> {
  const { engine, types } = await requireCallEngine()
  if (video && localVideo && remoteVideo) {
    const localResult = engine.setLocalVideoView({ videoElement: localVideo })
    const remoteResult = engine.setRemoteVideoView([{
      userId: remoteUserId,
      videoElement: remoteVideo,
      enableLowResolutionStream: false,
    }])
    if (localResult.code !== types.NCCallCode.SUCCESS || remoteResult.code !== types.NCCallCode.SUCCESS) {
      throw new Error('The incoming video call views could not be initialized.')
    }
  }
  emitCallNotice({ kind: 'connecting', callId, userId: remoteUserId, video })
  const result = await engine.acceptCall({ callId })
  if (result.code !== types.NCCallCode.SUCCESS) {
    throw new Error(`Nexconn could not answer the call (${result.code}).`)
  }
}

export async function endNexconnCall(callId: string): Promise<void> {
  const { engine, types } = await requireCallEngine()
  const result = await engine.endCall({ callId })
  if (result.code !== types.NCCallCode.SUCCESS) {
    throw new Error(`Nexconn could not end the call (${result.code}).`)
  }
}

export function clearNexconnCallListener() {
  callListener = null
}
