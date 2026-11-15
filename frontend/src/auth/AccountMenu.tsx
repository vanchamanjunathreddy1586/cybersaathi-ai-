import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Save, UserRound, X } from 'lucide-react'
import { useAuth } from './AuthContext'
import { safeAuthErrorMessage } from './validation'

export function AccountMenu() {
  const navigate = useNavigate()
  const { user, profile, profileError, updateProfile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const currentProfile = profile?.id === user?.id ? profile : null
  const displayName = currentProfile?.full_name || user?.user_metadata.full_name || 'Account'
  const email = currentProfile?.email || user?.email || ''
  const initials = displayName.trim().slice(0, 1).toUpperCase() || 'U'

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (fullName.trim().length < 2 || fullName.trim().length > 100) {
      setError('Enter a name between 2 and 100 characters.')
      return
    }
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await updateProfile(fullName.trim())
      setSaved(true)
    } catch (reason) {
      setError(safeAuthErrorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    setError(null)
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (reason) {
      setError(safeAuthErrorMessage(reason))
      setBusy(false)
    }
  }

  return (
    <div className="account-menu">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="account-trigger"
        onClick={() => {
          setOpen((current) => !current)
          setFullName(currentProfile?.full_name || user?.user_metadata.full_name || '')
          setError(null)
          setSaved(false)
        }}
        type="button"
      >
        <span className="avatar">{initials}</span>
        <span className="account-trigger-copy">
          <strong>{displayName}</strong>
          <small>{email}</small>
        </span>
        <UserRound aria-hidden="true" size={16} />
      </button>
      {open && (
        <section aria-label="Account settings" className="account-popover" role="dialog">
          <div className="account-popover-heading">
            <div><p className="eyebrow">YOUR ACCOUNT</p><h2>Profile</h2></div>
            <button aria-label="Close account settings" className="icon-button" onClick={() => setOpen(false)} type="button">
              <X size={17} />
            </button>
          </div>
          {profileError && <p className="account-message account-error" role="status">{profileError}</p>}
          {error && <p className="account-message account-error" role="status">{error}</p>}
          {saved && <p className="account-message account-success" role="status">Profile updated.</p>}
          <form className="account-form" onSubmit={(event) => void save(event)}>
            <label className="auth-field" htmlFor="account-name">
              <span>Full name</span>
              <input
                autoComplete="name"
                id="account-name"
                maxLength={100}
                onChange={(event) => setFullName(event.target.value)}
                required
                value={fullName}
              />
            </label>
            <label className="auth-field" htmlFor="account-email">
              <span>Email address</span>
              <input autoComplete="email" id="account-email" readOnly value={email} />
            </label>
            <button className="button button-primary account-save" disabled={busy} type="submit">
              <Save size={15} /> {busy ? 'Saving…' : 'Save profile'}
            </button>
          </form>
          <button className="button button-secondary account-logout" disabled={busy} onClick={() => void logout()} type="button">
            <LogOut size={15} /> Sign out
          </button>
        </section>
      )}
    </div>
  )
}
