import { useEffect, useState } from 'react'
import { ArrowUpRight, Clock3, ScanSearch, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getScanHistory, ScannerApiError, type ScanHistoryRecord } from './scannerApi'

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString()
}

export function DashboardScannerSummary() {
  const { session } = useAuth()
  const [records, setRecords] = useState<ScanHistoryRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(session?.access_token))

  useEffect(() => {
    let active = true
    const accessToken = session?.access_token
    if (!accessToken) return
    void getScanHistory(accessToken, { limit: 100 })
      .then((data) => {
        if (active) setRecords(data)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof ScannerApiError
            ? loadError.message
            : 'Scan history is currently unavailable.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [session?.access_token])

  const highRisk = records.filter((record) => record.risk_score >= 60).length
  const uncertain = records.filter((record) => record.verdict === 'Inconclusive').length

  return (
    <section className="dashboard-scanner panel" aria-labelledby="dashboard-scanner-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SCAM SCANNER</p>
          <h2 id="dashboard-scanner-title">Scan activity</h2>
        </div>
        <Link className="dashboard-view-history" to="/history">View all <ArrowUpRight size={15} /></Link>
      </div>
      <div className="scanner-dashboard-actions">
        <Link className="button button-primary" to="/scanner"><ScanSearch size={16} /> Quick scan</Link>
        <div className="scanner-stat">
          <span><ShieldAlert size={16} /> High / critical</span>
          <strong>{loading ? '—' : error ? '—' : highRisk}</strong>
        </div>
        <div className="scanner-stat">
          <span><ShieldCheck size={16} /> Inconclusive</span>
          <strong>{loading ? '—' : error ? '—' : uncertain}</strong>
        </div>
      </div>
      <div className="dashboard-recent-scans">
        <div className="recent-scans-heading">
          <h3>Recent scans</h3>
          {!loading && !error && <span>From latest {records.length} saved report{records.length === 1 ? '' : 's'}</span>}
        </div>
        {loading && <p className="dashboard-scan-state" role="status">Loading saved scan activity…</p>}
        {error && <p className="dashboard-scan-state" role="status">{error}</p>}
        {!loading && !error && records.length === 0 && (
          <p className="dashboard-scan-state">No saved scans yet. Start with a quick scan.</p>
        )}
        {!loading && !error && records.slice(0, 5).map((record) => (
          <Link className="recent-scan-row" key={record.id} to={`/history/${record.id}`}>
            <span className={`recent-scan-score risk-${record.risk_level.toLowerCase().replaceAll(' ', '-')}`}>{record.risk_score}</span>
            <span className="recent-scan-info">
              <strong>{record.scan_type.toUpperCase()} scan · {record.verdict}</strong>
              <small><Clock3 size={12} /> {dateLabel(record.created_at)}</small>
            </span>
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        ))}
      </div>
      <p className="scanner-dashboard-footnote">
        Recent report counts only; based on the latest 100 saved scans available to your account.
      </p>
    </section>
  )
}
