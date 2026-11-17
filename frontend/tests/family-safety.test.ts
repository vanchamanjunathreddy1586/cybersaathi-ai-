import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FamilySafetyApiError,
  isDatabaseMigrationPendingError,
  sanitizeUserFacingError,
  generateInviteCode,
  type FamilyCircleSummary,
  type FamilyCircleAlert,
} from '../src/family-safety/familySafetyApi.ts'

test('FamilySafetyApiError captures message, status, and code', () => {
  const err = new FamilySafetyApiError('Invalid invite code provided.', 400, 'INVALID_CODE')
  assert.equal(err.name, 'FamilySafetyApiError')
  assert.equal(err.message, 'Invalid invite code provided.')
  assert.equal(err.status, 400)
  assert.equal(err.code, 'INVALID_CODE')
})

test('generateInviteCode produces unique valid CS- prefixed codes', () => {
  const code1 = generateInviteCode()
  const code2 = generateInviteCode()
  assert.match(code1, /^CS-[A-Z0-9]{6}$/)
  assert.match(code2, /^CS-[A-Z0-9]{6}$/)
  assert.notEqual(code1, code2)
})

test('Invite code formatting validator correctly accepts CS- prefixed codes and rejects invalid strings', () => {
  const isValidInviteCode = (code: string): boolean => {
    return /^CS-[A-Z0-9]{6}$/.test(code.trim().toUpperCase())
  }

  assert.equal(isValidInviteCode('CS-ABCDEF'), true)
  assert.equal(isValidInviteCode('CS-9X2M4K'), true)
  assert.equal(isValidInviteCode('cs-9x2m4k'), true, 'Case insensitive normalization should pass')
  assert.equal(isValidInviteCode('INVALID-CODE'), false)
  assert.equal(isValidInviteCode('CS-SHORT'), false)
  assert.equal(isValidInviteCode('CS-TOOLONG999'), false)
  assert.equal(isValidInviteCode(''), false)
})

test('Family circle member roles and threat severities conform to domain contracts', () => {
  const sampleCircle: FamilyCircleSummary = {
    id: 'circle-123',
    name: 'Sharma Family Protection',
    owner_user_id: 'user-guardian-1',
    invite_code: 'CS-8899AA',
    created_at: new Date().toISOString(),
    role: 'guardian',
    memberCount: 4,
    alertCount: 1,
  }

  assert.equal(sampleCircle.role, 'guardian')
  assert.ok(sampleCircle.memberCount >= 1)

  const sampleAlert: FamilyCircleAlert = {
    id: 'alert-abc',
    circle_id: 'circle-123',
    triggered_by_user_id: 'user-member-2',
    threat_type: 'Digital Arrest / Extortion Video Call',
    severity: 'critical',
    summary: 'Caller claimed to be Delhi Police CBI and demanded money.',
    advice: 'Hang up immediately. No police conducts digital arrest. Call 1930.',
    resolved: false,
    created_at: new Date().toISOString(),
  }

  assert.equal(sampleAlert.severity, 'critical')
  assert.equal(sampleAlert.resolved, false)
  assert.ok(sampleAlert.advice.includes('1930'))
})

test('WhatsApp share URL generates properly encoded invitation link with circle name and code', () => {
  const generateWhatsAppUrl = (circleName: string, inviteCode: string) => {
    const text = `Join our CyberSaathi AI Family Safety Circle "${circleName}"! Use invite code: ${inviteCode} to receive real-time scam alerts and stay protected.`
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
  }

  const url = generateWhatsAppUrl('Gupta Family', 'CS-4455ZZ')
  assert.ok(url.startsWith('https://api.whatsapp.com/send?text='))
  assert.ok(url.includes('Gupta%20Family'))
  assert.ok(url.includes('CS-4455ZZ'))
  assert.ok(url.includes('CyberSaathi%20AI'))
})

test('isDatabaseMigrationPendingError accurately identifies missing tables and schema cache errors', () => {
  assert.equal(isDatabaseMigrationPendingError(new Error("Could not find the table 'public.family_circle_members' in the schema cache")), true)
  assert.equal(isDatabaseMigrationPendingError(new Error('relation "family_circles" does not exist')), true)
  assert.equal(isDatabaseMigrationPendingError(new FamilySafetyApiError('Pending migration', 503, 'DATABASE_SETUP_PENDING')), true)
  assert.equal(isDatabaseMigrationPendingError(new Error('Network error')), false)
  assert.equal(isDatabaseMigrationPendingError(null), false)
})

test('sanitizeUserFacingError hides raw Postgres/schema internals and presents actionable messages', () => {
  const res1 = sanitizeUserFacingError(new Error("Could not find the table 'public.family_circle_members' in the schema cache"))
  assert.equal(res1.isDatabasePending, true)
  assert.ok(res1.message.includes('migration script must be applied'))
  assert.ok(!res1.message.includes('schema cache'))

  const res2 = sanitizeUserFacingError(new FamilySafetyApiError('Unauthorized', 401))
  assert.equal(res2.isDatabasePending, false)
  assert.ok(res2.message.includes('Authentication required'))

  const res3 = sanitizeUserFacingError(new FamilySafetyApiError('Rate limit exceeded', 429))
  assert.equal(res3.isDatabasePending, false)
  assert.ok(res3.message.includes('Too many requests'))
})
