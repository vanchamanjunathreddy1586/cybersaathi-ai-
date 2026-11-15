import test from 'node:test'
import assert from 'node:assert/strict'
import {
  safeAuthErrorMessage,
  sanitizeRedirectDestination,
  validateEmail,
  validatePassword,
} from '../src/auth/validation.ts'

test('validateEmail validates RFC compliant email addresses', () => {
  assert.equal(validateEmail('user@cybersaathi.org'), null)
  assert.equal(validateEmail('test.user+tag@domain.co.in'), null)
  assert.equal(validateEmail('invalid-email'), 'Enter a valid email address.')
  assert.equal(validateEmail('user@'), 'Enter a valid email address.')
  assert.equal(validateEmail('  '), 'Enter a valid email address.')
})

test('validatePassword enforces 12+ chars and complexity', () => {
  assert.equal(validatePassword('CyberSaathi#2026'), null)
  assert.equal(validatePassword('Short#1'), 'Use at least 12 characters.')
  assert.equal(validatePassword('ALLUPPERCASE123!'), 'Include at least one lowercase letter.')
  assert.equal(validatePassword('alllowercase123!'), 'Include at least one uppercase letter.')
  assert.equal(validatePassword('NoDigitsHere!ABCd'), 'Include at least one number.')
  assert.equal(validatePassword('NoSymbols123456Ab'), 'Include at least one symbol.')
})

test('safeAuthErrorMessage maps invalid credentials to user-friendly message', () => {
  const err1 = new Error('Invalid login credentials')
  assert.equal(
    safeAuthErrorMessage(err1),
    'Invalid email or password. Please check your credentials and try again.',
  )

  const err2 = { code: 'invalid_credentials', message: 'Auth failed' }
  assert.equal(
    safeAuthErrorMessage(err2),
    'Invalid email or password. Please check your credentials and try again.',
  )
})

test('safeAuthErrorMessage maps unconfirmed email to user-friendly message', () => {
  const err1 = new Error('Email not confirmed')
  assert.equal(
    safeAuthErrorMessage(err1),
    'Your email address has not been verified yet. Check your inbox for the confirmation link.',
  )

  const err2 = { code: 'email_not_confirmed' }
  assert.equal(
    safeAuthErrorMessage(err2),
    'Your email address has not been verified yet. Check your inbox for the confirmation link.',
  )
})

test('safeAuthErrorMessage never reveals duplicate account existence and shows consistent verification message', () => {
  const err1 = new Error('User already registered')
  assert.equal(
    safeAuthErrorMessage(err1),
    'If this address is eligible, Supabase will send an email verification link. Follow it to finish creating your account.',
  )

  const err2 = { code: 'user_already_exists' }
  assert.equal(
    safeAuthErrorMessage(err2),
    'If this address is eligible, Supabase will send an email verification link. Follow it to finish creating your account.',
  )
})

test('safeAuthErrorMessage maps rate limiting to user-friendly message', () => {
  const err1 = { status: 429, message: 'Too many requests' }
  assert.equal(
    safeAuthErrorMessage(err1),
    'Too many attempts. Please wait a few moments and try again.',
  )

  const err2 = { code: 'over_request_rate_limit', message: 'Rate limit exceeded' }
  assert.equal(
    safeAuthErrorMessage(err2),
    'Too many attempts. Please wait a few moments and try again.',
  )
})

test('safeAuthErrorMessage maps expired sessions to user-friendly message', () => {
  const err1 = new Error('Token has expired')
  assert.equal(
    safeAuthErrorMessage(err1),
    'Your session has expired. Please sign in again.',
  )

  const err2 = { code: 'session_expired' }
  assert.equal(
    safeAuthErrorMessage(err2),
    'Your session has expired. Please sign in again.',
  )
})

test('safeAuthErrorMessage maps network failures to user-friendly message', () => {
  const err1 = new TypeError('Failed to fetch')
  assert.equal(
    safeAuthErrorMessage(err1),
    'Network connection issue. Please check your internet connection and try again.',
  )

  const err2 = new Error('fetch failed')
  assert.equal(
    safeAuthErrorMessage(err2),
    'Network connection issue. Please check your internet connection and try again.',
  )
})

test('safeAuthErrorMessage preserves diagnostic error messages for missing env vars', () => {
  const err = new Error('VITE_SUPABASE_URL is not configured.')
  assert.equal(safeAuthErrorMessage(err), 'VITE_SUPABASE_URL is not configured.')
})

test('safeAuthErrorMessage keeps unknown errors generic and never leaks raw internals', () => {
  const err = new Error('FATAL: connection to server on port 5432 failed: password auth failed for user "postgres"')
  assert.equal(
    safeAuthErrorMessage(err),
    'We could not complete that request. Check your details and try again.',
  )
})

test('sanitizeRedirectDestination prevents open redirects and allows valid internal routes', () => {
  assert.equal(sanitizeRedirectDestination('/scanner'), '/scanner')
  assert.equal(sanitizeRedirectDestination('/history/123'), '/history/123')
  assert.equal(sanitizeRedirectDestination('/investigations?view=open#step2'), '/investigations?view=open#step2')
  assert.equal(sanitizeRedirectDestination('/'), '/')

  // Protocol-relative attacks
  assert.equal(sanitizeRedirectDestination('//evil.com'), '/')
  assert.equal(sanitizeRedirectDestination('//evil.com/phish'), '/')

  // Backslash variations
  assert.equal(sanitizeRedirectDestination('/\\evil.com'), '/')

  // Full external URL
  assert.equal(sanitizeRedirectDestination('https://evil.com'), '/')
  assert.equal(sanitizeRedirectDestination('http://attacker.com/steal'), '/')

  // XSS vectors
  assert.equal(sanitizeRedirectDestination('javascript:alert(1)'), '/')

  // Invalid types
  assert.equal(sanitizeRedirectDestination(null), '/')
  assert.equal(sanitizeRedirectDestination(undefined), '/')
  assert.equal(sanitizeRedirectDestination(123), '/')
})
