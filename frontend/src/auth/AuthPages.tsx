import { useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
} from 'lucide-react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from './AuthContext'
import { setAuthSessionPersistence } from './supabase'
import { validateEmail, validatePassword, safeAuthErrorMessage, sanitizeRedirectDestination } from './validation'

function AuthArtwork() {
  return <div aria-hidden="true" className="auth-artwork" />
}

function AuthFrame({
  eyebrow,
  title,
  subtitle,
  hideHeading = false,
  children,
}: {
  eyebrow: string
  title: string
  subtitle: string
  hideHeading?: boolean
  children?: ReactNode
}) {
  const { pathname } = useLocation()
  const activeTab = pathname === '/register' ? 'register' : 'login'

  return (
    <main className="auth-page login-page auth-scene auth-scene-login">
      <AuthArtwork />
      <div className="auth-scene-brand" aria-label="CyberSaathi AI — Your Digital World. Our Protection.">
        <span className="auth-scene-logo" aria-hidden="true">
          <ShieldCheck size={82} strokeWidth={1.8} />
          <LockKeyhole className="auth-scene-lock" size={31} strokeWidth={2} />
        </span>
        <span className="auth-scene-wordmark">
          <span>CyberSaathi <strong>AI</strong></span>
        </span>
        <span className="auth-scene-tagline">Your Digital World. Our Protection.</span>
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <header className={hideHeading ? 'auth-card-heading auth-screen-reader-only' : 'auth-card-heading'}>
          <p className="auth-card-eyebrow">{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p>{subtitle}</p>
        </header>
        <nav aria-label="Account access" className="auth-tabs">
          <Link
            aria-current={activeTab === 'login' ? 'page' : undefined}
            className={activeTab === 'login' ? 'auth-tab auth-tab-active' : 'auth-tab'}
            to="/login"
          >
            <UserRound aria-hidden="true" size={16} /> Login
          </Link>
          <Link
            aria-current={activeTab === 'register' ? 'page' : undefined}
            className={activeTab === 'register' ? 'auth-tab auth-tab-active' : 'auth-tab'}
            to="/register"
          >
            <UserRoundPlus aria-hidden="true" size={16} /> Register
          </Link>
        </nav>
        {children}
        <p className="auth-privacy">
          <ShieldCheck aria-hidden="true" size={14} />
          Your account is protected with Supabase Authentication.
        </p>
      </section>
      <Link className="scene-back-home" to="/">Back home</Link>
    </main>
  )
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder = 'Password',
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <span className="password-input-wrap">
        <LockKeyhole aria-hidden="true" className="password-field-icon" size={16} />
        <input
          autoComplete={autoComplete}
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  )
}

function AuthNotice({ message, kind = 'error' }: { message: string; kind?: 'error' | 'success' }) {
  const isConfigurationNotice = message.startsWith('VITE_SUPABASE_')
  return (
    <p
      className={`auth-notice auth-notice-${kind}${isConfigurationNotice ? ' auth-config-notice' : ''}`}
      role="status"
    >
      {message}
    </p>
  )
}

function GoogleButton({
  busy,
  disabled,
  onClick,
}: {
  busy: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      className="button button-google"
      disabled={busy || disabled}
      onClick={onClick}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 48 48" width="17" height="17">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 3)" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.73 5.99c4.52-4.18 7.11-10.34 7.11-17.7Z" />
        <path fill="#FBBC05" d="M10.53 28.59a14.48 14.48 0 0 1 0-9.18l-7.98-6.2a23.99 23.99 0 0 0 0 21.58l7.98-6.2Z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.76l-7.73-5.99c-2.14 1.44-4.87 2.29-8.17 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.2C6.51 42.62 14.62 48 24 48Z" />
      </svg>
      Continue with Google
    </button>
  )
}

function useGoogleSignIn() {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (reason) {
      setError(safeAuthErrorMessage(reason))
      setBusy(false)
    }
  }

  return { busy, error, signIn }
}

export function LoginPage() {
  const { signIn, user, loading, configurationError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const google = useGoogleSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from
  const destination = sanitizeRedirectDestination(from)

  if (!loading && user) {
    return <Navigate replace to={destination} />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      setAuthSessionPersistence(rememberMe)
      await signIn(email.trim(), password)
      navigate(destination, { replace: true })
    } catch (reason) {
      setError(safeAuthErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame
      eyebrow="WELCOME BACK"
      hideHeading
      subtitle="Sign in to continue to your security workspace."
      title="Sign in"
    >
      {configurationError && <AuthNotice message={configurationError} />}
      {error && <AuthNotice message={error} />}
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label className="auth-field auth-email-field" htmlFor="login-email">
          <span>Email address</span>
          <Mail aria-hidden="true" className="email-field-icon" size={16} />
          <input
            autoComplete="email"
            id="login-email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email Address"
            required
            type="email"
            value={email}
          />
        </label>
        <PasswordInput
          autoComplete="current-password"
          id="login-password"
          label="Password"
          onChange={setPassword}
          value={password}
        />
        <div className="auth-options">
          <label className="auth-remember">
            <input
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              type="checkbox"
            />
            <span>Remember Me</span>
          </label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button className="button button-primary auth-submit" disabled={busy || Boolean(configurationError)} type="submit">
          {busy ? 'Signing in…' : <>Login <ArrowRight aria-hidden="true" size={16} /></>}
        </button>
      </form>
      <div className="auth-divider"><span>or</span></div>
      {google.error && <AuthNotice message={google.error} />}
      <GoogleButton busy={google.busy} disabled={Boolean(configurationError)} onClick={() => void google.signIn()} />
      <p className="auth-switch">Don’t have an account? <Link to="/register">Register</Link></p>
    </AuthFrame>
  )
}

export function RegisterPage() {
  const { signUp, user, loading, configurationError } = useAuth()
  const navigate = useNavigate()
  const google = useGoogleSignIn()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailNotice, setEmailNotice] = useState(false)

  if (!loading && user) {
    return <Navigate replace to="/" />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (fullName.trim().length < 2 || fullName.trim().length > 100) {
      setError('Enter a name between 2 and 100 characters.')
      return
    }
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!acceptedTerms) {
      setError('Accept the terms to create an account.')
      return
    }

    setBusy(true)
    try {
      const signedIn = await signUp(fullName, email.trim(), password)
      if (signedIn) {
        navigate('/', { replace: true })
      } else {
        setEmailNotice(true)
      }
    } catch (reason) {
      setError(safeAuthErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame
      eyebrow="CREATE YOUR ACCOUNT"
      hideHeading
      subtitle="Join CyberSaathi AI and take a more informed approach to digital safety."
      title={emailNotice ? 'Check your inbox' : 'Create account'}
    >
      {configurationError && <AuthNotice message={configurationError} />}
      {emailNotice ? (
        <>
          <AuthNotice
            kind="success"
            message="If this address is eligible, Supabase will send an email verification link. Follow it to finish creating your account."
          />
          <Link className="button button-primary auth-submit auth-link-button" to="/login">
            Continue to sign in
          </Link>
        </>
      ) : (
        <>
          {error && <AuthNotice message={error} />}
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <label className="auth-field" htmlFor="register-name">
              <span>Full name</span>
              <input
                autoComplete="name"
                id="register-name"
                maxLength={100}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Full Name"
                required
                value={fullName}
              />
            </label>
            <label className="auth-field" htmlFor="register-email">
              <span>Email address</span>
              <Mail aria-hidden="true" className="email-field-icon" size={16} />
              <input
                autoComplete="email"
                id="register-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email Address"
                required
                type="email"
                value={email}
              />
            </label>
            <PasswordInput
              autoComplete="new-password"
              id="register-password"
              label="Password"
              onChange={setPassword}
              value={password}
            />
            <p className="password-hint">12+ characters with uppercase, lowercase, a number, and a symbol.</p>
            <PasswordInput
              autoComplete="new-password"
              id="register-confirm"
              label="Confirm password"
              onChange={setConfirmPassword}
              placeholder="Confirm Password"
              value={confirmPassword}
            />
            <label className="terms-field">
              <input
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                type="checkbox"
              />
              <span>I accept the Terms and Conditions.</span>
            </label>
            <button className="button button-primary auth-submit" disabled={busy || Boolean(configurationError)} type="submit">
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <div className="auth-divider"><span>or</span></div>
          {google.error && <AuthNotice message={google.error} />}
          <GoogleButton busy={google.busy} disabled={Boolean(configurationError)} onClick={() => void google.signIn()} />
          <p className="auth-switch">Already have an account? <Link to="/login">Login</Link></p>
        </>
      )}
    </AuthFrame>
  )
}

export function ForgotPasswordPage() {
  const { sendPasswordReset, configurationError } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const emailError = validateEmail(email)
    if (emailError) {
      setError(emailError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (reason) {
      setError(safeAuthErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthFrame
      eyebrow="ACCOUNT RECOVERY"
      subtitle="We’ll send a secure password-reset link if the account can receive one."
      title="Reset password"
    >
      {configurationError && <AuthNotice message={configurationError} />}
      {error && <AuthNotice message={error} />}
      {sent ? (
        <AuthNotice
          kind="success"
          message="If an account can receive a reset email at that address, a link has been sent."
        />
      ) : (
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label className="auth-field" htmlFor="reset-email">
            <span>Email address</span>
            <Mail aria-hidden="true" className="email-field-icon" size={16} />
            <input
              autoComplete="email"
              id="reset-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <button className="button button-primary auth-submit" disabled={busy || Boolean(configurationError)} type="submit">
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <Link className="auth-back-link" to="/login"><ArrowLeft size={14} /> Back to sign in</Link>
    </AuthFrame>
  )
}

export function ResetPasswordPage() {
  const { updatePassword, user, loading, configurationError } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      navigate('/', { replace: true })
    } catch (reason) {
      setError(safeAuthErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <AuthFrame eyebrow="ACCOUNT RECOVERY" title="Checking reset link" subtitle="Verifying your secure recovery session." />
  }

  if (!user) {
    return (
      <AuthFrame eyebrow="ACCOUNT RECOVERY" title="Reset link required" subtitle="Open the password-reset link sent to your email to continue.">
        <Link className="button button-primary auth-link-button" to="/forgot-password">Request another link</Link>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame eyebrow="ACCOUNT RECOVERY" title="Choose a new password" subtitle="Use a strong password that you do not use elsewhere.">
      {configurationError && <AuthNotice message={configurationError} />}
      {error && <AuthNotice message={error} />}
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <PasswordInput autoComplete="new-password" id="new-password" label="New password" onChange={setPassword} value={password} />
        <p className="password-hint">12+ characters with uppercase, lowercase, a number, and a symbol.</p>
        <PasswordInput autoComplete="new-password" id="confirm-new-password" label="Confirm new password" onChange={setConfirmPassword} value={confirmPassword} />
        <button className="button button-primary auth-submit" disabled={busy || Boolean(configurationError)} type="submit">
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthFrame>
  )
}

export function AuthCallbackPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const hasProviderError =
    new URLSearchParams(location.search).has('error') ||
    new URLSearchParams(location.hash.slice(1)).has('error')

  if (!loading && user && !hasProviderError) {
    return <Navigate replace to="/" />
  }

  const canContinueToSignIn = !loading && !user && !hasProviderError
  return (
    <AuthFrame
      eyebrow="SECURE SIGN-IN"
      subtitle={
        hasProviderError
          ? 'Sign-in could not be completed. Check the provider configuration and try again.'
          : canContinueToSignIn
            ? 'No active session was returned. If you verified your email, sign in to continue; otherwise request a fresh link.'
            : 'Verifying your authentication response…'
      }
      title={hasProviderError ? 'Sign-in incomplete' : canContinueToSignIn ? 'Continue to sign in' : 'Verifying your account'}
    >
      {!canContinueToSignIn && !hasProviderError && <p className="auth-loading" role="status">Please wait while we verify your session.</p>}
      {(hasProviderError || canContinueToSignIn) && <Link className="button button-primary auth-link-button" to="/login">Continue to sign in</Link>}
    </AuthFrame>
  )
}
