import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isDuplicateUserError,
  safeAuthErrorMessage,
} from '../src/auth/validation.ts'

// Mock state store representing auth.users and public.profiles
interface StoredUser {
  id: string
  email: string
  passwordHash: string
  fullName: string
}

function mockHashPassword(password: string): string {
  // Deterministic mock hash for testing
  return `hashed:${password}:salt2026`
}

class MockSupabaseAuth {
  private users = new Map<string, StoredUser>()

  constructor(initialUsers: StoredUser[] = []) {
    for (const u of initialUsers) {
      this.users.set(u.email.toLowerCase(), { ...u })
    }
  }

  getUser(email: string): StoredUser | undefined {
    return this.users.get(email.toLowerCase())
  }

  // Simulates Supabase auth.signUp with user enumeration prevention enabled
  async signUp(input: {
    email: string
    password: string
    options?: { data?: { full_name?: string } }
  }): Promise<{
    data: { user: { id: string; email: string; identities?: unknown[] } | null; session: null }
    error: { code: string; message: string } | null
  }> {
    const normalized = input.email.trim().toLowerCase()
    const existing = this.users.get(normalized)

    if (existing) {
      // In Supabase with enumeration prevention:
      // Return user with EMPTY identities, NO session, and DO NOT update password or metadata!
      return {
        data: {
          user: {
            id: existing.id,
            email: existing.email,
            identities: [], // Empty identities signals existing account to internal SDK without leaking
          },
          session: null,
        },
        error: null,
      }
    }

    // New user registration
    const newUser: StoredUser = {
      id: `usr_${Date.now()}`,
      email: normalized,
      passwordHash: mockHashPassword(input.password),
      fullName: input.options?.data?.full_name || 'CyberSaathi member',
    }
    this.users.set(normalized, newUser)

    return {
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          identities: [{ id: newUser.id }],
        },
        session: null,
      },
      error: null,
    }
  }

  // Simulates Supabase auth.signUp when project has user enumeration protection OFF (returns error)
  async signUpWithoutEnumerationProtection(input: {
    email: string
    password: string
  }): Promise<{
    data: { user: null; session: null }
    error: { code: string; message: string } | null
  }> {
    const normalized = input.email.trim().toLowerCase()
    if (this.users.has(normalized)) {
      return {
        data: { user: null, session: null },
        error: {
          code: 'user_already_exists',
          message: 'User already registered',
        },
      }
    }

    return {
      data: { user: null, session: null },
      error: null,
    }
  }

  // Simulates Supabase auth.signInWithPassword
  async signInWithPassword(input: {
    email: string
    password: string
  }): Promise<{
    data: { user: StoredUser; session: { access_token: string } } | null
    error: { code: string; message: string } | null
  }> {
    const normalized = input.email.trim().toLowerCase()
    const existing = this.users.get(normalized)

    if (!existing || existing.passwordHash !== mockHashPassword(input.password)) {
      return {
        data: null,
        error: {
          code: 'invalid_credentials',
          message: 'Invalid login credentials',
        },
      }
    }

    return {
      data: {
        user: existing,
        session: { access_token: `jwt_token_for_${existing.id}` },
      },
      error: null,
    }
  }
}

test('isDuplicateUserError accurately detects duplicate user error codes and messages', () => {
  assert.equal(isDuplicateUserError({ code: 'user_already_exists' }), true)
  assert.equal(isDuplicateUserError({ code: 'email_exists' }), true)
  assert.equal(isDuplicateUserError({ message: 'User already registered' }), true)
  assert.equal(isDuplicateUserError(new Error('User already registered')), true)
  assert.equal(isDuplicateUserError(new Error('A user with this email already exists')), true)

  // Should NOT trigger on unrelated errors
  assert.equal(isDuplicateUserError({ code: 'invalid_credentials' }), false)
  assert.equal(isDuplicateUserError(new Error('Invalid login credentials')), false)
  assert.equal(isDuplicateUserError({ status: 429, message: 'Too many requests' }), false)
  assert.equal(isDuplicateUserError(null), false)
  assert.equal(isDuplicateUserError(undefined), false)
})

test('Duplicate signup attempt shows consistent verification message and never reveals account existence', async () => {
  const auth = new MockSupabaseAuth([
    {
      id: 'existing-uuid-1',
      email: 'member@cybersaathi.org',
      passwordHash: mockHashPassword('LegitPassword#2026'),
      fullName: 'Satyarth Sharma',
    },
  ])

  // Case 1: First-time signup with new email
  const newEmailResult = await auth.signUp({
    email: 'newuser@cybersaathi.org',
    password: 'NewUserPassword#2026',
    options: { data: { full_name: 'New User' } },
  })
  // When email verification is required, session is null
  const newEmailRequiresVerification = newEmailResult.data.session === null
  assert.equal(newEmailRequiresVerification, true)
  assert.equal(newEmailResult.error, null)

  // Case 2: Duplicate signup with existing email (with enumeration protection)
  const duplicateResult = await auth.signUp({
    email: 'member@cybersaathi.org',
    password: 'AttackerPassword#9999',
    options: { data: { full_name: 'Attacker Overwrite' } },
  })
  const duplicateRequiresVerification = duplicateResult.data.session === null
  assert.equal(duplicateRequiresVerification, true)
  assert.equal(duplicateResult.error, null)

  // Notice: Both Case 1 and Case 2 produce the exact same outcome:
  // session === null -> application displays the identical verification message
  const expectedNoticeMessage =
    'If this address is eligible, Supabase will send an email verification link. Follow it to finish creating your account.'

  // Case 3: Duplicate signup with existing email (when provider throws user_already_exists)
  const rawProviderError = await auth.signUpWithoutEnumerationProtection({
    email: 'member@cybersaathi.org',
    password: 'AttackerPassword#9999',
  })
  assert.notEqual(rawProviderError.error, null)
  assert.equal(isDuplicateUserError(rawProviderError.error), true)

  // Frontend sanitizes the error to the exact same message without revealing existence
  const sanitizedMessage = safeAuthErrorMessage(rawProviderError.error)
  assert.equal(sanitizedMessage, expectedNoticeMessage)
})

test('Duplicate signup attempt NEVER overwrites or alters existing password or profile', async () => {
  const originalUser: StoredUser = {
    id: 'user-keep-safe',
    email: 'secure_member@cybersaathi.org',
    passwordHash: mockHashPassword('OriginalSecret#2026'),
    fullName: 'Original Real Name',
  }

  const auth = new MockSupabaseAuth([originalUser])

  // Attempt duplicate signup with a malicious different password and profile name
  await auth.signUp({
    email: 'secure_member@cybersaathi.org',
    password: 'MaliciousAttackerPassword#9999',
    options: { data: { full_name: 'Malicious Attacker Name' } },
  })

  // Inspect the stored user in the database
  const userAfterAttempt = auth.getUser('secure_member@cybersaathi.org')
  assert.notEqual(userAfterAttempt, undefined)

  // 1. Password must remain original
  assert.equal(
    userAfterAttempt?.passwordHash,
    mockHashPassword('OriginalSecret#2026'),
    'Password hash must NOT be updated by duplicate signup attempt',
  )
  assert.notEqual(
    userAfterAttempt?.passwordHash,
    mockHashPassword('MaliciousAttackerPassword#9999'),
    'Password must never be replaced with duplicate signup attempt password',
  )

  // 2. Profile metadata must remain original
  assert.equal(
    userAfterAttempt?.fullName,
    'Original Real Name',
    'User full_name must NOT be overwritten by duplicate signup attempt',
  )
})

test('Existing users can still log in with their original password after duplicate signup attempts', async () => {
  const originalPassword = 'MySecretPassword#2026'
  const attackerPassword = 'AttackerAttempt#9999'

  const auth = new MockSupabaseAuth([
    {
      id: 'user-active-1',
      email: 'active_member@cybersaathi.org',
      passwordHash: mockHashPassword(originalPassword),
      fullName: 'Active Member',
    },
  ])

  // Attacker attempts duplicate registration
  await auth.signUp({
    email: 'active_member@cybersaathi.org',
    password: attackerPassword,
    options: { data: { full_name: 'Hacked Name' } },
  })

  // 1. Attacker attempts to login with attackerPassword -> MUST FAIL
  const attackerLogin = await auth.signInWithPassword({
    email: 'active_member@cybersaathi.org',
    password: attackerPassword,
  })
  assert.equal(attackerLogin.data, null)
  assert.equal(attackerLogin.error?.code, 'invalid_credentials')

  // 2. Legitimate user logs in with originalPassword -> MUST SUCCEED
  const legitimateLogin = await auth.signInWithPassword({
    email: 'active_member@cybersaathi.org',
    password: originalPassword,
  })
  assert.notEqual(legitimateLogin.data, null)
  assert.equal(legitimateLogin.error, null)
  assert.equal(legitimateLogin.data?.user.id, 'user-active-1')
  assert.equal(legitimateLogin.data?.user.fullName, 'Active Member')
  assert.match(legitimateLogin.data?.session.access_token || '', /^jwt_token_for_/)
})
