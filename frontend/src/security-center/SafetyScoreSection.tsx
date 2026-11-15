import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import {
  loadSafetyScore,
  type SafetyScoreResult,
} from './securityCenterApi'

interface Props {
  accessToken: string
}

export function SafetyScoreSection({ accessToken }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scoreData, setScoreData] = useState<SafetyScoreResult | null>(null)

  const handleRecalculate = () => {
    setLoading(true)
    setError(null)
    loadSafetyScore(accessToken)
      .then((data) => {
        setScoreData(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to calculate security score.')
        setLoading(false)
      })
  }

  useEffect(() => {
    let active = true
    loadSafetyScore(accessToken)
      .then((data) => {
        if (active) {
          setScoreData(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to calculate security score.')
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
        <p>Evaluating multi-signal platform posture and calculating Cyber Safety Score…</p>
      </div>
    )
  }

  if (error || !scoreData) {
    return (
      <div className="alert-box error" style={{ padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
        <ShieldAlert size={20} color="#ef4444" />
        <p>{error || 'Failed to load safety score.'}</p>
        <button type="button" className="button button-sm button-outline" onClick={handleRecalculate}>
          Retry
        </button>
      </div>
    )
  }

  const getTierColor = (tier: SafetyScoreResult['tier']) => {
    switch (tier) {
      case 'Fortified':
        return '#10b981'
      case 'Strong':
        return '#38bdf8'
      case 'Moderate':
        return '#f59e0b'
      default:
        return '#ef4444'
    }
  }

  const tierColor = getTierColor(scoreData.tier)

  return (
    <div className="safety-score-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Banner with Grade and Dial */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.7))',
          border: `1px solid ${tierColor}40`,
          borderRadius: '16px',
          padding: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '2rem',
          boxShadow: `0 10px 30px rgba(0,0,0,0.3)`,
        }}
      >
        <div style={{ flex: '1 1 450px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <span
              style={{
                background: `${tierColor}20`,
                color: tierColor,
                border: `1px solid ${tierColor}60`,
                borderRadius: '20px',
                padding: '0.25rem 0.85rem',
                fontSize: '0.825rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Award size={15} />
              Tier: {scoreData.tier}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Grade: <strong style={{ color: '#f8fafc', fontSize: '1.05rem' }}>{scoreData.grade}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.65rem 0' }}>
            Cyber Safety Posture: {scoreData.score}/100
          </h2>
          <p style={{ color: '#cbd5e1', fontSize: '1rem', lineHeight: '1.6', margin: 0, maxWidth: '640px' }}>
            {scoreData.summary}
          </p>
        </div>

        {/* Score Ring / Dial */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: `radial-gradient(closest-side, #0f172a 79%, transparent 80% 100%), conic-gradient(${tierColor} ${scoreData.score * 3.6}deg, rgba(148, 163, 184, 0.15) 0deg)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 20px ${tierColor}30`,
            }}
          >
            <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
              {scoreData.score}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>/ 100 PTS</span>
          </div>
          <button
            type="button"
            className="button button-sm button-ghost"
            style={{ fontSize: '0.775rem', color: '#94a3b8' }}
            onClick={handleRecalculate}
          >
            <RefreshCw size={13} style={{ marginRight: '0.35rem' }} /> Recalculate
          </button>
        </div>
      </section>

      {/* Quick Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
        }}
      >
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8' }}>{scoreData.stats.totalScans}</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Link / SMS Scans</div>
        </div>
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8' }}>{scoreData.stats.appScans}</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>APK App Audits</div>
        </div>
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8' }}>{scoreData.stats.callScans}</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Call Scam Checks</div>
        </div>
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{scoreData.stats.lessonsCompleted}</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Academy Modules</div>
        </div>
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: scoreData.stats.unresolvedAlerts > 0 ? '#ef4444' : '#10b981' }}>
            {scoreData.stats.unresolvedAlerts}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Unresolved Alerts</div>
        </div>
      </div>

      {/* 4 Pillars Breakdown */}
      <section>
        <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} color="#38bdf8" />
          Evaluation Pillars (Max 25 Points Each)
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {scoreData.pillars.map((pillar) => {
            const pct = Math.round((pillar.score / pillar.maxScore) * 100)
            const pColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
            return (
              <div
                key={pillar.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(148, 163, 184, 0.18)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>{pillar.name}</span>
                  <span style={{ fontWeight: 800, color: pColor, fontSize: '1rem' }}>
                    {pillar.score} / {pillar.maxScore}
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pColor, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {pillar.signals.map((sig, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                      <CheckCircle2 size={13} color={pColor} style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                      <span>{sig}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Actionable Improvement Recommendations */}
      {scoreData.recommendations.length > 0 && (
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
                <TrendingUp size={20} color="#10b981" />
                Actions to Boost Your Cyber Safety Score
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#94a3b8' }}>
                Completing these recommendations directly increases your protection against active India threat vectors.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {scoreData.recommendations.map((rec) => (
              <div
                key={rec.id}
                style={{
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: '10px',
                  padding: '1.15rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                      +{rec.pointsPotential} PTS
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      {rec.category}
                    </span>
                    <strong style={{ fontSize: '0.95rem', color: '#f1f5f9' }}>{rec.title}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
                    {rec.description}
                  </p>
                </div>
                <div>
                  <Link to={rec.actionUrl} className="button button-sm button-primary" style={{ whiteSpace: 'nowrap' }}>
                    {rec.actionLabel}
                    <ArrowRight size={14} style={{ marginLeft: '0.35rem' }} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
