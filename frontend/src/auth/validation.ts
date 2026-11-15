export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? null
    : 'Enter a valid email address.'
}

export function validatePassword(password: string): string | null {
  if (password.length < 12) {
    return 'Use at least 12 characters.'
  }
  if (!/[a-z]/.test(password)) {
    return 'Include at least one lowercase letter.'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Include at least one uppercase letter.'
  }
  if (!/\d/.test(password)) {
    return 'Include at least one number.'
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Include at least one symbol.'
  }
  return null
}

export function safeAuthErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    /VITE_SUPABASE_(URL|PUBLISHABLE_KEY)/.test(error.message)
  ) {
    return error.message
  }

  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code.toLowerCase()
      : ''

  const status =
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
      ? (error as { status: number }).status
      : undefined

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message.toLowerCase()
        : ''

  if (
    status === 429 ||
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'Too many attempts. Please wait a few moments and try again.'
  }

  if (
    code === 'invalid_credentials' ||
    code === 'bad_jwt' ||
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials') ||
    message.includes('invalid username or password')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.'
  }

  if (
    code === 'email_not_confirmed' ||
    message.includes('email not confirmed') ||
    message.includes('email link is invalid or has expired')
  ) {
    return 'Your email address has not been verified yet. Check your inbox for the confirmation link.'
  }

  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('user already registered') ||
    message.includes('already exists')
  ) {
    return 'If this address is eligible, Supabase will send an email verification link. Follow it to finish creating your account.'
  }

  if (
    code === 'session_expired' ||
    code === 'refresh_token_not_found' ||
    code === 'token_expired' ||
    message.includes('token has expired') ||
    message.includes('session expired') ||
    message.includes('jwt expired') ||
    message.includes('refresh token')
  ) {
    return 'Your session has expired. Please sign in again.'
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network error') ||
    message.includes('networkerror') ||
    message.includes('fetch failed') ||
    message.includes('could not connect') ||
    message.includes('abort')
  ) {
    return 'Network connection issue. Please check your internet connection and try again.'
  }

  return 'We could not complete that request. Check your details and try again.'
}

export function sanitizeRedirectDestination(target: unknown): string {
  if (typeof target !== 'string') {
    return '/'
  }
  const trimmed = target.trim()
  if (/^\/(?!\/|\\)[A-Za-z0-9_\-./?&=#%]*$/.test(trimmed)) {
    return trimmed
  }
  return '/'
}

export function isDuplicateUserError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const code =
    'code' in error && typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code.toLowerCase()
      : ''

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message.toLowerCase()
        : ''

  return (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('user already registered') ||
    message.includes('already registered') ||
    message.includes('user already exists') ||
    message.includes('already exists')
  )
}


