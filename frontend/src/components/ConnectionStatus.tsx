import { Activity, RefreshCw } from 'lucide-react'
import type { useSystemStatus } from '../hooks/useSystemStatus'

type SystemStatus = ReturnType<typeof useSystemStatus>

interface ConnectionStatusProps {
  status: SystemStatus
}

function statusLabel(status: SystemStatus['backend'], loading: boolean): string {
  if (loading || status === 'checking') {
    return 'Checking'
  }

  if (status === 'connected') {
    return 'Connected'
  }

  return status === 'error' ? 'Error' : 'Disconnected'
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <section
      className="connection-card panel"
      id="connections"
      aria-labelledby="connections-title"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Live diagnostics</p>
          <h2 id="connections-title">System connections</h2>
        </div>
        <button
          className="button button-secondary refresh-button"
          type="button"
          onClick={status.retry}
          disabled={status.loading}
        >
          <RefreshCw
            aria-hidden="true"
            className={status.loading ? 'spin' : ''}
            size={16}
          />
          {status.loading ? 'Checking' : 'Retry checks'}
        </button>
      </div>

      <div className="connection-list" aria-live="polite">
        <div className="connection-row">
          <span className="connection-icon">
            <Activity aria-hidden="true" size={18} />
          </span>
          <span className="connection-name">
            <strong>Backend API</strong>
            <small>Application services</small>
          </span>
          <span className={`connection-state state-${status.backend}`}>
            <span className="state-dot" />
            {statusLabel(status.backend, status.loading)}
          </span>
        </div>
        <div className="connection-row">
          <span className="connection-icon connection-icon-violet">
            <span aria-hidden="true" className="database-glyph">
              DB
            </span>
          </span>
          <span className="connection-name">
            <strong>Supabase</strong>
            <small>Database connectivity</small>
          </span>
          <span className={`connection-state state-${status.supabase}`}>
            <span className="state-dot" />
            {statusLabel(status.supabase, status.loading)}
          </span>
        </div>
      </div>

      {status.error && (
        <p className="connection-error" role="status">
          {status.error}
        </p>
      )}
      <p className="connection-updated">
        Last successful check:{' '}
        <time
          dateTime={status.lastSuccessfulCheckTime?.toISOString()}
        >
          {status.lastSuccessfulCheckTime
            ? status.lastSuccessfulCheckTime.toLocaleTimeString()
            : 'No successful check yet'}
        </time>
      </p>
    </section>
  )
}
