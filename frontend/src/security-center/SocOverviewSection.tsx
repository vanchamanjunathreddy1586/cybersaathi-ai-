import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import {
  loadSocOverview,
  type SocOverviewData,
} from './securityCenterApi'

interface Props {
  accessToken: string
}

export function SocOverviewSection({ accessToken }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [socData, setSocData] = useState<SocOverviewData | null>(null)

  const handleRefresh = () => {
    setLoading(true)
    setError(null)
    loadSocOverview(accessToken)
      .then((data) => {
        setSocData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load SOC overview.')
        setLoading(false)
      })
  }

  useEffect(() => {
    let active = true
    loadSocOverview(accessToken)
      .then((data) => {
        if (active) {
          setSocData(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load SOC overview.')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [accessToken])

  if (loading) {
    return (
      <div className="security-loading-box" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        <RefreshCw className="spinner" size={24} style={{ marginBottom: '1rem', color: '#38bdf8' }} />
        <p>Connecting to CyberSaathi SOC telemetry and provider monitors…</p>
      </div>
    )
  }

  if (error || !socData) {
    return (
      <div className="alert-box error" style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
        <ShieldAlert size={20} color="#ef4444" />
        <p>{error || 'Failed to load SOC data.'}</p>
        <button type="button" className="button button-sm button-outline" onClick={handleRefresh}>
          Retry
        </button>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return (
          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={12} /> OPERATIONAL
          </span>
        )
      case 'degraded':
        return (
          <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertTriangle size={12} /> DEGRADED
          </span>
        )
      case 'unconfigured':
        return (
          <span style={{ background: 'rgba(148, 163, 184, 0.12)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.25)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
            UNCONFIGURED
          </span>
        )
      default:
        return (
          <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.55rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <XCircle size={12} /> OFFLINE
          </span>
        )
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>CRITICAL</span>
      case 'high':
        return <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>HIGH</span>
      default:
        return <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>MEDIUM</span>
    }
  }

  return (
    <div className="soc-overview-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top SOC Status Header */}
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '16px',
          padding: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Radio size={16} color="#10b981" />
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', fontWeight: 700 }}>
              Live Security Operations Center Telemetry
            </span>
          </div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.5rem 0' }}>
            Unified SOC Command Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: '0.925rem', color: '#94a3b8' }}>
            Continuous real-time threat intelligence feeds, provider uptime, and nationwide scam vector tracking for India.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Platform State</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: socData.overallStatus === 'HEALTHY' ? '#10b981' : '#f59e0b' }}>
              {socData.overallStatus}
            </div>
          </div>
          <button
            type="button"
            className="button button-outline button-sm"
            onClick={handleRefresh}
            aria-label="Refresh SOC metrics"
          >
            <RefreshCw size={14} style={{ marginRight: '0.35rem' }} /> Refresh
          </button>
        </div>
      </section>

      {/* Provider & Infrastructure Health Matrix */}
      <section>
        <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Server size={20} color="#38bdf8" />
          Security Providers & Threat Feeds Status
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {socData.providers.map((provider) => (
            <div
              key={provider.id}
              style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#f1f5f9', fontSize: '0.95rem' }}>{provider.name}</strong>
                {getStatusBadge(provider.status)}
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#94a3b8', lineHeight: '1.5' }}>
                {provider.description}
              </p>
              {provider.circuitState && (
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Circuit Breaker: <strong style={{ color: provider.circuitState === 'CLOSED' ? '#10b981' : '#ef4444' }}>{provider.circuitState}</strong>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Active India Threat Vector Radar */}
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '16px',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={20} color="#ef4444" />
              India National Cyber Threat Radar
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
              Active modus operandi tracked by CyberSaathi intelligence and Indian cybersecurity advisories (I4C / CERT-In).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {socData.threatTelemetry.map((threat) => (
            <article
              key={threat.id}
              style={{
                background: 'rgba(2, 6, 23, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                borderLeft: `4px solid ${threat.severity === 'critical' ? '#ef4444' : threat.severity === 'high' ? '#f59e0b' : '#38bdf8'}`,
                borderRadius: '10px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getSeverityBadge(threat.severity)}
                  <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>{threat.name}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    (Trend: <strong style={{ color: threat.trend === 'rising' ? '#ef4444' : '#38bdf8' }}>{threat.trend}</strong>)
                  </span>
                </div>
                {threat.advisoryReference && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                    {threat.advisoryReference}
                  </span>
                )}
              </div>

              <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                <strong>Modus Operandi:</strong> {threat.activeModusOperandi}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.825rem' }}>
                <div style={{ color: '#10b981' }}>
                  <strong>Key Countermeasure:</strong> {threat.recommendedDefense}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {threat.commonTargetPlatforms.map((plat) => (
                    <span key={plat} style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.725rem' }}>
                      {plat}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Resilience Queues & System Metrics */}
      <section>
        <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={20} color="#10b981" />
          Request Queues & Concurrency Controls
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
          }}
        >
          {socData.systemMetrics.activeQueues.map((queue) => (
            <div
              key={queue.name}
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.15)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <strong style={{ fontSize: '0.9rem', color: '#f1f5f9' }}>{queue.name}</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
                <span>Active: {queue.activeWorkers}</span>
                <span>Queue: {queue.queueDepth}</span>
                <span>Processed: {queue.totalProcessed}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
