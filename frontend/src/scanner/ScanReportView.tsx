import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import type { ScanReport } from './scannerApi'

function verdictIcon(verdict: ScanReport['verdict']) {
  if (verdict === 'Likely Safe') return <ShieldCheck aria-hidden="true" size={21} />
  if (verdict === 'Inconclusive') return <CircleHelp aria-hidden="true" size={21} />
  if (verdict === 'Likely Malicious') return <ShieldAlert aria-hidden="true" size={21} />
  return <AlertTriangle aria-hidden="true" size={21} />
}

function dateLabel(date: string): string {
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? 'Unknown time' : parsed.toLocaleString()
}

export function ScanReportView({
  report,
  historySaved,
}: {
  report: ScanReport
  historySaved?: boolean
}) {
  return (
    <section className="scan-report panel" aria-labelledby="scan-report-title">
      <div className="scan-report-heading">
        <div>
          <p className="eyebrow">INVESTIGATION REPORT</p>
          <h2 id="scan-report-title">{report.verdict}</h2>
        </div>
        <span className={`verdict-icon verdict-${report.verdict.toLowerCase().replaceAll(' ', '-')}`}>
          {verdictIcon(report.verdict)}
        </span>
      </div>

      <div className="risk-overview">
        <div className="risk-score" aria-label={`Risk score ${report.riskScore} out of 100`}>
          <strong>{report.riskScore}</strong>
          <span>/ 100</span>
        </div>
        <div className="risk-meter" aria-hidden="true">
          <span style={{ width: `${report.riskScore}%` }} />
        </div>
        <div className="risk-metadata">
          <span>{report.riskLevel}</span>
          <span>{report.confidenceLevel} confidence · {report.confidence}%</span>
        </div>
      </div>

      <p className="report-explanation">{report.explanation}</p>
      <div className="report-submission">
        <span>Submitted content (redacted)</span>
        <p>{report.submittedContentRedacted || 'Not retained for privacy.'}</p>
      </div>
      <div className="report-meta">
        <span><Clock3 aria-hidden="true" size={14} /> {dateLabel(report.createdAt)}</span>
        <span>Scan ID · {report.scanId}</span>
        {historySaved === false && (
          <span className="report-warning" role="status">Report not saved to scan history.</span>
        )}
      </div>

      {report.findings.length > 0 ? (
        <div className="report-section">
          <h3>Detected indicators ({report.findings.length})</h3>
          <div className="finding-list">
            {report.findings.map((finding) => (
              <article className={`finding-card finding-${finding.severity}`} key={finding.id}>
                <div className="finding-heading">
                  <strong>{finding.title}</strong>
                  <span>{finding.severity}</span>
                </div>
                <p>{finding.detail}</p>
                <small>{finding.source}{finding.verified ? ' · provider finding' : ' · heuristic'}</small>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <p className="report-empty">
          <CheckCircle2 aria-hidden="true" size={16} />
          No suspicious indicators found in the checks that ran.
        </p>
      )}

      {report.extractedUrls.length > 0 && (
        <div className="report-section">
          <h3>Extracted URLs</h3>
          <ul>{report.extractedUrls.map((url) => <li key={url}>{url}</li>)}</ul>
        </div>
      )}
      {report.urlInfo.length > 0 && (
        <div className="report-section url-info-section">
          <h3>Domain details</h3>
          <ul>
            {report.urlInfo.map((info, index) => (
              <li key={`${info.hostname}-${index}`}>
                <strong>{info.hostname}</strong> · {info.protocol} · {info.ipLiteral ? 'IP literal' : 'domain name'}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.extractedPhoneNumbers.length > 0 && (
        <div className="report-section">
          <h3>Extracted phone numbers</h3>
          <ul>{report.extractedPhoneNumbers.map((phone) => <li key={phone}>{phone}</li>)}</ul>
        </div>
      )}
      {report.emailAuthentication && (
        <p className="report-note">{report.emailAuthentication.note}</p>
      )}

      <div className="report-columns">
        <div className="report-section">
          <h3>Checks performed</h3>
          {report.checksPerformed.length > 0
            ? <ul>{report.checksPerformed.map((check) => <li key={check}>{check}</li>)}</ul>
            : <p>No checks completed.</p>}
        </div>
        <div className="report-section">
          <h3>Unavailable or skipped</h3>
          {report.checksUnavailable.length > 0
            ? <ul>{report.checksUnavailable.map((check) => <li key={check}>{check}</li>)}</ul>
            : <p>No unavailable checks.</p>}
        </div>
      </div>

      {report.aiSummary.status === 'available' && (
        <div className="ai-summary">
          <span className="ai-summary-label">AI evidence summary</span>
          <p>{report.aiSummary.summary}</p>
        </div>
      )}
      {report.aiSummary.status === 'unavailable' && (
        <p className="report-note">AI summary unavailable: {report.aiSummary.reason} Deterministic analysis remains available.</p>
      )}
      {report.aiSummary.status === 'not_retained' && (
        <p className="report-note">AI summary text is not retained in scan history. The saved deterministic evidence remains available.</p>
      )}

      <div className="report-section report-actions">
        <h3>Recommended next actions</h3>
        <ul>{report.recommendations.map((action) => <li key={action}>{action}</li>)}</ul>
      </div>
    </section>
  )
}
