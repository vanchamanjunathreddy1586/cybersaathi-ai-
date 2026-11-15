import { useState, useEffect, useMemo, type FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileCheck,
  FileText,
  FolderPlus,
  PhoneCall,
  Printer,
  Search,
  Shield,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  fetchRecoveryVectors,
  fetchRecoveryVector,
  fetchEmergencyDirectory,
  draftPoliceComplaint,
  bridgeRecoveryToInvestigation,
  type VectorSummary,
  type FraudVector,
  type EmergencyDirectory,
  type ComplaintDraftResult,
} from './recoveryApi'
import './recovery.css'

export function FraudRecoveryPage() {
  const { session, profile, user } = useAuth()
  const [activeTab, setActiveTab] = useState<'vectors' | 'checklist' | 'complaint' | 'directory' | 'rbi'>('vectors')
  const [vectors, setVectors] = useState<VectorSummary[]>([])
  const [selectedVectorId, setSelectedVectorId] = useState<string>('upi-fraud')
  const [selectedVector, setSelectedVector] = useState<FraudVector | null>(null)
  const [directory, setDirectory] = useState<EmergencyDirectory | null>(null)
  const [loading, setLoading] = useState(true)
  const [vectorLoading, setVectorLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Checklist state stored in localStorage
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('cybersaathi_recovery_steps')
      return saved ? (JSON.parse(saved) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })

  // Complaint Form state
  const [victimName, setVictimName] = useState(profile?.full_name || user?.user_metadata?.full_name || '')
  const [victimPhone, setVictimPhone] = useState('')
  const [victimEmail, setVictimEmail] = useState(profile?.email || user?.email || '')
  const [victimAddress, setVictimAddress] = useState('')
  const [cityState, setCityState] = useState('')
  const [policeStation, setPoliceStation] = useState('Cyber Crime Police Station')
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().split('T')[0] ?? '')
  const [incidentTime, setIncidentTime] = useState('10:00 AM')
  const [lossAmountInr, setLossAmountInr] = useState<string>('')
  const [bankName, setBankName] = useState('')
  const [accountNumberLast4, setAccountNumberLast4] = useState('')
  const [transactionIdUtr, setTransactionIdUtr] = useState('')
  const [accusedIdentifier, setAccusedIdentifier] = useState('')
  const [cybercrimeAckNumber, setCybercrimeAckNumber] = useState('')
  const [incidentChronology, setIncidentChronology] = useState('')
  const [selectedEvidenceItems, setSelectedEvidenceItems] = useState<string[]>([])
  const [customEvidence, setCustomEvidence] = useState('')

  // Draft generation state
  const [draftResult, setDraftResult] = useState<ComplaintDraftResult | null>(null)
  const [draftBusy, setDraftBusy] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [bridgeBusy, setBridgeBusy] = useState(false)
  const [bridgeSuccess, setBridgeSuccess] = useState<string | null>(null)

  // Bank directory search
  const [bankSearchQuery, setBankSearchQuery] = useState('')

  // Load initial vectors and directory
  useEffect(() => {
    let active = true
    async function loadData() {
      try {
        setLoading(true)
        const [vecs, dir] = await Promise.all([
          fetchRecoveryVectors(),
          fetchEmergencyDirectory(),
        ])
        if (active) {
          setVectors(vecs)
          setDirectory(dir)
          setError(null)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load recovery guides.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadData()
    return () => {
      active = false
    }
  }, [])

  // Load vector detail when selection changes
  useEffect(() => {
    let active = true
    async function loadVectorDetail() {
      if (!selectedVectorId) return
      try {
        setVectorLoading(true)
        const vec = await fetchRecoveryVector(selectedVectorId)
        if (active) {
          setSelectedVector(vec)
          if (vec.evidenceToCollect) {
            setSelectedEvidenceItems((prev) =>
              prev.length === 0 ? vec.evidenceToCollect.slice(0, 3) : prev,
            )
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load vector detail.')
        }
      } finally {
        if (active) setVectorLoading(false)
      }
    }
    void loadVectorDetail()
    return () => {
      active = false
    }
  }, [selectedVectorId])

  // Sync checklist progress with localStorage
  const toggleStep = (stepId: string) => {
    setCheckedSteps((prev) => {
      const updated = { ...prev, [stepId]: !prev[stepId] }
      try {
        localStorage.setItem('cybersaathi_recovery_steps', JSON.stringify(updated))
      } catch {
        // storage quota exceeded or private browsing
      }
      return updated
    })
  }

  // Handle Evidence selection toggle
  const toggleEvidenceItem = (item: string) => {
    setSelectedEvidenceItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    )
  }

  const addCustomEvidence = () => {
    if (!customEvidence.trim()) return
    setSelectedEvidenceItems((prev) => [...prev, customEvidence.trim()])
    setCustomEvidence('')
  }

  // Handle complaint drafting submission
  const handleDraftSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (draftBusy) return
    setDraftBusy(true)
    setDraftError(null)
    setBridgeSuccess(null)

    try {
      const parsedLoss = lossAmountInr.trim() ? parseFloat(lossAmountInr) : undefined
      const draft = await draftPoliceComplaint({
        victimName,
        victimPhone,
        victimEmail,
        victimAddress,
        cityState,
        policeStation: policeStation.trim() || undefined,
        incidentDate,
        incidentTime,
        vectorId: selectedVectorId,
        lossAmountInr: parsedLoss,
        bankName: bankName.trim() || undefined,
        accountNumberLast4: accountNumberLast4.trim() || undefined,
        transactionIdUtr: transactionIdUtr.trim() || undefined,
        accusedIdentifier: accusedIdentifier.trim() || undefined,
        cybercrimeAckNumber: cybercrimeAckNumber.trim() || undefined,
        incidentChronology,
        evidenceList: selectedEvidenceItems.length > 0 ? selectedEvidenceItems : ['Transaction bank debit statement'],
      })
      setDraftResult(draft)
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Failed to draft complaint.')
    } finally {
      setDraftBusy(false)
    }
  }

  const handleCopyText = async () => {
    if (!draftResult) return
    try {
      await navigator.clipboard.writeText(draftResult.formattedText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // clipboard write failed
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleBridgeInvestigation = async () => {
    if (!draftResult || !session?.access_token || bridgeBusy) return
    setBridgeBusy(true)
    setBridgeSuccess(null)
    try {
      const parsedLoss = lossAmountInr.trim() ? parseFloat(lossAmountInr) : undefined
      const res = await bridgeRecoveryToInvestigation(session.access_token, {
        vectorId: selectedVectorId,
        lossAmountInr: parsedLoss,
        complaintText: draftResult.formattedText,
        transactionIdUtr: transactionIdUtr.trim() || undefined,
        evidenceCount: draftResult.annexures.length,
      })
      setBridgeSuccess(`Case bridged successfully! Case ID: ${res.id}`)
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Failed to bridge case to investigations.')
    } finally {
      setBridgeBusy(false)
    }
  }

  // Filtered bank contacts
  const filteredBanks = useMemo(() => {
    if (!directory?.bankContacts) return []
    if (!bankSearchQuery.trim()) return directory.bankContacts
    const q = bankSearchQuery.toLowerCase()
    return directory.bankContacts.filter(
      (b) =>
        b.bankName.toLowerCase().includes(q) ||
        b.tollFree.toLowerCase().includes(q) ||
        (b.smsBlockCommand && b.smsBlockCommand.toLowerCase().includes(q)),
    )
  }, [directory, bankSearchQuery])

  return (
    <div className="recovery-container">
      {/* Critical Emergency Helpline Banner */}
      <section className="recovery-emergency-banner" aria-label="Critical Emergency Helplines">
        <div className="emergency-banner-content">
          <div className="emergency-banner-icon" aria-hidden="true">
            <Zap size={26} />
          </div>
          <div className="emergency-banner-text">
            <h2>Financial Fraud Golden Hour in Progress?</h2>
            <p>
              Report unauthorized UPI, card, or banking debits immediately to freeze funds before mule cash-out.
            </p>
          </div>
        </div>
        <div className="emergency-banner-actions">
          <a className="btn-dial-1930" href="tel:1930">
            <PhoneCall size={18} />
            Dial 1930 Helpline
          </a>
          <a
            className="btn-outline-portal"
            href="https://cybercrime.gov.in"
            rel="noopener noreferrer"
            target="_blank"
          >
            cybercrime.gov.in
            <ExternalLink size={14} />
          </a>
        </div>
      </section>

      {/* Tabs */}
      <nav aria-label="Recovery Sections" className="recovery-tabs">
        <button
          className={`recovery-tab-btn ${activeTab === 'vectors' ? 'active' : ''}`}
          onClick={() => setActiveTab('vectors')}
          type="button"
        >
          <ShieldAlert size={17} />
          Fraud Vectors
        </button>
        <button
          className={`recovery-tab-btn ${activeTab === 'checklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('checklist')}
          type="button"
        >
          <CheckCircle2 size={17} />
          Golden Hour Checklist
        </button>
        <button
          className={`recovery-tab-btn ${activeTab === 'complaint' ? 'active' : ''}`}
          onClick={() => setActiveTab('complaint')}
          type="button"
        >
          <FileText size={17} />
          Draft Police FIR / Complaint
        </button>
        <button
          className={`recovery-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
          type="button"
        >
          <PhoneCall size={17} />
          Emergency Bank Numbers
        </button>
        <button
          className={`recovery-tab-btn ${activeTab === 'rbi' ? 'active' : ''}`}
          onClick={() => setActiveTab('rbi')}
          type="button"
        >
          <Building size={17} />
          RBI Ombudsman & Zero Liability
        </button>
      </nav>

      {error && (
        <div className="profile-warning" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="page-loading" role="status">
          Loading recovery framework & legal guidance…
        </div>
      )}

      {/* TAB 1: FRAUD VECTORS */}
      {!loading && activeTab === 'vectors' && (
        <section aria-labelledby="vectors-heading">
          <div className="section-heading" style={{ marginBottom: 16 }}>
            <div>
              <p className="eyebrow">9 MAJOR INDIAN CYBERCRIME SCENARIOS</p>
              <h2 id="vectors-heading" style={{ fontSize: '1.4rem', color: '#fff', margin: '4px 0' }}>
                Select Your Fraud Incident Vector
              </h2>
            </div>
            <span className="section-note">Immediate Incident Response</span>
          </div>

          <div className="recovery-vector-grid">
            {vectors.map((vec) => (
              <article
                className={`recovery-vector-card ${selectedVectorId === vec.id ? 'selected' : ''}`}
                key={vec.id}
                onClick={() => {
                  setSelectedVectorId(vec.id)
                  setActiveTab('checklist')
                }}
              >
                <div>
                  <div className="vector-card-top">
                    <span className={`vector-urgency-badge ${vec.urgencyLevel.toLowerCase()}`}>
                      {vec.urgencyLevel}
                    </span>
                    <span className="vector-timer-chip">
                      <Clock size={13} />
                      {vec.goldenHourMinutes} min Golden Hour
                    </span>
                  </div>
                  <h3>{vec.title}</h3>
                  <p>{vec.shortDescription}</p>
                </div>
                <div className="vector-card-footer">
                  <span>{vec.totalChecklistSteps} Action Steps</span>
                  <span className="vector-action-link">
                    Start Recovery Plan <ArrowRight size={14} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* TAB 2: GOLDEN HOUR CHECKLIST */}
      {!loading && activeTab === 'checklist' && (
        <section aria-labelledby="checklist-heading" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {selectedVector && (
            <div className="recovery-detail-header">
              <div className="recovery-detail-title-block">
                <span className="eyebrow">{selectedVector.category.toUpperCase()}</span>
                <h2 id="checklist-heading">{selectedVector.title}</h2>
                <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.92rem' }}>
                  {selectedVector.shortDescription}
                </p>
              </div>
              <div className="recovery-golden-window-box">
                <Clock color="var(--amber)" size={24} />
                <div>
                  <div className="golden-window-label">Golden Hour Limit</div>
                  <div className="golden-window-time">{selectedVector.goldenHourMinutes} Minutes</div>
                </div>
              </div>
            </div>
          )}

          {vectorLoading && <p className="profile-loading">Loading vector guidance…</p>}

          {selectedVector && (
            <>
              <div className="checklist-section">
                <h3 style={{ color: '#fff', fontSize: '1.1rem', margin: '4px 0 10px' }}>
                  Immediate Action Checklist (Tick off as you complete)
                </h3>
                {selectedVector.goldenHourChecklist.map((step) => {
                  const isChecked = Boolean(checkedSteps[step.id])
                  return (
                    <div className={`checklist-step-item ${isChecked ? 'completed' : ''}`} key={step.id}>
                      <div className="checklist-checkbox-wrapper">
                        <input
                          aria-label={`Step ${step.order}: ${step.action}`}
                          checked={isChecked}
                          id={step.id}
                          onChange={() => toggleStep(step.id)}
                          type="checkbox"
                        />
                      </div>
                      <div className="checklist-step-body">
                        <div className="step-header-row">
                          <span className="step-order-badge">STEP {step.order}</span>
                          <label className="step-title" htmlFor={step.id} style={{ cursor: 'pointer' }}>
                            {step.action}
                          </label>
                          <span className="step-authority">{step.authority}</span>
                        </div>
                        <p className="step-detail">{step.detail}</p>
                        {step.tip && (
                          <div className="step-tip">
                            <Zap size={14} />
                            <span>{step.tip}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Secondary Details: Evidence, Legal & Official Portals */}
              <div className="recovery-secondary-grid">
                <div className="recovery-panel">
                  <h3>
                    <FileCheck color="var(--green)" size={18} />
                    Critical Evidence to Collect
                  </h3>
                  <div className="evidence-list">
                    {selectedVector.evidenceToCollect.map((ev, idx) => (
                      <div className="evidence-item" key={idx}>
                        <CheckCircle2 color="var(--green)" size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="recovery-panel">
                  <h3>
                    <ExternalLink color="var(--cyan)" size={18} />
                    Official Reporting Portals
                  </h3>
                  <div className="portal-list">
                    {selectedVector.officialPortals.map((p, idx) => (
                      <div className="portal-item" key={idx}>
                        <a href={p.url} rel="noopener noreferrer" target="_blank">
                          {p.name}
                          <ExternalLink size={13} />
                        </a>
                        <span className="portal-purpose">{p.purpose}</span>
                        {p.contact && <span style={{ fontSize: '0.8rem', color: 'var(--amber)' }}>{p.contact}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="recovery-panel">
                  <h3>
                    <BookOpen color="var(--violet)" size={18} />
                    Applicable Indian Legal Sections
                  </h3>
                  <div className="legal-list">
                    {selectedVector.legalSections.map((sec, idx) => (
                      <div className="legal-item" key={idx}>
                        <div className="legal-code">{sec.code} ({sec.act})</div>
                        <div className="legal-title">{sec.title}</div>
                        <div className="legal-penalty">{sec.penalty}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <button
                  className="button button-primary"
                  onClick={() => setActiveTab('complaint')}
                  type="button"
                >
                  <FileText size={16} />
                  Proceed to Draft Formal Police FIR Complaint
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* TAB 3: DRAFT POLICE FIR / COMPLAINT */}
      {!loading && activeTab === 'complaint' && (
        <section aria-labelledby="complaint-heading" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="section-heading" style={{ marginBottom: 8 }}>
            <div>
              <p className="eyebrow">FORMAL LEGAL REPRESENTATION GENERATOR</p>
              <h2 id="complaint-heading" style={{ fontSize: '1.4rem', color: '#fff', margin: '4px 0' }}>
                Draft Formal Cyber Crime Police Complaint / FIR
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
                Generates a structured, legally robust representation for the Cyber Crime Police Station or cybercrime.gov.in referencing BNS 2023 & IT Act 2000.
              </p>
            </div>
          </div>

          <form className="complaint-drafter-form recovery-panel" onSubmit={(e) => void handleDraftSubmit(e)}>
            <div className="form-grid-3">
              <div className="form-field">
                <label htmlFor="victimName">Your Full Name *</label>
                <input
                  id="victimName"
                  onChange={(e) => setVictimName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  required
                  value={victimName}
                />
              </div>
              <div className="form-field">
                <label htmlFor="victimPhone">Mobile Number *</label>
                <input
                  id="victimPhone"
                  onChange={(e) => setVictimPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  required
                  value={victimPhone}
                />
              </div>
              <div className="form-field">
                <label htmlFor="victimEmail">Email Address *</label>
                <input
                  id="victimEmail"
                  onChange={(e) => setVictimEmail(e.target.value)}
                  placeholder="e.g. ramesh@example.com"
                  required
                  type="email"
                  value={victimEmail}
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-field">
                <label htmlFor="victimAddress">Residential Address *</label>
                <input
                  id="victimAddress"
                  onChange={(e) => setVictimAddress(e.target.value)}
                  placeholder="House/Flat number, Street name, Area"
                  required
                  value={victimAddress}
                />
              </div>
              <div className="form-field">
                <label htmlFor="cityState">City & State *</label>
                <input
                  id="cityState"
                  onChange={(e) => setCityState(e.target.value)}
                  placeholder="e.g. Bengaluru, Karnataka"
                  required
                  value={cityState}
                />
              </div>
              <div className="form-field">
                <label htmlFor="policeStation">Target Police / Cyber Station</label>
                <input
                  id="policeStation"
                  onChange={(e) => setPoliceStation(e.target.value)}
                  placeholder="e.g. Cyber Crime Police Station"
                  value={policeStation}
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-field">
                <label htmlFor="vectorSelect">Fraud Category *</label>
                <select
                  id="vectorSelect"
                  onChange={(e) => setSelectedVectorId(e.target.value)}
                  value={selectedVectorId}
                >
                  {vectors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="incidentDate">Date of Incident *</label>
                <input
                  id="incidentDate"
                  onChange={(e) => setIncidentDate(e.target.value)}
                  required
                  type="date"
                  value={incidentDate}
                />
              </div>
              <div className="form-field">
                <label htmlFor="incidentTime">Approximate Time *</label>
                <input
                  id="incidentTime"
                  onChange={(e) => setIncidentTime(e.target.value)}
                  placeholder="e.g. 02:30 PM"
                  required
                  value={incidentTime}
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-field">
                <label htmlFor="lossAmount">Defrauded Amount (in INR ₹)</label>
                <input
                  id="lossAmount"
                  min="0"
                  onChange={(e) => setLossAmountInr(e.target.value)}
                  placeholder="e.g. 50000"
                  step="any"
                  type="number"
                  value={lossAmountInr}
                />
              </div>
              <div className="form-field">
                <label htmlFor="bankName">Your Bank Name</label>
                <input
                  id="bankName"
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India"
                  value={bankName}
                />
              </div>
              <div className="form-field">
                <label htmlFor="accountNumberLast4">Debited Account (Last 4 Digits)</label>
                <input
                  id="accountNumberLast4"
                  maxLength={4}
                  onChange={(e) => setAccountNumberLast4(e.target.value)}
                  placeholder="e.g. 4321"
                  value={accountNumberLast4}
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-field">
                <label htmlFor="transactionUtr">Transaction ID / UPI UTR / RRN</label>
                <input
                  id="transactionUtr"
                  onChange={(e) => setTransactionIdUtr(e.target.value)}
                  placeholder="e.g. 431982716251"
                  value={transactionIdUtr}
                />
              </div>
              <div className="form-field">
                <label htmlFor="accusedIdentifier">Accused Phone / VPA / Account</label>
                <input
                  id="accusedIdentifier"
                  onChange={(e) => setAccusedIdentifier(e.target.value)}
                  placeholder="e.g. fraudster@paytm / +91 9988776655"
                  value={accusedIdentifier}
                />
              </div>
              <div className="form-field">
                <label htmlFor="cybercrimeAckNumber">1930 / NCRP Acknowledgment No.</label>
                <input
                  id="cybercrimeAckNumber"
                  onChange={(e) => setCybercrimeAckNumber(e.target.value)}
                  placeholder="e.g. NCRP20261114001"
                  value={cybercrimeAckNumber}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="chronology">
                Detailed Chronology of Events * (Describe how the fraudster contacted you and what happened)
              </label>
              <textarea
                id="chronology"
                onChange={(e) => setIncidentChronology(e.target.value)}
                placeholder="Write chronological sequence: 1. I received an SMS/call on [date] claiming... 2. The fraudster instructed me to... 3. An unauthorized debit of Rs. ... occurred with UTR..."
                required
                rows={4}
                value={incidentChronology}
              />
            </div>

            {/* Evidence items */}
            <div className="form-field">
              <label>Evidence Items to Annex with Complaint:</label>
              {selectedVector?.evidenceToCollect && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '6px 0' }}>
                  {selectedVector.evidenceToCollect.map((ev, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
                      <input
                        checked={selectedEvidenceItems.includes(ev)}
                        onChange={() => toggleEvidenceItem(ev)}
                        type="checkbox"
                      />
                      <span>{ev}</span>
                    </label>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input
                  onChange={(e) => setCustomEvidence(e.target.value)}
                  placeholder="Add additional evidence item (e.g. Voice call recording)"
                  style={{ flexGrow: 1 }}
                  value={customEvidence}
                />
                <button
                  className="button"
                  onClick={addCustomEvidence}
                  style={{ padding: '8px 14px' }}
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>

            {draftError && (
              <p className="profile-warning" role="alert">
                {draftError}
              </p>
            )}

            <button
              className="btn-generate-complaint"
              disabled={draftBusy}
              type="submit"
            >
              <FileCheck size={18} />
              {draftBusy ? 'Generating Formal Complaint…' : 'Generate Formal Legal Complaint Draft'}
            </button>
          </form>

          {/* DRAFT OUTPUT DISPLAY */}
          {draftResult && (
            <div className="complaint-output-card" id="printable-complaint">
              <div className="complaint-actions-bar">
                <button className="complaint-action-btn" onClick={() => void handleCopyText()} type="button">
                  <Copy size={15} />
                  {copied ? 'Copied to Clipboard!' : 'Copy Complaint'}
                </button>
                <button className="complaint-action-btn" onClick={handlePrint} type="button">
                  <Printer size={15} />
                  Print / Save as PDF
                </button>
                {session?.access_token && (
                  <button
                    className="complaint-action-btn btn-bridge"
                    disabled={bridgeBusy}
                    onClick={() => void handleBridgeInvestigation()}
                    type="button"
                  >
                    <FolderPlus size={15} />
                    {bridgeBusy ? 'Bridging…' : 'Save to Investigation Room'}
                  </button>
                )}
              </div>

              {bridgeSuccess && (
                <div className="security-success" role="status" style={{ marginBottom: 16 }}>
                  <CheckCircle2 size={16} />
                  <span>{bridgeSuccess}</span>
                </div>
              )}

              <pre className="complaint-text-display">{draftResult.formattedText}</pre>
            </div>
          )}
        </section>
      )}

      {/* TAB 4: BANK DIRECTORY */}
      {!loading && activeTab === 'directory' && (
        <section aria-labelledby="directory-heading" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section-heading" style={{ marginBottom: 4 }}>
            <div>
              <p className="eyebrow">24X7 INDIAN BANKING FRAUD HELPLINES</p>
              <h2 id="directory-heading" style={{ fontSize: '1.4rem', color: '#fff', margin: '4px 0' }}>
                Bank Fraud Desks & SMS Card Blocking Commands
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
                Call immediately to freeze debit cards, UPI profiles, and accounts before unauthorized funds leave the banking switch.
              </p>
            </div>
          </div>

          <div className="bank-search-bar">
            <Search color="var(--muted)" size={18} />
            <input
              aria-label="Search Bank Name"
              onChange={(e) => setBankSearchQuery(e.target.value)}
              placeholder="Search by bank name (e.g. State Bank of India, HDFC, ICICI)…"
              value={bankSearchQuery}
            />
          </div>

          <div className="recovery-panel" style={{ overflowX: 'auto', padding: 0 }}>
            <table className="bank-table">
              <thead>
                <tr>
                  <th>Bank Name</th>
                  <th>24x7 Emergency Toll-Free</th>
                  <th>Alternate Hotline</th>
                  <th>SMS Hotlist / Block Command</th>
                  <th>Official Site</th>
                </tr>
              </thead>
              <tbody>
                {filteredBanks.map((bank, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{bank.bankName}</strong>
                    </td>
                    <td>
                      <a className="bank-toll-link" href={`tel:${bank.tollFree.split('/')[0]?.trim() || ''}`}>
                        {bank.tollFree}
                      </a>
                    </td>
                    <td>{bank.alternateNumber || '—'}</td>
                    <td>
                      {bank.smsBlockCommand ? (
                        <div>
                          <span className="bank-sms-code">{bank.smsBlockCommand}</span>
                          {bank.smsBlockNumber && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: 6 }}>
                              to {bank.smsBlockNumber}
                            </span>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {bank.portalUrl ? (
                        <a href={bank.portalUrl} rel="noopener noreferrer" style={{ color: 'var(--cyan)' }} target="_blank">
                          Visit <ExternalLink size={12} style={{ display: 'inline' }} />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 5: RBI OMBUDSMAN & ZERO LIABILITY */}
      {!loading && activeTab === 'rbi' && (
        <section aria-labelledby="rbi-heading" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="section-heading" style={{ marginBottom: 4 }}>
            <div>
              <p className="eyebrow">REGULATORY ESCALATION & LEGAL RIGHTS</p>
              <h2 id="rbi-heading" style={{ fontSize: '1.4rem', color: '#fff', margin: '4px 0' }}>
                RBI Ombudsman Escalation Matrix & Zero Customer Liability
              </h2>
            </div>
          </div>

          <div className="recovery-panel" style={{ borderLeft: '4px solid var(--green)' }}>
            <h3 style={{ color: 'var(--green)' }}>
              <Shield size={18} />
              RBI Zero Customer Liability Rule Explained
            </h3>
            <p style={{ color: 'var(--text)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
              Under Reserve Bank of India circular <strong>DBR.No.Leg.BC.78/09.07.005/2017-18</strong>, customer liability in unauthorized electronic banking transactions is governed by specific timelines:
            </p>
            <ul style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.6, marginTop: 8 }}>
              <li>
                <strong>Zero Liability:</strong> If the fraud occurred due to contributory negligence/deficiency on the part of the bank, OR a third-party breach where neither the bank nor the customer is at fault, and you notify the bank within <strong>3 working days</strong> of receiving communication.
              </li>
              <li>
                <strong>Limited Liability:</strong> If reported between 4 to 7 working days, customer liability is capped at ₹5,000 to ₹25,000 depending on account type.
              </li>
              <li>
                <strong>Customer Negligence:</strong> In cases where loss is due to negligence by the customer (such as sharing OTP or PIN), customer bears the entire loss until reported to the bank.
              </li>
            </ul>
          </div>

          <div className="recovery-panel">
            <h3>
              <Building size={18} />
              4-Tier Bank Escalation Ladder
            </h3>
            <div className="rbi-ladder">
              <div className="rbi-step">
                <span className="rbi-step-number">1</span>
                <div className="rbi-step-content">
                  <h4>Tier 1: Branch Manager & Bank 24x7 Fraud Desk</h4>
                  <p>
                    Lodge immediate written complaint with your home branch manager and call center. Obtain an official written acknowledgment with a Ticket / Service Request Number.
                  </p>
                  <span className="rbi-step-sla">SLA: Wait up to 14 days for bank response</span>
                </div>
              </div>

              <div className="rbi-step">
                <span className="rbi-step-number">2</span>
                <div className="rbi-step-content">
                  <h4>Tier 2: Bank Nodal Officer (Grievance Redressal)</h4>
                  <p>
                    If the branch does not resolve your dispute or rejects your chargeback unfairly, escalate to your bank’s Regional Nodal Officer with your Tier 1 ticket number.
                  </p>
                  <span className="rbi-step-sla">SLA: Wait 7 days</span>
                </div>
              </div>

              <div className="rbi-step">
                <span className="rbi-step-number">3</span>
                <div className="rbi-step-content">
                  <h4>Tier 3: Bank Principal Nodal Officer (PNO)</h4>
                  <p>
                    Escalate to the bank’s Principal Nodal Officer at the bank’s headquarters. PNO contact details are mandatorily published on each bank’s official website.
                  </p>
                  <span className="rbi-step-sla">SLA: Wait up to Day 30</span>
                </div>
              </div>

              <div className="rbi-step" style={{ borderLeft: '3px solid var(--amber)' }}>
                <span className="rbi-step-number" style={{ background: 'rgba(242, 200, 121, 0.2)', color: 'var(--amber)' }}>
                  4
                </span>
                <div className="rbi-step-content">
                  <h4 style={{ color: 'var(--amber)' }}>
                    Tier 4: Reserve Bank of India (RBI) Ombudsman under CMS
                  </h4>
                  <p>
                    If the bank fails to resolve your complaint within 30 days or rejects it without valid justification, file a complaint directly on the RBI Complaint Management System (CMS) at{' '}
                    <a href="https://cms.rbi.org.in" rel="noopener noreferrer" style={{ color: 'var(--cyan)' }} target="_blank">
                      cms.rbi.org.in
                    </a>{' '}
                    or call toll-free <strong>14448</strong>. The Ombudsman has statutory authority under the RBI Integrated Ombudsman Scheme, 2021 to award compensation up to ₹20 Lakhs plus ₹1 Lakh for mental harassment.
                  </p>
                  <span className="rbi-step-sla" style={{ color: 'var(--green)', background: 'rgba(111, 224, 175, 0.1)' }}>
                    Statutory Redressal by RBI Ombudsman
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
export default FraudRecoveryPage
