import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { ScanReportView } from './ScanReportView'
import {
  deleteScan,
  getScan,
  getScanHistory,
  ScannerApiError,
  type ScanHistoryRecord,
  type ScanReport,
  type ScanType,
} from './scannerApi'

const scanTypeLabel: Record<ScanType, string> = {
  url: 'URL',
  sms: 'SMS',
  email: 'Email',
  qr: 'QR code',
}

function historyReport(record: ScanHistoryRecord): ScanReport {
  const confidenceLevel = record.confidence >= 75
    ? 'High'
    : record.confidence >= 50
      ? 'Medium'
      : 'Low'
  return {
    scanId: record.id,
    scanType: record.scan_type,
    submittedContentRedacted: 'Not retained for privacy.',
    riskScore: record.risk_score,
    riskLevel: record.risk_level,
    verdict: record.verdict,
    confidence: record.confidence,
    confidenceLevel,
    findings: record.findings,
    evidence: record.evidence,
    urlInfo: [],
    extractedUrls: [],
    extractedPhoneNumbers: [],
    emailAuthentication: null,
    checksPerformed: record.checks_performed,
    checksUnavailable: record.checks_unavailable,
    explanation: 'This report is reconstructed from saved scan evidence. Submitted content was not retained.',
    recommendations: record.recommendations,
    aiSummary: { status: 'not_retained' },
    createdAt: record.created_at,
  }
}

function formattedDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString()
}

export function ScanHistoryPage() {
  const { session } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [records, setRecords] = useState<ScanHistoryRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<ScanHistoryRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ScanType | 'all'>('all')

  const accessToken = session?.access_token

  useEffect(() => {
    if (id || !accessToken) return
    let active = true
    void getScanHistory(accessToken, {
        limit: 100,
        ...(typeFilter === 'all' ? {} : { type: typeFilter }),
      })
      .then((history) => {
        if (!active) return
        setRecords(history)
        setError('')
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof ScannerApiError ? loadError.message : 'Scan history could not be loaded.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [accessToken, id, typeFilter])

  useEffect(() => {
    if (!id || !accessToken) return
    let active = true
    void getScan(accessToken, id)
      .then((record) => {
        if (active) {
          setSelectedRecord(record)
          setError('')
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setSelectedRecord(null)
          setError(loadError instanceof ScannerApiError ? loadError.message : 'Scan detail could not be loaded.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [id, accessToken])

  const visibleRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return records
    return records.filter((record) => [
      record.scan_type,
      record.verdict,
      record.risk_level,
      String(record.risk_score),
      ...record.findings.map((finding) => finding.title),
    ].some((value) => value.toLowerCase().includes(normalized)))
  }, [query, records])

  const handleDelete = async (record: ScanHistoryRecord) => {
    if (!accessToken) return
    if (!window.confirm('Delete this saved scan report? This cannot be undone.')) return
    try {
      await deleteScan(accessToken, record.id)
      setRecords((current) => current.filter((entry) => entry.id !== record.id))
      if (id === record.id) {
        setSelectedRecord(null)
        navigate('/history', { replace: true })
      }
    } catch (deleteError) {
      setError(deleteError instanceof ScannerApiError ? deleteError.message : 'The scan could not be deleted.')
    }
  }

  if (id) {
    return (
      <div className="scan-history-page">
        <div className="history-page-heading">
          <div>
            <Link className="history-back-link" to="/history"><ArrowLeft size={16} /> All scan history</Link>
            <p className="eyebrow">SAVED REPORT</p>
            <h1>Scan details</h1>
          </div>
          {selectedRecord && (
            <button className="button button-danger" onClick={() => void handleDelete(selectedRecord)} type="button">
              <Trash2 size={16} /> Delete report
            </button>
          )}
        </div>
        {loading && <p className="history-state" role="status">Loading saved report…</p>}
        {error && <p className="scanner-error" role="alert">{error}</p>}
        {selectedRecord && <ScanReportView report={historyReport(selectedRecord)} />}
      </div>
    )
  }

  return (
    <div className="scan-history-page">
      <header className="history-page-heading">
        <div>
          <p className="eyebrow">CYBERSAATHI AI / INVESTIGATIONS</p>
          <h1>Scan history</h1>
          <p>Saved reports belong to your account. Submitted message and URL content is not retained.</p>
        </div>
        <Link className="button button-primary" to="/scanner">
          <ShieldAlert aria-hidden="true" size={16} /> Quick scan
        </Link>
      </header>

      <section className="history-list-panel panel">
        <div className="history-controls">
          <label className="history-search">
            <Search aria-hidden="true" size={17} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search reports…" value={query} />
          </label>
          <label className="history-type-filter">
            <span>Type</span>
            <select onChange={(event) => { setLoading(true); setTypeFilter(event.target.value as ScanType | 'all') }} value={typeFilter}>
              <option value="all">All scan types</option>
              <option value="url">URL</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="qr">QR code</option>
            </select>
          </label>
        </div>

        {loading && <p className="history-state" role="status">Loading your saved scans…</p>}
        {error && <p className="scanner-error" role="alert">{error}</p>}
        {!loading && !error && visibleRecords.length === 0 && (
          <div className="history-empty">
            <span><CalendarDays aria-hidden="true" size={22} /></span>
            <strong>{records.length === 0 ? 'No saved scans yet' : 'No reports match your search'}</strong>
            <p>{records.length === 0 ? 'Reports from completed scans will appear here.' : 'Try a different search term or scan type.'}</p>
          </div>
        )}
        {visibleRecords.length > 0 && (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr><th>Scan</th><th>Risk</th><th>Verdict</th><th>Confidence</th><th>Date</th><th><span className="visually-hidden">Actions</span></th></tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <span className="history-type">{scanTypeLabel[record.scan_type]}</span>
                      <small>{record.findings.length} indicator{record.findings.length === 1 ? '' : 's'}</small>
                    </td>
                    <td><span className={`history-risk risk-${record.risk_level.toLowerCase().replaceAll(' ', '-')}`}>{record.risk_score} · {record.risk_level}</span></td>
                    <td><span className={`history-verdict verdict-${record.verdict.toLowerCase().replaceAll(' ', '-')}`}>{record.verdict}</span></td>
                    <td>{record.confidence}%</td>
                    <td>{formattedDate(record.created_at)}</td>
                    <td className="history-row-actions">
                      <Link aria-label={`View ${scanTypeLabel[record.scan_type]} scan`} className="icon-button" to={`/history/${record.id}`}><ExternalLink size={16} /></Link>
                      <button aria-label={`Delete ${scanTypeLabel[record.scan_type]} scan`} className="icon-button" onClick={() => void handleDelete(record)} type="button"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="history-limit-note">Showing up to 100 most recent saved scans.</p>
          </div>
        )}
      </section>
      <button className="scanner-text-link" onClick={() => navigate('/')} type="button">
        Back to dashboard <ArrowUpRight aria-hidden="true" size={15} />
      </button>
    </div>
  )
}
