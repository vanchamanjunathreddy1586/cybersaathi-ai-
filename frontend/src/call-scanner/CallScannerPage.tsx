import { useState, useRef, type ChangeEvent, type FormEvent } from 'react'
import {
  AlertTriangle,
  Download,
  FileAudio,
  FileText,
  History,
  PhoneCall,
  PhoneOff,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  type CallScanResult,
  type CallScanHistoryItem,
  analyzeTranscript,
  analyzeAudio,
  fetchCallScanHistory,
  generateCallReportMarkdown,
  SAMPLE_CALL_TRANSCRIPTS,
  CallScannerApiError,
} from './callScannerApi'
import './call-scanner.css'

export function CallScannerPage() {
  const { session } = useAuth()
  const accessToken = session?.access_token

  const [mode, setMode] = useState<'transcript' | 'audio'>('transcript')
  const [transcript, setTranscript] = useState('')
  const [languageHint, setLanguageHint] = useState<string>('auto')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CallScanResult | null>(null)

  // History Drawer State
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyList, setHistoryList] = useState<CallScanHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSelectSample = (sample: (typeof SAMPLE_CALL_TRANSCRIPTS)[0]) => {
    setMode('transcript')
    setTranscript(sample.text)
    setLanguageHint(sample.language)
    setError(null)
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processSelectedFile(file)
  }

  const processSelectedFile = (file: File) => {
    const validTypes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/x-m4a', 'audio/ogg']
    const hasValidExt = /\.(wav|mp3|m4a|ogg)$/i.test(file.name)

    if (!validTypes.includes(file.type) && !hasValidExt) {
      setError('Please upload a valid audio file (WAV, MP3, M4A, or OGG).')
      return
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('Audio file exceeds the maximum 25MB limit.')
      return
    }

    setError(null)
    setSelectedFile(file)
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl)
    }
    setAudioPreviewUrl(URL.createObjectURL(file))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processSelectedFile(file)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'transcript' && !transcript.trim()) {
      setError('Please enter or paste the call conversation transcript.')
      return
    }

    if (mode === 'audio' && !selectedFile) {
      setError('Please select or drop an audio recording file to analyze.')
      return
    }

    setLoading(true)

    try {
      const hint = languageHint === 'auto' ? undefined : languageHint
      let scanResult: CallScanResult

      if (mode === 'transcript') {
        scanResult = await analyzeTranscript(transcript, hint, accessToken)
      } else {
        scanResult = await analyzeAudio(selectedFile!, hint, accessToken)
      }

      setResult(scanResult)
    } catch (err) {
      if (err instanceof CallScannerApiError) {
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Analysis failed. Please check network connectivity.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setTranscript('')
    setSelectedFile(null)
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl)
      setAudioPreviewUrl(null)
    }
    setResult(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleToggleHistory = async () => {
    const nextState = !historyOpen
    setHistoryOpen(nextState)

    if (nextState && accessToken) {
      setHistoryLoading(true)
      try {
        const history = await fetchCallScanHistory(accessToken)
        setHistoryList(history)
      } catch {
        // history fetch error handled silently or with fallback
      } finally {
        setHistoryLoading(false)
      }
    }
  }

  const handleDownloadReport = () => {
    if (!result) return
    const md = generateCallReportMarkdown(result)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cybersaathi_call_scan_${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="call-scanner-container">
      {/* Page Header */}
      <header className="call-header">
        <div className="call-header-content">
          <h1>Telecom & Voice Scam Call Analyzer</h1>
          <p>
            Real-time forensic detection for phone intimidation, fake CBI / Police Digital Arrest extortion,
            FedEx narcotics parcels, TRAI SIM deactivation threats, and electricity cutoff scams in English, Hindi, and Telugu.
          </p>
        </div>
        <div className="call-header-actions">
          {accessToken && (
            <button
              className="button button-outline"
              type="button"
              onClick={handleToggleHistory}
              aria-label="Toggle Call Scan History"
            >
              <History aria-hidden="true" size={17} />
              Recent Scans
            </button>
          )}
        </div>
      </header>

      {/* History Drawer */}
      {historyOpen && (
        <aside className="history-drawer" aria-label="Scan history">
          <div className="history-drawer-header">
            <h3>Recent Call Audits</h3>
            <button
              className="button button-icon"
              type="button"
              onClick={() => setHistoryOpen(false)}
              aria-label="Close History"
            >
              <X size={18} />
            </button>
          </div>
          {historyLoading ? (
            <p className="status-note">Loading past call scans…</p>
          ) : historyList.length === 0 ? (
            <p className="status-note">No saved call scans yet.</p>
          ) : (
            historyList.map((item) => (
              <div key={item.id} className="history-item-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`verdict-tag ${item.verdict === 'Likely Safe' ? 'safe' : item.verdict === 'Suspicious' ? 'suspicious' : 'scam'}`}>
                    {item.verdict}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  Risk Score: <strong>{item.risk_score}/100</strong> ({item.language_detected.toUpperCase()})
                </div>
                <div style={{ fontSize: '0.775rem', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {item.summary}
                </div>
              </div>
            ))
          )}
        </aside>
      )}

      {/* Sample Vectors Quick Bar */}
      <div className="call-samples-bar">
        <span className="call-samples-label">⚡ Test with realistic India phone fraud vectors:</span>
        <div className="call-samples-chips">
          {SAMPLE_CALL_TRANSCRIPTS.map((sample) => (
            <button
              key={sample.title}
              type="button"
              className="call-sample-chip"
              onClick={() => handleSelectSample(sample)}
            >
              <span>{sample.title}</span>
              <span className="chip-lang">{sample.language}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Input Form */}
      <form className="call-input-card" onSubmit={handleSubmit}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="call-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'transcript'}
              className={`call-mode-tab ${mode === 'transcript' ? 'active' : ''}`}
              onClick={() => setMode('transcript')}
            >
              <FileText size={16} />
              Paste Transcript / Notes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'audio'}
              className={`call-mode-tab ${mode === 'audio' ? 'active' : ''}`}
              onClick={() => setMode('audio')}
            >
              <FileAudio size={16} />
              Upload Audio Recording
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="language-hint" style={{ fontSize: '0.825rem', color: '#94a3b8' }}>Language:</label>
            <select
              id="language-hint"
              className="call-lang-select"
              value={languageHint}
              onChange={(e) => setLanguageHint(e.target.value)}
            >
              <option value="auto">Auto-detect Language</option>
              <option value="en">English</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="te">Telugu (తెలుగు)</option>
            </select>
          </div>
        </div>

        {mode === 'transcript' ? (
          <div>
            <textarea
              className="call-textarea"
              placeholder="Paste call dialogue, voicemail transcript, or what the caller said (e.g. 'This is CBI officer... your Aadhaar has an arrest warrant for drug parcel in Mumbai...')"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={6}
            />
          </div>
        ) : (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".wav,.mp3,.m4a,.ogg,audio/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {!selectedFile ? (
              <div
                className={`call-audio-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                tabIndex={0}
                role="button"
                aria-label="Upload call audio file"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
              >
                <div className="dropzone-icon">
                  <UploadCloud size={28} />
                </div>
                <div className="dropzone-title">Click to upload or drag & drop call recording</div>
                <div className="dropzone-sub">Supported formats: WAV, MP3, M4A, OGG (Max 25MB)</div>
              </div>
            ) : (
              <div className="audio-preview-box">
                <div className="audio-preview-meta">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileAudio size={18} color="#38bdf8" />
                    <strong>{selectedFile.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button-sm button-outline"
                    onClick={() => {
                      setSelectedFile(null)
                      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl)
                      setAudioPreviewUrl(null)
                    }}
                  >
                    Change File
                  </button>
                </div>
                {audioPreviewUrl && (
                  <audio controls className="audio-player" src={audioPreviewUrl}>
                    Your browser does not support audio playback.
                  </audio>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="alert-box error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="call-form-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="submit"
              className="button button-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Analyzing Call Threat Indicators…
                </>
              ) : (
                <>
                  <PhoneCall size={17} />
                  Analyze Call Safety
                </>
              )}
            </button>
            {(transcript || selectedFile || result) && (
              <button
                type="button"
                className="button button-outline"
                onClick={handleReset}
                disabled={loading}
              >
                <RotateCcw size={15} />
                Reset
              </button>
            )}
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Audio processed securely in-memory. Zero surveillance.
          </span>
        </div>
      </form>

      {/* Results View */}
      {result && (
        <section className="call-results-card" aria-label="Call analysis results">
          {/* Urgent Extortion / Digital Arrest Warning */}
          {result.urgentActionRequired && (
            <div className="urgent-banner" role="alert">
              <div className="urgent-icon-wrap">
                <PhoneOff size={28} />
              </div>
              <div className="urgent-copy">
                <h3>⚠️ CRITICAL THREAT: HANG UP IMMEDIATELY</h3>
                <p>
                  This call exhibits characteristic extortion and criminal impersonation markers (e.g. Digital Arrest, fake CBI/Police warrant, or parcel narcotics threats).
                  <strong> Under Indian law, police or courts never conduct trials via video call, nor do they ever ask for money transfer to verify innocence.</strong>
                </p>
                <div className="urgent-badges">
                  <span className="urgent-badge">DO NOT TRANSFER MONEY</span>
                  <span className="urgent-badge">DO NOT INSTALL ANYDESK / TEAMVIEWER</span>
                  <span className="urgent-badge">CALL 1930 CYBER CRIME HELPLINE</span>
                </div>
              </div>
            </div>
          )}

          {/* Top Score Row */}
          <div className="results-top-row">
            <div className="score-display-box">
              <div
                className={`score-circle ${
                  result.verdict === 'Likely Safe' ? 'safe' : result.verdict === 'Suspicious' ? 'suspicious' : 'scam'
                }`}
              >
                <span>{result.riskScore}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>/ 100</span>
              </div>
              <div className="score-meta">
                <h2>{result.verdict}</h2>
                <span
                  className={`verdict-tag ${
                    result.verdict === 'Likely Safe' ? 'safe' : result.verdict === 'Suspicious' ? 'suspicious' : 'scam'
                  }`}
                >
                  Confidence: {result.confidenceScore}% • Language: {result.languageDetected.toUpperCase()}
                </span>
              </div>
            </div>

            <div>
              <button
                type="button"
                className="button button-outline"
                onClick={handleDownloadReport}
              >
                <Download size={16} />
                Export Incident Report (.md)
              </button>
            </div>
          </div>

          {/* Executive Summary */}
          <p className="summary-text">{result.summary}</p>

          {/* Detected Tactics Section */}
          <div className="tactics-section">
            <h3>Detected Modus Operandi & Scam Patterns ({result.tacticsDetected.length})</h3>
            {result.tacticsDetected.length === 0 ? (
              <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.08)', borderRadius: '8px', color: '#4ade80' }}>
                <ShieldCheck size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                No predatory scam scripts or coercion patterns were detected in this sample.
              </div>
            ) : (
              <div className="tactics-grid">
                {result.tacticsDetected.map((tactic) => (
                  <article key={tactic.id} className="tactic-card">
                    <div className="tactic-header">
                      <div className="tactic-title">
                        <ShieldAlert size={18} />
                        {tactic.name}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Category: {tactic.category} ({tactic.confidence}% match)
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>
                      {tactic.description}
                    </p>
                    {tactic.evidenceQuotes.length > 0 && (
                      <div className="tactic-evidence">
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Flagged phrases:</span>
                        {tactic.evidenceQuotes.map((q, i) => (
                          <span key={i} className="evidence-quote-badge">
                            &ldquo;{q}&rdquo;
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="tactic-mitigation">
                      <strong>Countermeasure:</strong> {tactic.mitigation}
                      {tactic.legalReference && (
                        <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.8rem', color: '#93c5fd' }}>
                          Law: {tactic.legalReference}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Safety Recommendations */}
          <div>
            <h3 style={{ fontSize: '1.1rem', color: '#f1f5f9', margin: '0 0 0.75rem 0' }}>Immediate Safety Action Steps</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#cbd5e1', lineHeight: '1.7' }}>
              {result.safetyGuidance.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>
          </div>

          {/* Emergency Helplines */}
          <div>
            <h3 style={{ fontSize: '1.1rem', color: '#f1f5f9', margin: '0 0 0.75rem 0' }}>Official Indian Emergency Contacts</h3>
            <div className="emergency-contacts-grid">
              {result.emergencyContacts.map((contact) => (
                <div key={contact.title} className="emergency-contact-card">
                  <div className="emergency-contact-header">
                    <span className="emergency-contact-title">{contact.title}</span>
                    <a href={`tel:${contact.number}`} className="emergency-contact-number">
                      {contact.number}
                    </a>
                  </div>
                  <p className="emergency-contact-desc">{contact.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
