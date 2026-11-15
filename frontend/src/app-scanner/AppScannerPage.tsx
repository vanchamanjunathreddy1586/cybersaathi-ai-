import { useState, useRef, type ChangeEvent, type DragEvent } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileCheck,
  FileCode2,
  HardDrive,
  Lock,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UploadCloud,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import {
  uploadAndAnalyzeApk,
  fetchUserAppScans,
  fetchAppScanById,
  generateReportMarkdown,
  type ApkSecurityReport,
  type AppScanHistoryItem,
  type PermissionCategory,
} from './appScannerApi'
import './app-scanner.css'

export function AppScannerPage() {
  const { session } = useAuth()
  const accessToken = session?.access_token

  // Upload & File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [consentThreatIntel, setConsentThreatIntel] = useState(true)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Status & Results
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ApkSecurityReport | null>(null)

  // Permission Filtering & Search
  const [permSearch, setPermSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL')
  const [expandedPerms, setExpandedPerms] = useState<Record<string, boolean>>({})

  // History Drawer State
  const [showHistory, setShowHistory] = useState(false)
  const [historyList, setHistoryList] = useState<AppScanHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // Load history when drawer opens and user is logged in
  const handleToggleHistory = () => {
    const nextState = !showHistory
    setShowHistory(nextState)
    if (nextState && accessToken) {
      setHistoryLoading(true)
      fetchUserAppScans(accessToken)
        .then((items) => setHistoryList(items))
        .catch(() => setHistoryList([]))
        .finally(() => setHistoryLoading(false))
    }
  }

  // File Drag & Drop handlers
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const validateAndSetFile = (file: File) => {
    setError(null)
    const lowerName = file.name.toLowerCase()
    if (!lowerName.endsWith('.apk')) {
      setError('Please select a valid Android Application Package (.apk) file.')
      return
    }
    const maxSizeBytes = 35 * 1024 * 1024 // 35 MB
    if (file.size > maxSizeBytes) {
      setError(`The selected file (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 35 MB upload limit.`)
      return
    }
    setSelectedFile(file)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  // Start analysis
  const handleAnalyze = async () => {
    if (!selectedFile) return
    setIsAnalyzing(true)
    setError(null)

    try {
      const data = await uploadAndAnalyzeApk(selectedFile, consentThreatIntel, accessToken)
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during APK analysis.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Select historical scan
  const handleSelectHistoryScan = async (scanId: string) => {
    if (!accessToken) return
    setIsAnalyzing(true)
    setError(null)
    setShowHistory(false)
    try {
      const fullReport = await fetchAppScanById(scanId, accessToken)
      setReport(fullReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load past scan.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Copy Markdown Report to Clipboard
  const handleCopyReport = () => {
    if (!report) return
    const md = generateReportMarkdown(report)
    navigator.clipboard.writeText(md).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2500)
    })
  }

  // Download Markdown Report File
  const handleDownloadReport = () => {
    if (!report) return
    const md = generateReportMarkdown(report)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `CyberSaathi_AppSecurity_${report.packageName}_${Date.now()}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Reset to analyze another app
  const handleReset = () => {
    setSelectedFile(null)
    setReport(null)
    setError(null)
    setExpandedPerms({})
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Toggle permission detail card
  const togglePerm = (permName: string) => {
    setExpandedPerms((prev) => ({
      ...prev,
      [permName]: !prev[permName],
    }))
  }

  // Filter declared permissions
  const filteredPermissions = (report?.declaredPermissions || []).filter((p) => {
    const matchesSearch =
      permSearch.trim() === '' ||
      p.shortName.toLowerCase().includes(permSearch.toLowerCase()) ||
      p.permission.toLowerCase().includes(permSearch.toLowerCase()) ||
      p.explanation.toLowerCase().includes(permSearch.toLowerCase())
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory
    const matchesSeverity = selectedSeverity === 'ALL' || p.severity.toLowerCase() === selectedSeverity.toLowerCase()
    return matchesSearch && matchesCategory && matchesSeverity
  })

  // Extract unique categories from report
  const availableCategories = Array.from(
    new Set((report?.declaredPermissions || []).map((p) => p.category)),
  ) as PermissionCategory[]

  // Score styling helpers
  const getRiskClass = (score: number) => {
    if (score >= 75) return 'critical'
    if (score >= 50) return 'high'
    if (score >= 25) return 'medium'
    return 'low'
  }

  const scoreClass = report ? getRiskClass(report.riskScore) : 'low'

  // Gauge circumference math (r=68 => circumference approx 427.25)
  const radius = 68
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = report
    ? circumference - (report.riskScore / 100) * circumference
    : circumference

  return (
    <div className="app-scanner-container">
      {/* Header */}
      <header className="app-scanner-header">
        <div className="app-scanner-header-top">
          <div className="app-scanner-title-group">
            <span className="app-scanner-icon-badge">
              <Smartphone size={24} />
            </span>
            <div>
              <h1>Mobile APK & App Permission Analyzer</h1>
              <p>
                Static security audit, predatory loan shark detection, manifest posture checks,
                and permission abuse inspection for Android APK files.
              </p>
            </div>
          </div>
          <div className="app-scanner-header-actions">
            {accessToken && (
              <button
                className="history-toggle-btn"
                type="button"
                onClick={handleToggleHistory}
              >
                <Clock size={16} />
                <span>{showHistory ? 'Close Scan History' : 'Past App Scans'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* History Drawer */}
      {showHistory && (
        <section className="history-drawer" aria-label="Scan history">
          <div className="scanner-card-header">
            <h3 className="scanner-card-title">
              <Clock size={18} />
              Past APK Scans
            </h3>
            <span className="limit-badge">{historyList.length} scans found</span>
          </div>
          {historyLoading ? (
            <p className="loading-text">Loading historical scans…</p>
          ) : historyList.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No past scans recorded for your account yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {historyList.map((item) => (
                <div
                  key={item.id}
                  className="history-item"
                  onClick={() => handleSelectHistoryScan(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelectHistoryScan(item.id)}
                >
                  <div className="history-item-left">
                    <span className="history-item-name">{item.app_label || item.file_name}</span>
                    <span className="history-item-pkg">{item.package_name}</span>
                  </div>
                  <div className="history-item-right">
                    <span className={`verdict-badge ${getRiskClass(item.risk_score)}`}>
                      {item.risk_score}/100 • {item.verdict}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Error Banner */}
      {error && (
        <div className="scanner-error-banner" role="alert">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Zone (Shown when no report is displayed) */}
      {!report && !isAnalyzing && (
        <section className="upload-card">
          <div
            className={`dropzone${dragActive ? ' drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
            <div className="dropzone-icon">
              <UploadCloud size={28} />
            </div>
            <div className="dropzone-text">
              <h3>
                {selectedFile ? selectedFile.name : 'Select or drag & drop an Android APK file'}
              </h3>
              <p>
                {selectedFile
                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for static analysis`
                  : 'Untrusted package binaries are analyzed in memory using strict sandbox limits.'}
              </p>
            </div>
            <div className="dropzone-limits">
              <span className="limit-badge">Max 35 MB</span>
              <span className="limit-badge">Android .apk only</span>
              <span className="limit-badge">Zero installation</span>
            </div>
          </div>

          <div className="upload-options">
            <label className="threat-optin-label">
              <input
                type="checkbox"
                checked={consentThreatIntel}
                onChange={(e) => setConsentThreatIntel(e.target.checked)}
              />
              <span>
                <strong>Enable Threat Intelligence hash lookup (VirusTotal)</strong>
                <span className="threat-optin-sub">
                  Computes SHA-256 locally. Only the anonymous hash is checked against threat feeds. Your APK file is never uploaded to third parties.
                </span>
              </span>
            </label>

            <button
              className="analyze-button"
              type="button"
              disabled={!selectedFile}
              onClick={handleAnalyze}
            >
              <ShieldCheck size={18} />
              <span>Analyze APK Security</span>
            </button>
          </div>
        </section>
      )}

      {/* Analyzing Progress State */}
      {isAnalyzing && (
        <div className="scanner-loading" role="status">
          <div className="scanner-spinner" />
          <div className="loading-text">
            <h4>Executing Static Security Analysis…</h4>
            <p>
              Parsing AndroidManifest.xml, validating archive boundaries, auditing permissions,
              and cross-referencing known loan shark extortion clusters.
            </p>
          </div>
        </div>
      )}

      {/* Results View */}
      {report && !isAnalyzing && (
        <div className="results-container">
          {/* Top Summary Card */}
          <section className="summary-card">
            {/* Score Gauge */}
            <div className="gauge-wrapper">
              <svg className="gauge-svg" viewBox="0 0 160 160">
                <circle className="gauge-bg" cx="80" cy="80" r={radius} />
                <circle
                  className={`gauge-progress ${scoreClass}`}
                  cx="80"
                  cy="80"
                  r={radius}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className="gauge-label">
                <span className="gauge-score">{report.riskScore}</span>
                <span className="gauge-scale">OUT OF 100</span>
              </div>
              <span className={`verdict-badge ${scoreClass}`}>
                {report.verdict} • {report.riskLevel}
              </span>
            </div>

            {/* Meta Details */}
            <div className="meta-details">
              <div className="meta-header-row">
                <div className="app-title-group">
                  <h2>{report.appLabel || 'Android Application'}</h2>
                  <span className="app-pkg-name">{report.packageName}</span>
                </div>
                <div className="action-row">
                  <button className="btn-secondary" type="button" onClick={handleCopyReport}>
                    <Copy size={15} />
                    <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <button className="btn-secondary" type="button" onClick={handleDownloadReport}>
                    <Download size={15} />
                    <span>Export</span>
                  </button>
                  <button className="btn-secondary" type="button" onClick={handleReset}>
                    <ArrowLeft size={15} />
                    <span>New Scan</span>
                  </button>
                </div>
              </div>

              {/* Meta Grid */}
              <div className="meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Version</span>
                  <span className="meta-value">{report.versionName} ({report.versionCode})</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Target SDK</span>
                  <span className="meta-value">
                    API {report.targetSdkVersion ?? 'N/A'}{' '}
                    {report.targetSdkVersion !== null && report.targetSdkVersion < 31 && '⚠️'}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Min SDK</span>
                  <span className="meta-value">API {report.minSdkVersion ?? 'N/A'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">File Size</span>
                  <span className="meta-value">{(report.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
                <div className="meta-item" style={{ gridColumn: 'span 2' }}>
                  <span className="meta-label">SHA-256 Hash</span>
                  <span className="meta-value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {report.sha256}
                  </span>
                </div>
              </div>

              {/* Manifest Posture Flags */}
              <div className="posture-flags">
                {report.manifestConfigurations.debuggable ? (
                  <span className="posture-flag danger">
                    <ShieldAlert size={14} />
                    Debuggable Build (android:debuggable="true")
                  </span>
                ) : (
                  <span className="posture-flag safe">
                    <CheckCircle2 size={14} />
                    Production Release (Not Debuggable)
                  </span>
                )}

                {report.manifestConfigurations.usesCleartextTraffic ? (
                  <span className="posture-flag warning">
                    <Radio size={14} />
                    Cleartext HTTP Allowed
                  </span>
                ) : (
                  <span className="posture-flag safe">
                    <Lock size={14} />
                    Cleartext HTTP Restricted
                  </span>
                )}

                {report.manifestConfigurations.allowBackup ? (
                  <span className="posture-flag warning">
                    <HardDrive size={14} />
                    Data Backup Allowed
                  </span>
                ) : (
                  <span className="posture-flag safe">
                    <CheckCircle2 size={14} />
                    Data Backup Disabled
                  </span>
                )}

                {report.certificateInfo.status === 'debug_key' && (
                  <span className="posture-flag danger">
                    <AlertTriangle size={14} />
                    Signed with Android Debug Keystore
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Suspicious Permission Clusters Banner */}
          {report.matchedClusters.length > 0 && (
            <section className="cluster-alert-banner">
              <div className="cluster-alert-header">
                <AlertTriangle size={22} />
                <span>Critical Warning: Suspicious Permission Cluster Detected</span>
              </div>
              {report.matchedClusters.map((cluster, idx) => (
                <div key={idx} className="cluster-item">
                  <h4>{cluster.title}</h4>
                  <p>{cluster.description}</p>
                </div>
              ))}
            </section>
          )}

          {/* Key Findings Card */}
          {report.findings.length > 0 && (
            <section className="scanner-card">
              <div className="scanner-card-header">
                <h3 className="scanner-card-title">
                  <ShieldAlert size={18} />
                  Security Findings ({report.findings.length})
                </h3>
              </div>
              <div className="findings-list">
                {report.findings.map((finding) => (
                  <div key={finding.id} className={`finding-item ${finding.severity}`}>
                    <div className="finding-content">
                      <h4>
                        [{finding.severity.toUpperCase()}] {finding.title}
                      </h4>
                      <p>{finding.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Declared Permissions Audit Card */}
          <section className="scanner-card">
            <div className="scanner-card-header">
              <h3 className="scanner-card-title">
                <FileCheck size={18} />
                Declared Permissions Audit ({report.declaredPermissions.length} Total)
              </h3>
            </div>

            <div className="perm-controls">
              <input
                className="perm-search-input"
                type="text"
                placeholder="Search permissions by name, description, or Android identifier…"
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
              />

              <div className="perm-filter-chips">
                <button
                  type="button"
                  className={`filter-chip${selectedCategory === 'ALL' ? ' active' : ''}`}
                  onClick={() => setSelectedCategory('ALL')}
                >
                  All Categories ({report.declaredPermissions.length})
                </button>
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`filter-chip${selectedCategory === cat ? ' active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="perm-filter-chips" style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  className={`filter-chip${selectedSeverity === 'ALL' ? ' active' : ''}`}
                  onClick={() => setSelectedSeverity('ALL')}
                >
                  All Severities
                </button>
                <button
                  type="button"
                  className={`filter-chip${selectedSeverity === 'critical' ? ' active' : ''}`}
                  onClick={() => setSelectedSeverity('critical')}
                >
                  Critical ({report.declaredPermissions.filter((p) => p.severity === 'critical').length})
                </button>
                <button
                  type="button"
                  className={`filter-chip${selectedSeverity === 'high' ? ' active' : ''}`}
                  onClick={() => setSelectedSeverity('high')}
                >
                  High ({report.declaredPermissions.filter((p) => p.severity === 'high').length})
                </button>
                <button
                  type="button"
                  className={`filter-chip${selectedSeverity === 'medium' ? ' active' : ''}`}
                  onClick={() => setSelectedSeverity('medium')}
                >
                  Medium ({report.declaredPermissions.filter((p) => p.severity === 'medium').length})
                </button>
                <button
                  type="button"
                  className={`filter-chip${selectedSeverity === 'low' ? ' active' : ''}`}
                  onClick={() => setSelectedSeverity('low')}
                >
                  Low ({report.declaredPermissions.filter((p) => p.severity === 'low').length})
                </button>
              </div>
            </div>

            {/* Permission Accordion List */}
            <div className="perm-list">
              {filteredPermissions.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', padding: '1rem' }}>
                  No declared permissions match the selected filter criteria.
                </p>
              ) : (
                filteredPermissions.map((perm) => {
                  const isExpanded = Boolean(expandedPerms[perm.permission])
                  return (
                    <div key={perm.permission} className="perm-card">
                      <div
                        className="perm-header"
                        onClick={() => togglePerm(perm.permission)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && togglePerm(perm.permission)}
                      >
                        <div className="perm-title-group">
                          <span className={`perm-severity-pill ${perm.severity}`}>
                            {perm.severity}
                          </span>
                          <span className="perm-name">{perm.shortName}</span>
                          <span className="perm-technical-name">{perm.permission}</span>
                        </div>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>

                      {isExpanded && (
                        <div className="perm-body">
                          <div className="perm-section">
                            <h5>Explanation</h5>
                            <p>{perm.explanation}</p>
                          </div>
                          <div className="perm-section perm-abuse">
                            <h5>Potential Abuse</h5>
                            <p>{perm.potentialAbuse}</p>
                          </div>
                          <div className="perm-section">
                            <h5>Legitimate Use Cases</h5>
                            <p>{perm.legitimateUseCases}</p>
                          </div>
                          <div className="perm-section">
                            <h5>Recommended Action</h5>
                            <p>{perm.recommendedAction}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Component Exposure & Threat Reputation Two-Column */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
            {/* Component Summary Card */}
            <section className="scanner-card">
              <div className="scanner-card-header">
                <h3 className="scanner-card-title">
                  <FileCode2 size={18} />
                  Component Exposure
                </h3>
              </div>
              <div className="meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Activities</span>
                  <span className="meta-value">
                    {report.componentsSummary.exportedActivities} / {report.componentsSummary.totalActivities} exported
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Services</span>
                  <span className="meta-value">
                    {report.componentsSummary.exportedServices} / {report.componentsSummary.totalServices} exported
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Receivers</span>
                  <span className="meta-value">
                    {report.componentsSummary.exportedReceivers} / {report.componentsSummary.totalReceivers} exported
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Providers</span>
                  <span className="meta-value">
                    {report.componentsSummary.exportedProviders} / {report.componentsSummary.totalProviders} exported
                  </span>
                </div>
              </div>
              {report.componentsSummary.unprotectedExportedCount > 0 ? (
                <div className="finding-item medium" style={{ marginTop: '0.5rem' }}>
                  <div className="finding-content">
                    <h4>{report.componentsSummary.unprotectedExportedCount} Unprotected Exported Component(s)</h4>
                    <p>These components are exposed to other installed applications without permission guards.</p>
                  </div>
                </div>
              ) : (
                <div className="posture-flag safe" style={{ width: 'fit-content', marginTop: '0.5rem' }}>
                  <CheckCircle2 size={14} />
                  All exported components are permission-guarded or private
                </div>
              )}
            </section>

            {/* Code Signing Certificate Card */}
            <section className="scanner-card">
              <div className="scanner-card-header">
                <h3 className="scanner-card-title">
                  <Lock size={18} />
                  Signing Certificate
                </h3>
                <span className={`posture-flag ${report.certificateInfo.status === 'debug_key' ? 'danger' : 'safe'}`}>
                  {report.certificateInfo.status.toUpperCase()}
                </span>
              </div>
              <div className="cert-grid">
                <div className="cert-field">
                  <span className="cert-field-label">Algorithm</span>
                  <span className="cert-field-val">{report.certificateInfo.signatureAlgorithm || 'Unknown'}</span>
                </div>
                <div className="cert-field">
                  <span className="cert-field-label">Self-Signed</span>
                  <span className="cert-field-val">{report.certificateInfo.isSelfSigned ? 'Yes' : 'No'}</span>
                </div>
                <div className="cert-field" style={{ gridColumn: 'span 2' }}>
                  <span className="cert-field-label">Subject / Issuer</span>
                  <span className="cert-field-val">{report.certificateInfo.subject || report.certificateInfo.issuer || 'N/A'}</span>
                </div>
              </div>
            </section>
          </div>

          {/* Threat Intelligence Card */}
          {report.threatReputation.checked && (
            <section className="scanner-card">
              <div className="scanner-card-header">
                <h3 className="scanner-card-title">
                  <Radio size={18} />
                  External Threat Intelligence (VirusTotal)
                </h3>
                <span className={`posture-flag ${report.threatReputation.status === 'threat_found' ? 'danger' : 'safe'}`}>
                  {report.threatReputation.status === 'threat_found' ? 'DETECTIONS FOUND' : 'NO KNOWN MATCH'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1' }}>
                {report.threatReputation.detail}
              </p>
              {report.threatReputation.malicious !== undefined && report.threatReputation.malicious > 0 && (
                <div className="finding-item critical">
                  <div className="finding-content">
                    <h4>{report.threatReputation.malicious} Security Engines Flagged This Binary Hash</h4>
                    <p>Community threat feeds have previously cataloged this APK hash as malicious or suspicious.</p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Recommendations Card */}
          {report.recommendations.length > 0 && (
            <section className="scanner-card">
              <div className="scanner-card-header">
                <h3 className="scanner-card-title">
                  <CheckCircle2 size={18} />
                  Safety Recommendations
                </h3>
              </div>
              <ul className="recommendations-list">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Limitations & Disclaimer */}
          <div className="limitations-box">
            <strong>Static Analysis Limitations:</strong>
            <p style={{ margin: '0.375rem 0 0' }}>
              Declared permissions indicate what the app can potentially access, but cannot prove runtime behavior.
              Applications can execute native C/C++ libraries, load dynamic DEX files from remote command servers, or bypass restrictions via OS zero-day exploits.
              Never install APK files from untrusted third-party websites or messaging groups.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
