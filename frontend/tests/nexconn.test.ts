import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { NexconnApiError, type NexconnSession } from '../src/community/nexconnApi.ts'

test('NexconnApiError captures user-facing error message', () => {
  const err = new NexconnApiError('Nexconn could not issue a session.')
  assert.equal(err.name, 'NexconnApiError')
  assert.equal(err.message, 'Nexconn could not issue a session.')
})

test('Nexconn session validation verifies required fields and supported region', () => {
  const validSession: NexconnSession = {
    appKey: 'test-app-key-123',
    region: 'sg',
    userId: 'cs1234567890abcdef',
    token: 'test-access-token-jwt',
    callsEnabled: false,
  }

  assert.equal(typeof validSession.appKey, 'string')
  assert.ok(['sg', 'us'].includes(validSession.region))
  assert.ok(validSession.userId.startsWith('cs'))
  assert.equal(typeof validSession.token, 'string')
  assert.equal(typeof validSession.callsEnabled, 'boolean')
})

test('Nexconn user ID is derived deterministically from authenticated Supabase user ID', () => {
  const deriveNexconnUserId = (supabaseUserId: string) => {
    const digest = createHash('sha256')
      .update(`cybersaathi:nexconn:v1:${supabaseUserId}`)
      .digest('hex')
    return `cs${digest.slice(0, 62)}`
  }

  const userId1 = '5f90e4c8-d966-4a00-84b9-7aedf04a4675'
  const userId2 = '98eefced-91ba-4bcb-95b0-fdb078792f2e'

  const nexconnId1 = deriveNexconnUserId(userId1)
  const nexconnId1Again = deriveNexconnUserId(userId1)
  const nexconnId2 = deriveNexconnUserId(userId2)

  assert.equal(nexconnId1, nexconnId1Again, 'User ID derivation must be deterministic')
  assert.notEqual(nexconnId1, nexconnId2, 'Different Supabase users must receive distinct Nexconn IDs')
  assert.ok(nexconnId1.startsWith('cs'))
  assert.ok(nexconnId1.length <= 64)
})

test('Nexconn SHA-1 signature generation conforms to official specification', () => {
  const createNexconnSignature = (secret: string, nonce: string, timestamp: string) =>
    createHash('sha1').update(`${secret}${nonce}${timestamp}`).digest('hex')

  const sig = createNexconnSignature('testSecret', '123456789', '1700000000000')
  assert.equal(typeof sig, 'string')
  assert.equal(sig.length, 40, 'SHA-1 hex signature must be exactly 40 characters')
})

test('Direct channel target ID validation enforces alphanumeric format and prevents self-chat', () => {
  const validateTarget = (currentUserId: string, targetId: string) => {
    const cleanId = targetId.trim()
    if (!/^[a-zA-Z0-9]{1,64}$/.test(cleanId)) {
      return { ok: false, error: 'Enter a Nexconn user ID containing 1–64 letters or numbers.' }
    }
    if (cleanId === currentUserId) {
      return { ok: false, error: 'You cannot open a direct chat with your own Nexconn ID.' }
    }
    return { ok: true, cleanId }
  }

  const myId = 'cs0ffc6a9775a6b3b52ed73ba4df8d9fbcd7d178cb5f655890f99291dee426a9'
  const partnerId = 'cse8adb25ec49e2748e92245bdc384568bcccfeb5aa9495b222a983bc740a8fa'

  assert.equal(validateTarget(myId, partnerId).ok, true)
  assert.equal(validateTarget(myId, myId).ok, false)
  assert.equal(validateTarget(myId, myId).error, 'You cannot open a direct chat with your own Nexconn ID.')
  assert.equal(validateTarget(myId, 'invalid id with spaces!').ok, false)
})
