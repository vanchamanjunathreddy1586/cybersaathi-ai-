import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  AudioLines,
  Check,
  LoaderCircle,
  MessageCircle,
  Phone,
  PhoneOff,
  ShieldCheck,
  Video,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { connectNexconn, clearNexconnCallListener, endNexconnCall, mountNexconnChat, openNexconnDirectChannel, answerNexconnCall, startNexconnCall, type NexconnCallNotice } from './nexconnClient'
import { NexconnApiError, requestNexconnSession, type NexconnSession } from './nexconnApi'
import './community.css'

function getErrorMessage(error: unknown): string {
  return error instanceof NexconnApiError || error instanceof Error
    ? error.message
    : 'The Nexconn service could not be reached.'
}

function callStatusText(notice: NexconnCallNotice): string {
  switch (notice.kind) {
    case 'incoming':
      return `Incoming ${notice.video ? 'video' : 'audio'} call from ${notice.userId}`
    case 'calling':
      return `Calling ${notice.userId}…`
    case 'connecting':
      return `Connecting to ${notice.userId}…`
    case 'connected':
      return `Connected to ${notice.userId}`
    case 'ended':
      return 'Call ended'
  }
}

export function CommunityPage() {
  const { session, profile } = useAuth()
  const [nexconnSession, setNexconnSession] = useState<NexconnSession | null>(null)
  const [connecting, setConnecting] = useState(true)
  const [error, setError] = useState('')
  const [targetId, setTargetId] = useState('')
  const [openingChannel, setOpeningChannel] = useState(false)
  const [callNotice, setCallNotice] = useState<NexconnCallNotice | null>(null)
  const [callBusy, setCallBusy] = useState(false)
  const [callError, setCallError] = useState('')
  const hostRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const accessToken = session?.access_token
  const displayName = profile?.full_name || session?.user.user_metadata.full_name || 'CyberSaathi member'

  useEffect(() => {
    if (!accessToken) return
    let active = true
    let unmountChat: (() => void) | null = null
    void requestNexconnSession(accessToken)
      .then(async (configuration) => {
        if (!active) return
        setConnecting(true)
        setError('')
        await connectNexconn(configuration, displayName, (notice) => {
          if (active) setCallNotice(notice)
        })
        if (!active || !hostRef.current) return
        setNexconnSession(configuration)
        unmountChat = mountNexconnChat(hostRef.current)
      })
      .catch((connectionError: unknown) => {
        if (active) setError(getErrorMessage(connectionError))
      })
      .finally(() => {
        if (active) setConnecting(false)
      })
    return () => {
      active = false
      unmountChat?.()
      clearNexconnCallListener()
    }
  }, [accessToken, displayName])

  const openDirectChannel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOpeningChannel(true)
    setError('')
    try {
      const cleanId = targetId.trim()
      if (!/^[a-zA-Z0-9]{1,64}$/.test(cleanId)) {
        throw new Error('Enter a Nexconn user ID containing 1–64 letters or numbers.')
      }
      if (cleanId === nexconnSession?.userId) {
        throw new Error('You cannot open a direct chat with your own Nexconn ID.')
      }
      await openNexconnDirectChannel(cleanId)
      setTargetId(cleanId)
    } catch (openError) {
      setError(getErrorMessage(openError))
    } finally {
      setOpeningChannel(false)
    }
  }

  const placeCall = async (video: boolean) => {
    const remoteId = targetId.trim()
    setCallBusy(true)
    setCallError('')
    try {
      await startNexconnCall(
        remoteId,
        video,
        localVideoRef.current,
        remoteVideoRef.current,
      )
    } catch (startError) {
      setCallError(getErrorMessage(startError))
    } finally {
      setCallBusy(false)
    }
  }

  const answerCall = async () => {
    if (callNotice?.kind !== 'incoming') return
    setCallBusy(true)
    setCallError('')
    try {
      await answerNexconnCall(
        callNotice.callId,
        callNotice.userId,
        callNotice.video,
        localVideoRef.current,
        remoteVideoRef.current,
      )
    } catch (answerError) {
      setCallError(getErrorMessage(answerError))
    } finally {
      setCallBusy(false)
    }
  }

  const endCall = async () => {
    if (!callNotice?.callId) return
    setCallBusy(true)
    setCallError('')
    try {
      await endNexconnCall(callNotice.callId)
    } catch (endError) {
      setCallError(getErrorMessage(endError))
    } finally {
      setCallBusy(false)
    }
  }

  const displayCall = callNotice && callNotice.kind !== 'ended'
  const videoCall = Boolean(displayCall && callNotice?.video)

  return (
    <div className="community-page">
      <header className="community-heading">
        <div>
          <p className="eyebrow">CYBERSAATHI AI / SECURE COMMUNITY</p>
          <h1>Community chat</h1>
          <p>Message and call through Nexconn. Your account is linked using a server-issued Nexconn identity.</p>
        </div>
        {nexconnSession && (
          <div className="community-identity">
            <span className="community-identity-icon"><ShieldCheck size={16} /></span>
            <span><small>Your Nexconn ID</small><strong>{nexconnSession.userId}</strong></span>
          </div>
        )}
      </header>

      {connecting && (
        <div className="community-state" role="status">
          <LoaderCircle className="community-spinner" size={17} /> Connecting to Nexconn…
        </div>
      )}
      {error && !connecting && (
        <div className="community-error" role="alert">
          <AlertCircle size={16} />
          <div><strong>Community service unavailable</strong><span>{error}</span></div>
        </div>
      )}

      {nexconnSession && (
        <>
          <section className="community-connection panel">
            <form className="community-direct-form" onSubmit={(event) => void openDirectChannel(event)}>
              <label htmlFor="community-user-id">Open a direct chat</label>
              <div className="community-direct-controls">
                <input
                  autoComplete="off"
                  id="community-user-id"
                  maxLength={64}
                  onChange={(event) => setTargetId(event.target.value)}
                  placeholder="Enter a Nexconn user ID"
                  value={targetId}
                />
                <button className="button button-primary" disabled={openingChannel || !targetId.trim()} type="submit">
                  {openingChannel ? <LoaderCircle className="community-spinner" size={15} /> : <MessageCircle size={15} />}
                  Open chat
                </button>
              </div>
              <p>Only open a chat with someone you know. Nexconn user IDs are not searched or enumerated.</p>
            </form>

            <div className="community-call-controls">
              <div>
                <strong>Voice and video calls</strong>
                <span>Calls require the Nexconn calling service and browser media permissions.</span>
              </div>
              {nexconnSession.callsEnabled ? (
                <div className="community-call-buttons">
                  <button className="button button-secondary" disabled={callBusy || !targetId.trim()} onClick={() => void placeCall(false)} type="button">
                    <Phone size={15} /> Audio call
                  </button>
                  <button className="button button-secondary" disabled={callBusy || !targetId.trim()} onClick={() => void placeCall(true)} type="button">
                    <Video size={15} /> Video call
                  </button>
                </div>
              ) : (
                <span className="community-call-unavailable">Calling is not enabled for this Nexconn app.</span>
              )}
            </div>
          </section>

          <section className="community-call-panel panel" aria-live="polite" hidden={!callNotice}>
              {callNotice && (
                <div className="community-call-status">
                  <span className={`community-call-indicator${callNotice.kind === 'connected' ? ' community-call-indicator-live' : ''}`} />
                  <strong>{callStatusText(callNotice)}</strong>
                </div>
              )}
              <div className={`community-video-grid${videoCall ? '' : ' community-video-grid-hidden'}`}>
                <video autoPlay className="community-video" muted playsInline ref={localVideoRef} aria-label="Your camera preview" />
                <video autoPlay className="community-video" playsInline ref={remoteVideoRef} aria-label="Remote participant video" />
              </div>
              {callNotice?.kind === 'incoming' ? (
                <div className="community-call-buttons">
                  <button className="button button-primary" disabled={callBusy} onClick={() => void answerCall()} type="button">
                    {callBusy ? <LoaderCircle className="community-spinner" size={15} /> : <Check size={15} />}
                    Answer
                  </button>
                  <button className="button button-danger" disabled={callBusy} onClick={() => void endCall()} type="button">
                    <PhoneOff size={15} /> Decline
                  </button>
                </div>
              ) : callNotice && callNotice.kind !== 'ended' ? (
                <button className="button button-danger" disabled={callBusy} onClick={() => void endCall()} type="button">
                  <PhoneOff size={15} /> End call
                </button>
              ) : callNotice?.kind === 'ended' ? (
                <button className="button button-secondary" onClick={() => setCallNotice(null)} type="button">
                  Close
                </button>
              ) : null}
              {callError && <p className="community-inline-error" role="alert">{callError}</p>}
          </section>

          <section className="community-chat-panel panel">
            <div className="community-chat-heading">
              <div className="community-chat-title">
                <span className="community-chat-icon"><MessageCircle size={17} /></span>
                <div><h2>Messages</h2><p>Chats and channels are provided by Nexconn ChatUI.</p></div>
              </div>
              <span className="community-chat-provider"><span /> Nexconn connected</span>
            </div>
            <div className="community-chat-host" ref={hostRef} />
            <div className="community-chat-note">
              <AudioLines size={14} />
              <span>Use the ID above to exchange contact details with trusted community members. Nexconn ChatUI does not support portrait mobile layouts; rotate to landscape or use a larger screen for the chat interface.</span>
              <ArrowUpRight aria-hidden="true" size={14} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
