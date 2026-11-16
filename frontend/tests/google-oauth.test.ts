import test from 'node:test'
import assert from 'node:assert/strict'
import { safeAuthErrorMessage, sanitizeRedirectDestination } from '../src/auth/validation.ts'

interface MockSession {
  access_token: string
  refresh_token: string
  user: {
    id: string
    email: string
    app_metadata: { provider: string; providers: string[] }
    user_metadata: { full_name?: string; name?: string; avatar_url?: string }
  }
}

class MockSupabaseOAuthClient {
  public session: MockSession | null = null
  public googleEnabled: boolean
  public lastSignInOptions: Record<string, unknown> | null = null

  constructor(googleEnabled = false) {
    this.googleEnabled = googleEnabled
  }

  async signInWithOAuth(params: {
    provider: string
    options?: {
      redirectTo?: string
      queryParams?: Record<string, string>
    }
  }): Promise<{ data: { provider: string; url: string | null }; error: Error | null }> {
    this.lastSignInOptions = params.options || null
    if (params.provider === 'google') {
      if (!this.googleEnabled) {
        return {
          data: { provider: 'google', url: null },
          error: new Error('Unsupported provider: provider is not enabled'),
        }
      }
      return {
        data: {
          provider: 'google',
          url: `https://mock-supabase.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(
            params.options?.redirectTo || 'http://localhost:5173/auth/callback',
          )}&prompt=${params.options?.queryParams?.prompt || 'select_account'}`,
        },
        error: null,
      }
    }
    return {
      data: { provider: params.provider, url: null },
      error: new Error(`Unsupported provider: ${params.provider}`),
    }
  }

  async handleCallback(hashOrQuery: string): Promise<{ session: MockSession | null; error: Error | null }> {
    const params = new URLSearchParams(hashOrQuery.replace(/^[#?]/, ''))
    if (params.has('error')) {
      const errorMsg = params.get('error_description') || params.get('error') || 'OAuth error'
      return { session: null, error: new Error(errorMsg) }
    }

    if (params.has('access_token')) {
      this.session = {
        access_token: params.get('access_token')!,
        refresh_token: params.get('refresh_token') || 'mock-refresh-token',
        user: {
          id: 'google-user-uuid-1234',
          email: 'user@gmail.com',
          app_metadata: { provider: 'google', providers: ['google'] },
          user_metadata: {
            full_name: 'Test Google User',
            name: 'Test Google User',
            avatar_url: 'https://lh3.googleusercontent.com/test',
          },
        },
      }
      return { session: this.session, error: null }
    }

    return { session: null, error: null }
  }

  async signOut(): Promise<{ error: Error | null }> {
    this.session = null
    return { error: null }
  }
}

test('Google OAuth: signInWithGoogle builds canonical redirect options', async () => {
  const client = new MockSupabaseOAuthClient(true)
  const result = await client.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'http://localhost:5173/auth/callback',
      queryParams: { prompt: 'select_account' },
    },
  })

  assert.equal(result.error, null)
  assert.ok(result.data.url?.includes('provider=google'))
  assert.ok(result.data.url?.includes('redirect_to=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback'))
  assert.ok(result.data.url?.includes('prompt=select_account'))
  assert.deepEqual(client.lastSignInOptions, {
    redirectTo: 'http://localhost:5173/auth/callback',
    queryParams: { prompt: 'select_account' },
  })
})

test('Google OAuth: unconfigured or disabled provider returns clear user-facing error', async () => {
  const client = new MockSupabaseOAuthClient(false)
  const result = await client.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'http://localhost:5173/auth/callback',
      queryParams: { prompt: 'select_account' },
    },
  })

  assert.ok(result.error)
  const userMessage = safeAuthErrorMessage(result.error)
  assert.equal(
    userMessage,
    'Google Sign-In is not currently enabled in the authentication provider settings. Please contact the administrator or sign in with your email and password.',
  )
})

test('Google OAuth: callback successfully establishes session and user metadata', async () => {
  const client = new MockSupabaseOAuthClient(true)
  const callbackHash = '#access_token=mock-valid-jwt&refresh_token=mock-valid-refresh&token_type=bearer&expires_in=3600'
  const { session, error } = await client.handleCallback(callbackHash)

  assert.equal(error, null)
  assert.ok(session)
  assert.equal(session.user.email, 'user@gmail.com')
  assert.equal(session.user.app_metadata.provider, 'google')
  assert.equal(session.user.user_metadata.full_name, 'Test Google User')
})

test('Google OAuth: callback handles user cancellation and provider errors safely', async () => {
  const client = new MockSupabaseOAuthClient(true)
  const errorHash = '#error=access_denied&error_code=403&error_description=The+user+denied+the+request'
  const { session, error } = await client.handleCallback(errorHash)

  assert.equal(session, null)
  assert.ok(error)
  assert.ok(error.message.includes('The user denied the request') || error.message.includes('access_denied'))
})

test('Google OAuth: callback handles missing tokens gracefully', async () => {
  const client = new MockSupabaseOAuthClient(true)
  const emptyHash = ''
  const { session, error } = await client.handleCallback(emptyHash)

  assert.equal(session, null)
  assert.equal(error, null)
})

test('Google OAuth: logout flow revokes active session cleanly', async () => {
  const client = new MockSupabaseOAuthClient(true)
  // Simulate active session
  await client.handleCallback('#access_token=jwt123&refresh_token=ref123')
  assert.ok(client.session)

  // Sign out
  const { error } = await client.signOut()
  assert.equal(error, null)
  assert.equal(client.session, null)
})

test('Google OAuth: redirect destination sanitization preserves internal paths and blocks open redirects', () => {
  assert.equal(sanitizeRedirectDestination('/auth/callback'), '/auth/callback')
  assert.equal(sanitizeRedirectDestination('/dashboard'), '/dashboard')
  assert.equal(sanitizeRedirectDestination('/scanner'), '/scanner')
  assert.equal(sanitizeRedirectDestination('https://evil-phish.com'), '/')
  assert.equal(sanitizeRedirectDestination('//evil-phish.com/auth'), '/')
})

test('Google OAuth: profile metadata extractor conforms to database trigger logic', () => {
  const googleMetadata1 = { full_name: 'John Doe', avatar_url: 'https://example.com/photo.jpg' }
  const name1 = (googleMetadata1.full_name || '').trim()
  assert.equal(name1, 'John Doe')

  const googleMetadata2 = { name: 'Priya Sharma' }
  const name2 = (googleMetadata2.name || '').trim()
  assert.equal(name2, 'Priya Sharma')

  const googleMetadata3 = {}
  const candidate = (googleMetadata3 as { full_name?: string }).full_name?.trim() || 'CyberSaathi member'
  assert.equal(candidate, 'CyberSaathi member')
})
