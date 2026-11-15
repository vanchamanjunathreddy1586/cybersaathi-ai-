import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  LogOut,
  Plus,
  Send,
  Shield,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  fetchUserCircles,
  fetchCircleDetails,
  createFamilyCircle,
  joinFamilyCircle,
  broadcastCircleAlert,
  leaveFamilyCircle,
  type FamilyCircleSummary,
  type CircleDetails,
  FamilySafetyApiError,
} from './familySafetyApi'
import './family-safety.css'

const PRESET_THREATS = [
  {
    type: 'Digital Arrest / Extortion Video Call',
    severity: 'critical' as const,
    summary: 'A scammer claiming to be CBI/Police placed family member under "digital arrest" demanding money.',
    advice: 'Immediately disconnect video call. Digital arrest is illegal. Do not transfer funds. Call 1930.',
  },
  {
    type: 'UPI QR Code / Reverse Refund Scam',
    severity: 'critical' as const,
    summary: 'A buyer on OLX/Marketplace sent a QR code claiming "Scan to receive payment".',
    advice: 'Never enter your UPI PIN to receive money. UPI PIN is only needed when money leaves your account.',
  },
  {
    type: 'Malicious APK / Screen-Sharing App',
    severity: 'critical' as const,
    summary: 'Caller asked to download an APK or AnyDesk/TeamViewer to fix bank/SIM KYC.',
    advice: 'Immediately turn off Wi-Fi/Mobile data. Uninstall the APK. Check SMS forwarding and bank apps.',
  },
  {
    type: 'Electricity Bill Cutoff Threat',
    severity: 'high' as const,
    summary: 'SMS received threatening electricity disconnection tonight unless bill is updated via APK.',
    advice: 'Disregard the SMS. Verify bill status only on the official state electricity board portal.',
  },
]

export function FamilySafetyPage() {
  const { session, profile, user } = useAuth()
  const accessToken = session?.access_token

  const [circles, setCircles] = useState<FamilyCircleSummary[]>([])
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null)
  const [circleDetails, setCircleDetails] = useState<CircleDetails | null>(null)
  const [loading, setLoading] = useState(Boolean(session?.access_token))
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [circleNameInput, setCircleNameInput] = useState('')
  const [inviteCodeInput, setInviteCodeInput] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  // Emergency Alert Form state
  const [threatType, setThreatType] = useState(PRESET_THREATS[0].type)
  const [severity, setSeverity] = useState<'high' | 'critical'>(PRESET_THREATS[0].severity)
  const [summary, setSummary] = useState(PRESET_THREATS[0].summary)
  const [advice, setAdvice] = useState(PRESET_THREATS[0].advice)
  const [broadcasting, setBroadcasting] = useState(false)

  const reloadCircles = useCallback(async (token: string, selectId?: string) => {
    try {
      const data = await fetchUserCircles(token)
      setCircles(data)
      if (data.length > 0) {
        const targetId = selectId && data.some((c) => c.id === selectId) ? selectId : data[0].id
        setSelectedCircleId(targetId)
      } else {
        setSelectedCircleId(null)
        setCircleDetails(null)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load family circles.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!accessToken) return

    fetchUserCircles(accessToken)
      .then((data) => {
        if (!active) return
        setCircles(data)
        if (data.length > 0) {
          setSelectedCircleId((prev) => (prev && data.some((c) => c.id === prev) ? prev : data[0].id))
        }
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load family circles.')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [accessToken])

  useEffect(() => {
    let active = true
    if (!accessToken || !selectedCircleId) return

    fetchCircleDetails(accessToken, selectedCircleId)
      .then((details) => {
        if (!active) return
        setCircleDetails(details)
        setDetailsLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load circle details.')
        setDetailsLoading(false)
      })

    return () => {
      active = false
    }
  }, [accessToken, selectedCircleId])

  const handleCopyInvite = (code: string) => {
    void navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2500)
  }

  const handleCreateCircle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken || !circleNameInput.trim()) return
    setSubmittingAction(true)
    setErrorMessage(null)

    try {
      const displayName = profile?.full_name || user?.user_metadata?.full_name || 'Guardian'
      const created = await createFamilyCircle(accessToken, circleNameInput.trim(), displayName)
      setSuccessMessage(`Family Circle "${created.name}" created! Invite code: ${created.invite_code}`)
      setShowCreateModal(false)
      setCircleNameInput('')
      await reloadCircles(accessToken, created.id)
    } catch (err) {
      setErrorMessage(err instanceof FamilySafetyApiError ? err.message : 'Could not create family circle.')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleJoinCircle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken || !inviteCodeInput.trim()) return
    setSubmittingAction(true)
    setErrorMessage(null)

    try {
      const displayName = profile?.full_name || user?.user_metadata?.full_name || 'Family Member'
      const joined = await joinFamilyCircle(accessToken, inviteCodeInput.trim(), displayName)
      setSuccessMessage(`Successfully joined ${joined.circle.name}!`)
      setShowJoinModal(false)
      setInviteCodeInput('')
      await reloadCircles(accessToken, joined.circle.id)
    } catch (err) {
      setErrorMessage(err instanceof FamilySafetyApiError ? err.message : 'Could not join family circle.')
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleSelectPreset = (presetIndex: number) => {
    const p = PRESET_THREATS[presetIndex]
    if (!p) return
    setThreatType(p.type)
    setSeverity(p.severity)
    setSummary(p.summary)
    setAdvice(p.advice)
  }

  const handleBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessToken || !selectedCircleId) return
    setBroadcasting(true)
    setErrorMessage(null)

    try {
      const alert = await broadcastCircleAlert(accessToken, selectedCircleId, {
        threatType,
        severity,
        summary,
        advice,
      })
      setSuccessMessage(`Emergency Alert broadcasted: ${alert.threat_type}`)
      if (circleDetails) {
        setCircleDetails({
          ...circleDetails,
          alerts: [alert, ...circleDetails.alerts],
        })
      }
    } catch (err) {
      setErrorMessage(err instanceof FamilySafetyApiError ? err.message : 'Failed to broadcast threat alert.')
    } finally {
      setBroadcasting(false)
    }
  }

  const handleLeaveCircle = async () => {
    if (!accessToken || !selectedCircleId) return
    if (!window.confirm('Are you sure you want to leave this family safety circle?')) return
    setErrorMessage(null)

    try {
      await leaveFamilyCircle(accessToken, selectedCircleId)
      setSuccessMessage('You have left the safety circle.')
      await reloadCircles(accessToken)
    } catch (err) {
      setErrorMessage(err instanceof FamilySafetyApiError ? err.message : 'Failed to leave circle.')
    }
  }

  const activeCircleSummary = circles.find((c) => c.id === selectedCircleId)

  return (
    <div className="family-safety-container">
      <header className="family-header">
        <div className="family-header-content">
          <h1>Family Safety Circles</h1>
          <p>
            Protect your parents, children, and close relatives from Digital Arrest scams,
            unauthorized UPI transfers, and predatory APK malware. Broadcast instant emergency threat alerts
            and safeguard your loved ones together.
          </p>
        </div>
        <div className="family-actions-bar">
          <button
            className="button button-primary"
            onClick={() => setShowCreateModal(true)}
            type="button"
          >
            <Plus size={16} />
            Create Circle
          </button>
          <button
            className="button button-secondary"
            onClick={() => setShowJoinModal(true)}
            type="button"
          >
            <UserPlus size={16} />
            Join with Code
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
          <button
            aria-label="Dismiss error"
            className="banner-close"
            onClick={() => setErrorMessage(null)}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="success-banner" role="status">
          <Check size={18} />
          <span>{successMessage}</span>
          <button
            aria-label="Dismiss success message"
            className="banner-close"
            onClick={() => setSuccessMessage(null)}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="page-loading" role="status">Loading Family Safety Circles…</div>
      ) : circles.length === 0 ? (
        <div className="empty-state-card">
          <Users className="empty-icon" size={48} />
          <h2>No Family Safety Circles Yet</h2>
          <p>
            Create a circle for your family or join an existing one using an invite code (e.g. <code>CS-ABCDEF</code>).
            Circles enable cross-family emergency broadcast alerts and collective digital vigilance.
          </p>
          <div className="empty-actions">
            <button
              className="button button-primary"
              onClick={() => setShowCreateModal(true)}
              type="button"
            >
              <Plus size={16} />
              Create First Family Circle
            </button>
            <button
              className="button button-secondary"
              onClick={() => setShowJoinModal(true)}
              type="button"
            >
              <UserPlus size={16} />
              Join with Code
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Circles Carousel / Selector */}
          <div className="circles-grid">
            {circles.map((c) => (
              <div
                className={`circle-card${c.id === selectedCircleId ? ' active' : ''}`}
                key={c.id}
                onClick={() => setSelectedCircleId(c.id)}
                role="button"
                tabIndex={0}
              >
                <div className="circle-card-header">
                  <div>
                    <h3 className="circle-name">{c.name}</h3>
                    <span className={`role-badge ${c.role}`}>
                      {c.role === 'guardian' ? '★ Guardian' : 'Member'}
                    </span>
                  </div>
                  {c.alertCount > 0 && (
                    <span className="alert-counter-badge" title="Active alerts">
                      {c.alertCount} Alert{c.alertCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="circle-stats-row">
                  <span className="circle-stat">
                    <Users size={14} />
                    {c.memberCount} Member{c.memberCount !== 1 ? 's' : ''}
                  </span>
                  <span className="circle-stat">
                    <Shield size={14} />
                    Code: <strong>{c.invite_code}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Active Circle Workspace */}
          {detailsLoading ? (
            <div className="page-loading" role="status">Loading circle details…</div>
          ) : circleDetails ? (
            <div className="circle-workspace">
              <div className="circle-main-panel">
                {/* Emergency Broadcast Card */}
                <section className="emergency-broadcast-card">
                  <div className="broadcast-top">
                    <h2 className="broadcast-title">
                      <ShieldAlert size={20} />
                      Broadcast Threat Alert to {circleDetails.circle.name}
                    </h2>
                  </div>
                  <p className="description-text">
                    Detected a phone scam, suspicious message, or malicious APK targeting someone in your family?
                    Broadcast an urgent alert to warn all members instantly.
                  </p>

                  <div className="preset-chips-row">
                    <span className="chips-label">Quick Threat Templates:</span>
                    <div className="chips-list">
                      {PRESET_THREATS.map((p, idx) => (
                        <button
                          className="chip-button"
                          key={p.type}
                          onClick={() => handleSelectPreset(idx)}
                          type="button"
                        >
                          {p.type.split('/')[0].trim()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <form className="broadcast-form" onSubmit={handleBroadcastAlert}>
                    <div className="form-group">
                      <label htmlFor="threat-type">Threat Type</label>
                      <input
                        className="form-input"
                        id="threat-type"
                        onChange={(e) => setThreatType(e.target.value)}
                        required
                        type="text"
                        value={threatType}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="severity-select">Severity Level</label>
                      <select
                        className="form-select"
                        id="severity-select"
                        onChange={(e) => setSeverity(e.target.value as 'high' | 'critical')}
                        value={severity}
                      >
                        <option value="critical">Critical (Immediate Financial or Legal Risk)</option>
                        <option value="high">High (Active Phishing or Impersonation Attempt)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="summary-text">Summary of Suspicious Activity</label>
                      <textarea
                        className="form-textarea"
                        id="summary-text"
                        onChange={(e) => setSummary(e.target.value)}
                        required
                        rows={2}
                        value={summary}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="advice-text">Immediate Family Action Required</label>
                      <textarea
                        className="form-textarea"
                        id="advice-text"
                        onChange={(e) => setAdvice(e.target.value)}
                        required
                        rows={2}
                        value={advice}
                      />
                    </div>
                    <div className="broadcast-actions">
                      <button
                        className="button-sos"
                        disabled={broadcasting}
                        type="submit"
                      >
                        <Send size={16} />
                        {broadcasting ? 'Broadcasting…' : 'Broadcast Emergency Alert'}
                      </button>
                    </div>
                  </form>
                </section>

                {/* Threat Alerts Feed */}
                <section className="alerts-feed-card">
                  <h2>Live Circle Threat Alerts ({circleDetails.alerts.length})</h2>
                  {circleDetails.alerts.length === 0 ? (
                    <p className="empty-subtext">No active threats reported in this circle. All clear!</p>
                  ) : (
                    <div className="alerts-feed-list">
                      {circleDetails.alerts.map((alt) => (
                        <article className={`alert-item ${alt.severity}`} key={alt.id}>
                          <div className="alert-item-header">
                            <span className={`alert-type-tag ${alt.severity}`}>
                              <ShieldAlert size={16} />
                              {alt.threat_type}
                            </span>
                            <span className="alert-item-time">
                              {new Date(alt.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="alert-summary">{alt.summary}</p>
                          <div className="alert-advice-box">
                            <strong>Recommended Family Action:</strong> {alt.advice}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Sidebar with Invite Code & Members */}
              <aside className="circle-side-panel">
                <div className="invite-card">
                  <h3>Invite Family Members</h3>
                  <p className="card-subtext">
                    Share this secret invite code with family members to join:
                  </p>
                  <div className="invite-code-pill">
                    <span>{circleDetails.circle.invite_code}</span>
                    <button
                      aria-label="Copy invite code"
                      className="copy-btn"
                      onClick={() => handleCopyInvite(circleDetails.circle.invite_code)}
                      title="Copy invite code"
                      type="button"
                    >
                      {copiedCode ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <a
                    className="button button-secondary whatsapp-btn"
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Join our CyberSaathi AI Family Safety Circle "${circleDetails.circle.name}"! Use invite code: ${circleDetails.circle.invite_code} to receive real-time scam alerts and stay protected.`,
                    )}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink size={15} />
                    Share via WhatsApp
                  </a>
                </div>

                <div className="members-card">
                  <h3>Circle Members ({circleDetails.members.length})</h3>
                  <div className="members-list">
                    {circleDetails.members.map((m) => (
                      <div className="member-item" key={m.id}>
                        <div className="member-info">
                          <span className="member-name">{m.display_name || 'Family Member'}</span>
                          <span className="member-since">
                            Joined {new Date(m.joined_at).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={`role-badge ${m.role}`}>
                          {m.role === 'guardian' ? 'Guardian' : 'Member'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {activeCircleSummary?.role !== 'guardian' && (
                  <button
                    className="button button-danger-outline"
                    onClick={handleLeaveCircle}
                    type="button"
                  >
                    <LogOut size={15} />
                    Leave Circle
                  </button>
                )}
              </aside>
            </div>
          ) : null}
        </>
      )}

      {/* Create Circle Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Family Safety Circle</h3>
              <button
                aria-label="Close dialog"
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCircle}>
              <div className="form-group">
                <label htmlFor="circle-name">Circle Name</label>
                <input
                  autoFocus
                  className="form-input"
                  id="circle-name"
                  onChange={(e) => setCircleNameInput(e.target.value)}
                  placeholder="e.g. Sharma Family Protection Circle"
                  required
                  type="text"
                  value={circleNameInput}
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  className="button button-secondary"
                  onClick={() => setShowCreateModal(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  disabled={submittingAction || !circleNameInput.trim()}
                  type="submit"
                >
                  {submittingAction ? 'Creating…' : 'Create Circle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Circle Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Join Family Safety Circle</h3>
              <button
                aria-label="Close dialog"
                className="modal-close-btn"
                onClick={() => setShowJoinModal(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleJoinCircle}>
              <div className="form-group">
                <label htmlFor="invite-code">Invite Code</label>
                <input
                  autoFocus
                  className="form-input"
                  id="invite-code"
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. CS-9X2M4K"
                  required
                  type="text"
                  value={inviteCodeInput}
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  className="button button-secondary"
                  onClick={() => setShowJoinModal(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  disabled={submittingAction || !inviteCodeInput.trim()}
                  type="submit"
                >
                  {submittingAction ? 'Joining…' : 'Join Circle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
export default FamilySafetyPage
