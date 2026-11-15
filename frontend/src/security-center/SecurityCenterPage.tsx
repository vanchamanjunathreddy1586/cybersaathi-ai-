import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Award,
  Bell,
  Check,
  CheckCheck,
  Clock3,
  Fingerprint,
  Globe,
  LoaderCircle,
  LogOut,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../auth/supabase'
import {
  checkThreatIndicator,
  loadNotificationPreferences,
  loadSecurityAlerts,
  loadSecurityDashboard,
  loadThreatProviders,
  markAlertRead,
  markAllAlertsRead,
  removeAlert,
  saveNotificationPreferences,
  deleteWebPushSubscription,
  loadWebPushConfiguration,
  saveWebPushSubscription,
  type AlertSeverity,
  type NotificationPreferences,
  type PeriodDays,
  type ProviderConfiguration,
  type SecurityAlert,
  type SecurityDashboard,
  type ThreatResult,
  type WebPushConfiguration,
} from './securityCenterApi'
import { SafetyScoreSection } from './SafetyScoreSection'
import { SocOverviewSection } from './SocOverviewSection'
import './SecurityCenter.css'

type CenterSection = 'dashboard' | 'safety-score' | 'soc' | 'threats' | 'alerts' | 'insights' | 'analytics' | 'account'
type RealtimeState = 'connecting' | 'connected' | 'unavailable' | 'error'

const navigation: { id: CenterSection; title: string; icon: typeof Shield }[] = [
  { id: 'dashboard', title: 'Command center', icon: ShieldCheck },
  { id: 'safety-score', title: 'Safety score', icon: Award },
  { id: 'soc', title: 'SOC telemetry', icon: Radio },
  { id: 'threats', title: 'Threat intelligence', icon: Search },
  { id: 'alerts', title: 'Security alerts', icon: Bell },
  { id: 'insights', title: 'Risk insights', icon: TrendingUp },
  { id: 'analytics', title: 'Activity analytics', icon: Activity },
  { id: 'account', title: 'Account security', icon: Fingerprint },
]

const chartColors = ['#63d2df', '#8b94ff', '#f0bd70', '#f07f95']
const tooltipStyle = {
  backgroundColor: '#111827',
  border: '1px solid rgba(164,180,214,.19)',
  borderRadius: 8,
  color: '#dce5f2',
  fontSize: 10,
}

const preferenceLabels: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'critical_alerts', label: 'Critical alerts', description: 'Notify for critical-severity scan matches.' },
  { key: 'high_risk_alerts', label: 'High-risk scans', description: 'Notify for high-risk and suspicious scans.' },
  { key: 'investigation_updates', label: 'Investigation updates', description: 'Notify when investigation evidence or status changes.' },
  { key: 'community_notifications', label: 'Community security warnings', description: 'Preference is saved; a community security-warning feed is not currently available.' },
  { key: 'learning_reminders', label: 'Learning reminders', description: 'Preference is saved; scheduled learning reminders are not currently available.' },
]

const lessonNames: Record<string, string> = {
  'phishing-beginner': 'Pause, inspect, and verify',
  'phishing-intermediate': 'Read links and sender details carefully',
  'web-security-beginner': 'How a browser and website share trust',
}

function isSecurityAlert(value: unknown): value is SecurityAlert {
  if (typeof value !== 'object' || value === null) return false
  const alert = value as Record<string, unknown>
  return typeof alert.id === 'string' &&
    typeof alert.title === 'string' &&
    typeof alert.summary === 'string' &&
    typeof alert.severity === 'string' &&
    ['medium', 'high', 'critical'].includes(alert.severity)
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function toUtcKey(date: Date, granularity: 'day' | 'month') {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  if (granularity === 'month') return `${date.getUTCFullYear()}-${month}`
  return `${date.getUTCFullYear()}-${month}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function fillActivityGaps(dashboard: SecurityDashboard | null) {
  if (!dashboard) return []
  const counts = new Map(dashboard.activity.map((item) => [item.date, item]))
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  const points: { date: string; scans: number; investigations: number; lessons: number }[] = []
  if (dashboard.chartGranularity === 'day') {
    for (let offset = dashboard.days - 1; offset >= 0; offset -= 1) {
      const date = new Date(now)
      date.setUTCDate(date.getUTCDate() - offset)
      const key = toUtcKey(date, 'day')
      points.push(counts.get(key) ?? { date: key, scans: 0, investigations: 0, lessons: 0 })
    }
  } else {
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
      const key = toUtcKey(date, 'month')
      points.push(counts.get(key) ?? { date: key, scans: 0, investigations: 0, lessons: 0 })
    }
  }
  return points
}

function ActivityTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const readable = typeof label === 'string' && label.length === 7
    ? `${label.slice(0, 4)}-${label.slice(5, 7)}`
    : label
  return (
    <div className="security-chart-tooltip">
      <strong>{readable}</strong>
      {payload.map((item) => <span key={item.name} style={{ color: item.color }}>{item.name}: {item.value}</span>)}
      <small>Dates are grouped using UTC.</small>
    </div>
  )
}

function EmptyChart({ title, description }: { title: string; description: string }) {
  return <div className="security-empty-chart"><Activity size={21} /><strong>{title}</strong><p>{description}</p></div>
}

function decodeApplicationServerKey(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function DonutCard({
  title,
  description,
  data,
  colors,
}: {
  title: string
  description: string
  data: { name: string; value: number }[]
  colors: string[]
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  return (
    <section className="security-panel security-chart-card">
      <div className="security-section-heading"><div><h2>{title}</h2><p>{description}</p></div></div>
      {total === 0
        ? <EmptyChart title="No records in this view" description="Records will appear after you use the relevant features." />
        : <div className="security-donut-layout">
          <div className="security-donut"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">{data.map((entry, index) => <Cell fill={colors[index % colors.length]} key={entry.name} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Records']} /></PieChart></ResponsiveContainer><span className="security-donut-total"><strong>{total}</strong><small>records</small></span></div>
          <div className="security-chart-legend">{data.map((entry, index) => <div key={entry.name}><span style={{ backgroundColor: colors[index % colors.length] }} /><span>{entry.name}</span><strong>{entry.value}</strong></div>)}</div>
        </div>}
    </section>
  )
}

export function SecurityCenterPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { session, user, profile, signOut, updatePassword } = useAuth()
  const accessToken = session?.access_token ?? ''
  const userId = user?.id ?? ''
  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const section = pathname === '/security' ? 'dashboard' : pathname.replace('/security/', '') as CenterSection
  const currentSection: CenterSection = navigation.some((item) => item.id === section) ? section : 'dashboard'
  const [days, setDays] = useState<PeriodDays>(30)
  const dashboardKey = `${userId}:${days}`
  const [dashboardState, setDashboardState] = useState<{
    key: string
    data: SecurityDashboard | null
    error: string
  }>({ key: '', data: null, error: '' })
  const dashboard = dashboardState.key === dashboardKey ? dashboardState.data : null
  const dashboardLoading = dashboardState.key !== dashboardKey
  const dashboardError = dashboardState.key === dashboardKey ? dashboardState.error : ''
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [alertSeverity, setAlertSeverity] = useState<'all' | AlertSeverity>('all')
  const [alertError, setAlertError] = useState('')
  const [alertBusy, setAlertBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('connecting')
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [preferencesError, setPreferencesError] = useState('')
  const [preferencesBusy, setPreferencesBusy] = useState(false)
  const [pushConfiguration, setPushConfiguration] = useState<WebPushConfiguration | null>(null)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushSubscriptionKnown, setPushSubscriptionKnown] = useState(!pushSupported)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [providers, setProviders] = useState<ProviderConfiguration[]>([])
  const [providersError, setProvidersError] = useState('')
  const [indicatorType, setIndicatorType] = useState<'url' | 'domain' | 'hash'>('url')
  const [indicator, setIndicator] = useState('')
  const [shareWithProviders, setShareWithProviders] = useState(false)
  const [threatResult, setThreatResult] = useState<ThreatResult | null>(null)
  const [threatError, setThreatError] = useState('')
  const [threatLoading, setThreatLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  const refreshDashboard = async () => {
    if (!accessToken) return
    const result = await loadSecurityDashboard(accessToken, days)
    setDashboardState({ key: dashboardKey, data: result, error: '' })
    setAlerts(result.alerts)
  }

  useEffect(() => {
    let active = true
    void loadSecurityDashboard(accessToken, days)
      .then((result) => {
        if (active) {
          setDashboardState({ key: dashboardKey, data: result, error: '' })
          setAlerts(result.alerts)
        }
      })
      .catch((error: unknown) => {
        if (active) setDashboardState({
          key: dashboardKey,
          data: null,
          error: error instanceof Error ? error.message : 'Dashboard data could not be loaded.',
        })
      })
    return () => { active = false }
  }, [accessToken, dashboardKey, days])

  useEffect(() => {
    if (currentSection !== 'alerts') return
    let active = true
    void loadSecurityAlerts(accessToken, alertSeverity)
      .then((result) => {
        if (active) {
          setAlerts(result)
          setAlertError('')
        }
      })
      .catch((error: unknown) => {
        if (active) setAlertError(error instanceof Error ? error.message : 'Alerts could not be loaded.')
      })
    return () => { active = false }
  }, [accessToken, currentSection, alertSeverity])

  useEffect(() => {
    if (currentSection !== 'threats') return
    let active = true
    void loadThreatProviders(accessToken)
      .then((result) => {
        if (active) {
          setProviders(result)
          setProvidersError('')
        }
      })
      .catch((error: unknown) => {
        if (active) setProvidersError(error instanceof Error ? error.message : 'Provider status could not be loaded.')
      })
    return () => { active = false }
  }, [accessToken, currentSection])

  useEffect(() => {
    if (currentSection !== 'account') return
    let active = true
    void loadNotificationPreferences(accessToken)
      .then((result) => {
        if (active) {
          setPreferences(result)
          setPreferencesError('')
        }
      })
      .catch((error: unknown) => {
        if (active) setPreferencesError(error instanceof Error ? error.message : 'Notification preferences could not be loaded.')
      })
    return () => { active = false }
  }, [accessToken, currentSection])

  useEffect(() => {
    let active = true
    void loadWebPushConfiguration(accessToken)
      .then(async (configuration) => {
        if (active) setPushConfiguration(configuration)
        if (pushSupported) {
          const registration = await navigator.serviceWorker.getRegistration()
          const subscription = registration
            ? await registration.pushManager.getSubscription()
            : null
          if (active) setPushSubscribed(subscription !== null)
        }
        if (active) setPushSubscriptionKnown(true)
      })
      .catch((error: unknown) => {
        if (active) {
          setPushError(error instanceof Error ? error.message : 'Push configuration could not be loaded.')
          setPushSubscriptionKnown(true)
        }
      })
    return () => { active = false }
  }, [accessToken, pushSupported])

  useEffect(() => {
    if (!['dashboard', 'alerts'].includes(currentSection)) return
    if (!supabase || !userId) return
    let active = true
    const channel = supabase
      .channel(`security-alerts-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'security_alerts',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' && isSecurityAlert(payload.new)) {
          const newAlert = payload.new
          setAlerts((current) => [newAlert, ...current.filter((alert) => alert.id !== newAlert.id)].slice(0, 100))
          setNotice('A new security alert was received.')
          void Promise.all([
            loadSecurityDashboard(accessToken, days).then((result) => {
              if (active) setDashboardState({ key: dashboardKey, data: result, error: '' })
            }),
            loadSecurityAlerts(accessToken, alertSeverity).then((result) => { if (active) setAlerts(result) }),
          ]).catch((error: unknown) => {
            if (active) setAlertError(error instanceof Error ? error.message : 'Updated alert data could not be loaded.')
          })
          if (
            pushSubscriptionKnown &&
            !pushSubscribed &&
            preferences?.browser_notifications &&
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            (newAlert.severity === 'critical'
              ? preferences.critical_alerts
              : newAlert.severity === 'high'
                ? preferences.high_risk_alerts
                : preferences.investigation_updates)
          ) {
            try {
              new Notification(newAlert.title, { body: newAlert.summary, tag: newAlert.id })
            } catch {
              setNotice('An alert arrived, but this browser could not display a desktop notification.')
            }
          }
        } else if (payload.eventType === 'UPDATE' && isSecurityAlert(payload.new)) {
          const updatedAlert = payload.new
          setAlerts((current) => current.map((alert) => alert.id === updatedAlert.id ? updatedAlert : alert))
        } else if (payload.eventType === 'DELETE') {
          const deletedId = typeof payload.old.id === 'string' ? payload.old.id : ''
          if (deletedId) setAlerts((current) => current.filter((alert) => alert.id !== deletedId))
        }
      })
      .subscribe((status) => {
        if (!active) return
        setRealtimeState(status === 'SUBSCRIBED' ? 'connected' :
          status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'error' : 'connecting')
      })
    return () => {
      active = false
      void supabase?.removeChannel(channel)
    }
  }, [accessToken, alertSeverity, currentSection, dashboardKey, days, preferences, pushSubscribed, pushSubscriptionKnown, userId])

  const chartActivity = useMemo(() => fillActivityGaps(dashboard), [dashboard])
  const scanTotalInWindow = dashboard?.riskDistribution.reduce((total, item) => total + item.value, 0) ?? 0
  const investigationTotal = dashboard?.investigationDistribution.reduce((total, item) => total + item.value, 0) ?? 0
  const unreadAlerts = dashboard?.unreadAlertCount ?? alerts.filter((alert) => !alert.read_at).length
  const realtimeDisplayState: RealtimeState = !supabase || !userId ? 'unavailable' : realtimeState
  const isEmpty = Boolean(
    dashboard &&
    dashboard.summary.totalScans === 0 &&
    dashboard.summary.activeInvestigations === 0 &&
    dashboard.summary.resolvedInvestigations === 0 &&
    dashboard.recentEvents.length === 0,
  )

  const handleAlertRead = async (alert: SecurityAlert) => {
    if (alertBusy) return
    setAlertBusy(true)
    setAlertError('')
    try {
      await markAlertRead(accessToken, alert.id)
      const now = new Date().toISOString()
      setAlerts((current) => current.map((item) => item.id === alert.id ? { ...item, read_at: now } : item))
      await refreshDashboard()
    } catch (error) {
      setAlertError(error instanceof Error ? error.message : 'The alert could not be marked read.')
    } finally {
      setAlertBusy(false)
    }
  }

  const handleMarkAllRead = async () => {
    if (alertBusy) return
    setAlertBusy(true)
    setAlertError('')
    try {
      await markAllAlertsRead(accessToken)
      const now = new Date().toISOString()
      setAlerts((current) => current.map((alert) => ({ ...alert, read_at: alert.read_at ?? now })))
      await refreshDashboard()
      setNotice('All security alerts were marked as read.')
    } catch (error) {
      setAlertError(error instanceof Error ? error.message : 'Alerts could not be marked read.')
    } finally {
      setAlertBusy(false)
    }
  }

  const handleDeleteAlert = async (alert: SecurityAlert) => {
    if (alertBusy) return
    setAlertBusy(true)
    setAlertError('')
    try {
      await removeAlert(accessToken, alert.id)
      setAlerts((current) => current.filter((item) => item.id !== alert.id))
      await refreshDashboard()
    } catch (error) {
      setAlertError(error instanceof Error ? error.message : 'The alert could not be deleted.')
    } finally {
      setAlertBusy(false)
    }
  }


  const handlePreferenceChange = async (key: keyof NotificationPreferences, checked: boolean) => {
    if (!preferences) return
    const next = { ...preferences, [key]: checked }
    setPreferences(next)
    setPreferencesBusy(true)
    setPreferencesError('')
    try {
      setPreferences(await saveNotificationPreferences(accessToken, next))
    } catch (error) {
      setPreferencesError(error instanceof Error ? error.message : 'The preference could not be saved.')
      try {
        setPreferences(await loadNotificationPreferences(accessToken))
      } catch {
        setPreferences(null)
      }
    } finally {
      setPreferencesBusy(false)
    }
  }

  const enableBrowserNotifications = async () => {
    setPreferencesError('')
    if (!('Notification' in window)) {
      setPreferencesError('This browser does not support desktop notifications.')
      return
    }
    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }
    if (permission !== 'granted') {
      setPreferencesError('Browser permission was not granted. No notifications will be displayed.')
      return
    }
    await handlePreferenceChange('browser_notifications', true)
  }

  const enablePushNotifications = async () => {
    if (pushBusy) return
    setPushError('')
    if (!pushSupported) {
      setPushError('This browser does not support service-worker push notifications.')
      return
    }
    if (!pushConfiguration?.configured || !pushConfiguration.publicKey) {
      setPushError('Web Push is not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT on the backend, then restart it.')
      return
    }
    setPushBusy(true)
    try {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission
      if (permission !== 'granted') {
        setPushError('Notification permission was not granted. No push subscription was created.')
        return
      }
      const registration = await navigator.serviceWorker.getRegistration() ??
        await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(pushConfiguration.publicKey),
      })
      const json = subscription.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        await subscription.unsubscribe()
        throw new Error('The browser returned an incomplete push subscription.')
      }
      try {
        await saveWebPushSubscription(accessToken, {
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        })
      } catch (error) {
        await subscription.unsubscribe()
        throw error
      }
      setPushSubscribed(true)
      setPushSubscriptionKnown(true)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Push notifications could not be enabled.')
    } finally {
      setPushBusy(false)
    }
  }

  const disablePushNotifications = async () => {
    if (pushBusy || !pushSupported) return
    setPushBusy(true)
    setPushError('')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await deleteWebPushSubscription(accessToken, subscription.endpoint)
        const removed = await subscription.unsubscribe()
        if (!removed) throw new Error('The browser did not confirm the push subscription was removed.')
      }
      setPushSubscribed(false)
      setPushSubscriptionKnown(true)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Push notifications could not be disabled.')
    } finally {
      setPushBusy(false)
    }
  }

  const submitThreatCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (threatLoading) return
    setThreatError('')
    setThreatResult(null)
    if (!shareWithProviders) {
      setThreatError('Confirm explicitly before sending this indicator to configured providers.')
      return
    }
    setThreatLoading(true)
    try {
      setThreatResult(await checkThreatIndicator(accessToken, indicatorType, indicator.trim()))
    } catch (error) {
      setThreatError(error instanceof Error ? error.message : 'The reputation check could not be completed.')
    } finally {
      setThreatLoading(false)
    }
  }

  const submitPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (passwordBusy) return
    setPasswordError('')
    setPasswordMessage('')
    if (password.length < 12) {
      setPasswordError('Choose a password with at least 12 characters.')
      return
    }
    if (password !== passwordConfirmation) {
      setPasswordError('The passwords do not match.')
      return
    }
    setPasswordBusy(true)
    try {
      await updatePassword(password)
      setPassword('')
      setPasswordConfirmation('')
      setPasswordMessage('Your password was updated.')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'The password could not be updated.')
    } finally {
      setPasswordBusy(false)
    }
  }


  const signOutEverywhere = async () => {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (error) {
      setAlertError(error instanceof Error ? error.message : 'Sign out could not be completed.')
      setSigningOut(false)
    }
  }

  const displayName = profile?.full_name || user?.user_metadata.full_name || 'CyberSaathi member'
  return (
    <section className="security-center-page">
      <header className="security-hero">
        <div className="security-hero-copy"><p className="eyebrow">CYBERSAATHI AI / SECURITY OPERATIONS</p><h1>Security command<br /><span>center.</span></h1><p>Your saved activity, threat checks, and learning progress—grounded in your own account data.</p><div className="security-hero-meta"><span><ShieldCheck size={14} /> Personal data only</span><span><Activity size={14} /> Evidence-led insights</span><span><Clock3 size={14} /> Updated {dashboard ? formatTime(dashboard.generatedAt) : 'when data is available'}</span></div></div>
        <div className="security-hero-mark" aria-hidden="true"><div className="security-hero-orbit" /><ShieldCheck size={48} strokeWidth={1.3} /></div>
      </header>

      <nav className="security-center-nav" aria-label="Security center">
        {navigation.map(({ id, title, icon: Icon }) => <Link aria-current={currentSection === id ? 'page' : undefined} className={currentSection === id ? 'security-center-tab active' : 'security-center-tab'} key={id} to={id === 'dashboard' ? '/security' : `/security/${id}`}><Icon size={15} />{title}{id === 'alerts' && unreadAlerts > 0 && <span className="security-nav-count">{unreadAlerts > 99 ? '99+' : unreadAlerts}</span>}</Link>)}
      </nav>

      {notice && <div className="security-notice" role="status"><Check size={15} />{notice}<button aria-label="Dismiss message" onClick={() => setNotice('')} type="button"><X size={14} /></button></div>}
      {dashboardError && <p className="security-inline-error" role="alert">{dashboardError} <button className="security-inline-retry" onClick={() => { void refreshDashboard().catch((error: unknown) => setDashboardState({ key: dashboardKey, data: null, error: error instanceof Error ? error.message : 'Dashboard data could not be loaded.' })) }} type="button">Retry</button></p>}

      {currentSection === 'dashboard' && (
        <div className="security-view">
          <div className="security-view-heading"><div><p className="eyebrow">ACCOUNT SNAPSHOT</p><h2>Your security overview</h2><p>Counts come from your saved scans, investigations, and learning activity.</p></div><div className="security-period-picker" aria-label="Activity chart period">{([7, 30, 90, 365] as PeriodDays[]).map((period) => <button aria-pressed={days === period} key={period} onClick={() => setDays(period)} type="button">{period === 365 ? '12 mo' : `${period} d`}</button>)}</div></div>
          {dashboardLoading && <div className="security-loading" role="status"><LoaderCircle size={18} /> Loading account records…</div>}
          {!dashboardLoading && dashboard && isEmpty && <div className="security-empty-state"><span><ShieldCheck size={25} /></span><h2>Your command center is ready</h2><p>No saved scans or investigations yet. Use the scam scanner or create an investigation to see real, account-specific security activity here.</p><div><Link className="security-action-link" to="/scanner">Open scam scanner <ArrowUpRight size={14} /></Link><Link className="security-action-link" to="/investigations">Start an investigation <ArrowUpRight size={14} /></Link></div></div>}
          {!dashboardLoading && dashboard && <>
            <div className="security-stat-grid">
              <article className="security-stat-card"><span className="security-stat-icon"><ScanSearchIcon /></span><small>TOTAL SCANS</small><strong>{dashboard.summary.totalScans.toLocaleString()}</strong><span>Saved scans · all time</span></article>
              <article className="security-stat-card"><span className="security-stat-icon stat-safe"><ShieldCheck size={17} /></span><small>LIKELY SAFE</small><strong>{dashboard.summary.safeScans.toLocaleString()}</strong><span>No safety guarantee implied</span></article>
              <article className="security-stat-card"><span className="security-stat-icon stat-warning"><AlertTriangle size={17} /></span><small>SUSPICIOUS</small><strong>{dashboard.summary.suspiciousScans.toLocaleString()}</strong><span>Recorded verdicts · all time</span></article>
              <article className="security-stat-card"><span className="security-stat-icon stat-danger"><ShieldAlert size={17} /></span><small>LIKELY MALICIOUS</small><strong>{dashboard.summary.maliciousScans.toLocaleString()}</strong><span>Recorded verdicts · all time</span></article>
              <article className="security-stat-card"><span className="security-stat-icon stat-investigation"><Fingerprint size={17} /></span><small>ACTIVE CASES</small><strong>{dashboard.summary.activeInvestigations.toLocaleString()}</strong><span>{dashboard.summary.openInvestigations} open · {dashboard.summary.inProgressInvestigations} in progress</span></article>
              <article className="security-stat-card"><span className="security-stat-icon stat-learning"><CheckCheck size={17} /></span><small>RESOLVED CASES</small><strong>{dashboard.summary.resolvedInvestigations.toLocaleString()}</strong><span>Saved investigations</span></article>
            </div>
            <div className="security-dashboard-charts">
              <section className="security-panel security-chart-card security-activity-chart"><div className="security-section-heading"><div><h2>Security activity</h2><p>Saved scans, investigation events, and lesson completions · {dashboard.chartGranularity === 'day' ? 'daily' : 'monthly'} · UTC</p></div><span className={`security-realtime-state state-${realtimeDisplayState}`}><i />{realtimeDisplayState === 'connected' ? 'Live alerts' : realtimeDisplayState === 'connecting' ? 'Connecting' : realtimeDisplayState === 'error' ? 'Realtime unavailable' : 'Offline'}</span></div>{chartActivity.some((item) => item.scans + item.investigations + item.lessons > 0) ? <ResponsiveContainer width="100%" height={235}><AreaChart data={chartActivity} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="scanFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#62d1de" stopOpacity={0.28} /><stop offset="95%" stopColor="#62d1de" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(164,180,214,.09)" strokeDasharray="3 5" /><XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} minTickGap={23} /><YAxis allowDecimals={false} tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} /><Tooltip content={<ActivityTooltip />} /><Legend wrapperStyle={{ color: '#9aa7bc', fontSize: 9 }} /><Area dataKey="scans" name="Scans" stroke="#62d1de" strokeWidth={2} fill="url(#scanFill)" /><Area dataKey="investigations" name="Investigation events" stroke="#a48cf4" strokeWidth={1.5} fill="transparent" /><Area dataKey="lessons" name="Lessons completed" stroke="#80d7ad" strokeWidth={1.5} fill="transparent" /></AreaChart></ResponsiveContainer> : <EmptyChart title="No activity in this period" description="Try a wider date range or use a feature to create saved activity." />}</section>
              <DonutCard title="Risk distribution" description={`Saved scan risk levels in the selected ${days}-day period.`} data={dashboard.riskDistribution} colors={chartColors} />
              <DonutCard title="Investigation status" description="All current investigation records." data={dashboard.investigationDistribution} colors={['#63d2df', '#8b94ff', '#80d7ad']} />
              <section className="security-panel security-chart-card"><div className="security-section-heading"><div><h2>Learning activity</h2><p>Lessons completed per {dashboard.chartGranularity === 'day' ? 'day' : 'month'} · selected period</p></div></div>{chartActivity.some((item) => item.lessons > 0) ? <ResponsiveContainer width="100%" height={180}><LineChart data={chartActivity} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="rgba(164,180,214,.09)" strokeDasharray="3 5" /><XAxis dataKey="date" tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} minTickGap={26} /><YAxis allowDecimals={false} tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} /><Tooltip content={<ActivityTooltip />} /><Line dataKey="lessons" name="Lessons completed" type="monotone" stroke="#80d7ad" strokeWidth={2} dot={false} activeDot={{ r: 4 }} /></LineChart></ResponsiveContainer> : <EmptyChart title="No saved lessons yet" description="Completed academy lessons will appear here." />}</section>
            </div>
            <div className="security-lower-grid">
              <section className="security-panel"><div className="security-section-heading"><div><h2>Recent security alerts</h2><p>Generated from high-risk saved scans and investigation events.</p></div><Link to="/security/alerts">View all <ArrowUpRight size={13} /></Link></div>{dashboard.alerts.length ? <div className="security-mini-alerts">{dashboard.alerts.slice(0, 5).map((alert) => <div key={alert.id} className="security-mini-alert"><span className={`security-alert-marker severity-${alert.severity}`} /><span><strong>{alert.title}</strong><small>{alert.summary}</small></span><time>{formatTime(alert.created_at)}</time></div>)}</div> : <EmptyChart title="No security alerts" description="Alerts are created from saved high-risk scan and investigation records." />}</section>
              <section className="security-panel"><div className="security-section-heading"><div><h2>Recent account activity</h2><p>Observed in your saved scans, cases, and learning history.</p></div><Link to="/security/analytics">Analytics <ArrowUpRight size={13} /></Link></div>{dashboard.recentEvents.length ? <div className="security-mini-events">{dashboard.recentEvents.slice(0, 6).map((event) => <article key={event.id}><span className={`security-event-glyph event-${event.kind}`}>{event.kind === 'scan' ? <Search size={14} /> : event.kind === 'investigation' ? <Fingerprint size={14} /> : <CheckCheck size={14} />}</span><span><strong>{event.title}</strong><small>{event.detail} · {formatTime(event.created_at)}</small></span></article>)}</div> : <EmptyChart title="No saved events yet" description="Your saved security activity will appear here." />}</section>
            </div>
            {dashboard.dataLimits.truncated && <p className="security-data-note" role="status">Charts and insights use a capped activity sample of {dashboard.dataLimits.chartRecordLimit.toLocaleString()} records for this period. Lifetime totals use exact database counts.</p>}
            {!dashboard.communityActivity.available && <p className="security-data-note"><Users size={14} /> Community security activity is unavailable: {dashboard.communityActivity.reason}</p>}
          </>}
        </div>
      )}

      {currentSection === 'safety-score' && (
        <section className="security-panel">
          <SafetyScoreSection accessToken={accessToken} />
        </section>
      )}

      {currentSection === 'soc' && (
        <section className="security-panel">
          <SocOverviewSection accessToken={accessToken} />
        </section>
      )}

      {currentSection === 'threats' && (
        <section className="security-panel security-threat-view">
          <div className="security-view-heading"><div><p className="eyebrow">THREAT INTELLIGENCE</p><h2>Reputation check</h2><p>Query existing reports from configured providers. Destinations are never fetched by this server.</p></div><Globe size={23} /></div>
          <div className="security-provider-grid">{providers.map((provider) => <article key={provider.name} className="security-provider-card"><span className={provider.configured ? 'provider-dot configured' : 'provider-dot'} /><span><strong>{provider.name}</strong><small>{provider.configured ? 'Configured on backend' : 'Not configured'}</small></span></article>)}{providersError && <p className="security-inline-error" role="alert">{providersError}</p>}{!providers.length && !providersError && <div className="security-loading"><LoaderCircle size={16} /> Checking provider configuration…</div>}</div>
          <form className="security-threat-form" onSubmit={(event) => void submitThreatCheck(event)}>
            <div className="security-indicator-tabs"><button aria-pressed={indicatorType === 'url'} onClick={() => { setIndicatorType('url'); setThreatResult(null) }} type="button">URL</button><button aria-pressed={indicatorType === 'domain'} onClick={() => { setIndicatorType('domain'); setThreatResult(null) }} type="button">Domain</button><button aria-pressed={indicatorType === 'hash'} onClick={() => { setIndicatorType('hash'); setThreatResult(null) }} type="button">File hash</button></div>
            <label htmlFor="threat-indicator">{indicatorType === 'url' ? 'URL to check' : indicatorType === 'domain' ? 'Domain to check' : 'File hash to check'}</label><input autoComplete="off" id="threat-indicator" maxLength={indicatorType === 'hash' ? 64 : 2048} onChange={(event) => setIndicator(event.target.value)} placeholder={indicatorType === 'url' ? 'https://example.com/path' : indicatorType === 'domain' ? 'example.com' : 'MD5, SHA-1, or SHA-256'} required value={indicator} />
            <label className="security-consent"><input checked={shareWithProviders} onChange={(event) => setShareWithProviders(event.target.checked)} type="checkbox" /><span>I explicitly agree to share this {indicatorType === 'hash' ? 'file hash' : indicatorType} with configured reputation providers to check existing records.</span></label>
            <p className="security-privacy-hint"><Shield size={14} /> No file is uploaded to VirusTotal, no page is opened, and the indicator is not retained by this application.</p>
            {threatError && <p className="security-inline-error" role="alert">{threatError}</p>}
            <button className="security-button security-button-primary" disabled={threatLoading || !indicator.trim() || !shareWithProviders} type="submit">{threatLoading ? <><LoaderCircle className="security-spinner" size={15} /> Checking provider reports…</> : <><Search size={15} /> Check reputation</>}</button>
          </form>
          {threatResult && <section className={`security-threat-result determination-${threatResult.determination}`} aria-live="polite">
            <div className="security-threat-result-heading"><span className="security-threat-result-icon">{threatResult.determination === 'threat_found' ? <ShieldAlert size={19} /> : threatResult.determination === 'no_match' ? <ShieldCheck size={19} /> : <AlertCircle size={19} />}</span><div><small>{threatResult.type === 'url' ? 'URL' : threatResult.type === 'domain' ? 'DOMAIN' : 'FILE HASH'} / LAST CHECKED {formatTime(threatResult.checkedAt)}</small><h3>{threatResult.indicator}</h3></div><span className={`security-result-pill result-${threatResult.determination}`}>{threatResult.determination === 'threat_found' ? 'THREAT REPORTED' : threatResult.determination === 'no_match' ? 'NO MATCH REPORTED' : 'INCONCLUSIVE'}</span></div>
            <p className="security-confidence-note">{threatResult.confidence}</p>
            {threatResult.determination === 'no_match' && <p className="security-caution"><AlertCircle size={14} /> No matches in these reports do not prove that the indicator is safe. Reports may be incomplete, stale, or unavailable.</p>}
            <div className="security-provider-results">{threatResult.providers.map((provider) => <article key={provider.name}><span className={`provider-dot provider-${provider.status}`} /><span><strong>{provider.name}</strong><small>{provider.detail}</small>{provider.evidence?.map((evidence) => <small className="security-provider-evidence" key={evidence}>{evidence}</small>)}</span>{provider.malicious !== undefined && <b>{provider.malicious} malicious · {provider.suspicious} suspicious</b>}</article>)}</div>
            {threatResult.findings.length > 0 && <div className="security-threat-findings"><h4>Findings and indicators</h4>{threatResult.findings.map((finding, index) => <article key={`${finding.source}-${finding.title}-${index}`}><span className={`severity-badge severity-${finding.severity}`}>{finding.severity}</span><span><strong>{finding.title}</strong><small>{finding.detail}</small><small>Source: {finding.source} · {finding.verified ? 'Provider-reported' : 'Unverified local pattern'}</small></span></article>)}</div>}
          </section>}
          <p className="security-note">This tool checks existing provider data and local URL patterns only. It does not resolve domains, fetch destinations, inspect certificates, analyze files, or provide an antivirus verdict.</p>
        </section>
      )}

      {currentSection === 'alerts' && (
        <section className="security-panel security-alerts-view">
          <div className="security-view-heading"><div><p className="eyebrow">ALERT CENTER</p><h2>Your security alerts</h2><p>Alerts originate from persisted scan results and investigation changes.</p></div><span className={`security-realtime-state state-${realtimeDisplayState}`}><i />{realtimeDisplayState === 'connected' ? 'Realtime connected' : realtimeDisplayState === 'connecting' ? 'Connecting to realtime' : 'Realtime unavailable'}</span></div>
          <div className="security-alert-toolbar"><label>Filter by severity<select onChange={(event) => setAlertSeverity(event.target.value as 'all' | AlertSeverity)} value={alertSeverity}><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option></select></label><span>{unreadAlerts} unread</span><button className="security-button" disabled={alertBusy || unreadAlerts === 0} onClick={() => void handleMarkAllRead()} type="button"><CheckCheck size={14} /> Mark all read</button></div>
          {alertError && <p className="security-inline-error" role="alert">{alertError}</p>}
          {alerts.length ? <div className="security-alert-list">{alerts.filter((alert) => alertSeverity === 'all' || alert.severity === alertSeverity).map((alert) => <article className={`security-alert-item${alert.read_at ? ' alert-read' : ''}`} key={alert.id}><span className={`security-alert-marker severity-${alert.severity}`} /><div className="security-alert-copy"><div className="security-alert-title"><strong>{alert.title}</strong><span className={`severity-badge severity-${alert.severity}`}>{alert.severity}</span>{!alert.read_at && <span className="security-unread-badge">NEW</span>}</div><p>{alert.summary}</p><small>{alert.category.replaceAll('_', ' ')} · {formatTime(alert.created_at)} · {alert.entity_type} record</small></div><div className="security-alert-actions">{!alert.read_at && <button aria-label={`Mark ${alert.title} as read`} disabled={alertBusy} onClick={() => void handleAlertRead(alert)} type="button"><Check size={15} /></button>}<button aria-label={`Delete ${alert.title}`} disabled={alertBusy} onClick={() => void handleDeleteAlert(alert)} type="button"><Trash2 size={15} /></button></div></article>)}</div> : <div className="security-empty-state"><span><Bell size={24} /></span><h2>No alerts in this view</h2><p>Alerts are created for saved high-risk scan results and investigation evidence or status changes. Older activity is included when the migration is applied.</p></div>}
          <p className="security-note">The existing investigation model has no critical-severity field, and Nexconn has no user security-warning feed in this app. No critical investigation, account, or community alerts are fabricated.</p>
        </section>
      )}

      {currentSection === 'insights' && (
        <section className="security-panel security-insights-view">
          <div className="security-view-heading"><div><p className="eyebrow">PERSONALIZED RISK INSIGHTS</p><h2>Observed in your scans</h2><p>Deterministic counts from saved scanner findings in the selected {days}-day period; these are observations, not predictions.</p></div><div className="security-period-picker">{([7, 30, 90, 365] as PeriodDays[]).map((period) => <button aria-pressed={days === period} key={period} onClick={() => setDays(period)} type="button">{period === 365 ? '12 mo' : `${period} d`}</button>)}</div></div>
          {dashboardLoading && <div className="security-loading" role="status"><LoaderCircle size={18} /> Reviewing saved findings…</div>}
          {!dashboardLoading && dashboard && dashboard.observations.length ? <><div className="security-insight-list">{dashboard.observations.map((observation) => <article key={observation.category}><span className="security-insight-icon"><AlertTriangle size={17} /></span><div><div className="security-insight-heading"><strong>{observation.title}</strong><span>{observation.count} {observation.count === 1 ? 'observation' : 'observations'}</span></div><p>{observation.basis} {observation.verified > 0 ? `${observation.verified} observation(s) had a provider-verified finding.` : 'These are scanner indicators, not proof of compromise.'}</p>{observation.lessonId && <Link to="/academy">{lessonNames[observation.lessonId] ?? 'Recommended academy lesson'} <ArrowUpRight size={13} /></Link>}</div></article>)}</div><div className="security-insight-disclaimer"><ShieldCheck size={16} /> Recommendations are linked to observed scan patterns. CyberSaathi cannot inspect your devices, accounts, or activity outside saved app records.</div></> : !dashboardLoading && <div className="security-empty-state"><span><TrendingUp size={23} /></span><h2>No repeated patterns observed</h2><p>No saved scan findings were recorded in this period. This is not a prediction about future risk or an assessment of your devices.</p></div>}
          {dashboard?.dataLimits.truncated && <p className="security-data-note">The selected-period observation sample reached the {dashboard.dataLimits.chartRecordLimit.toLocaleString()}-record analysis limit.</p>}
        </section>
      )}

      {currentSection === 'analytics' && (
        <section className="security-panel security-analytics-view">
          <div className="security-view-heading"><div><p className="eyebrow">SECURITY ACTIVITY</p><h2>Saved-record analytics</h2><p>Scans, investigations, and academy completions grouped in UTC.</p></div><div className="security-period-picker">{([7, 30, 90, 365] as PeriodDays[]).map((period) => <button aria-pressed={days === period} key={period} onClick={() => setDays(period)} type="button">{period === 365 ? '12 mo' : `${period} d`}</button>)}</div></div>
          {dashboardLoading && <div className="security-loading" role="status"><LoaderCircle size={18} /> Loading saved activity…</div>}
          {!dashboardLoading && dashboard && <div className="security-analytics-grid">
            <section className="security-panel security-chart-card analytics-wide"><div className="security-section-heading"><div><h2>Scan activity over time</h2><p>Counts of saved scan results · {dashboard.chartGranularity} buckets</p></div></div>{chartActivity.some((item) => item.scans > 0) ? <ResponsiveContainer width="100%" height={245}><AreaChart data={chartActivity} margin={{ top: 8, right: 15, left: -18, bottom: 0 }}><defs><linearGradient id="analyticsScanFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#62d1de" stopOpacity={0.3} /><stop offset="100%" stopColor="#62d1de" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(164,180,214,.09)" strokeDasharray="3 5" /><XAxis dataKey="date" tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} minTickGap={25} /><YAxis allowDecimals={false} tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} /><Tooltip content={<ActivityTooltip />} /><Area dataKey="scans" name="Scans" stroke="#62d1de" strokeWidth={2} fill="url(#analyticsScanFill)" /></AreaChart></ResponsiveContainer> : <EmptyChart title="No scans in this period" description="Saved scanner activity will appear here." />}</section>
            <DonutCard title="Risk category distribution" description={`${scanTotalInWindow} saved scan records in this period.`} data={dashboard.riskDistribution} colors={chartColors} />
            <DonutCard title="Investigation status" description={`${investigationTotal} saved investigation records.`} data={dashboard.investigationDistribution} colors={['#63d2df', '#8b94ff', '#80d7ad']} />
            <section className="security-panel security-chart-card analytics-wide"><div className="security-section-heading"><div><h2>Monthly security activity</h2><p>Scans, investigation events, and lessons from the selected period.</p></div></div>{chartActivity.some((item) => item.scans + item.investigations + item.lessons > 0) ? <ResponsiveContainer width="100%" height={245}><BarChart data={chartActivity} margin={{ top: 8, right: 15, left: -18, bottom: 0 }}><CartesianGrid stroke="rgba(164,180,214,.09)" strokeDasharray="3 5" /><XAxis dataKey="date" tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} minTickGap={25} /><YAxis allowDecimals={false} tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} /><Tooltip content={<ActivityTooltip />} /><Legend wrapperStyle={{ color: '#9aa7bc', fontSize: 9 }} /><Bar dataKey="scans" name="Scans" fill="#63d2df" radius={[3, 3, 0, 0]} /><Bar dataKey="investigations" name="Investigation events" fill="#8b94ff" radius={[3, 3, 0, 0]} /><Bar dataKey="lessons" name="Lessons" fill="#80d7ad" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart title="No security activity in this period" description="The chart uses only saved records—no sample values are added." />}</section>
            <section className="security-panel security-chart-card"><div className="security-section-heading"><div><h2>Learning completions</h2><p>Saved lessons · {dashboard.chartGranularity} buckets</p></div></div>{chartActivity.some((item) => item.lessons > 0) ? <ResponsiveContainer width="100%" height={200}><LineChart data={chartActivity} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="rgba(164,180,214,.09)" strokeDasharray="3 5" /><XAxis dataKey="date" tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} minTickGap={24} /><YAxis allowDecimals={false} tick={{ fill: '#77849a', fontSize: 8 }} tickLine={false} axisLine={false} /><Tooltip content={<ActivityTooltip />} /><Line dataKey="lessons" name="Lessons completed" type="monotone" stroke="#80d7ad" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <EmptyChart title="No learning activity in this period" description="Completed academy lessons appear here." />}</section>
          </div>}
          {dashboard?.dataLimits.truncated && <p className="security-data-note">Charts are based on up to {dashboard.dataLimits.chartRecordLimit.toLocaleString()} records per source. Lifetime summary counts are exact.</p>}
        </section>
      )}

      {currentSection === 'account' && (
        <div className="security-account-view">
          <section className="security-panel"><div className="security-view-heading"><div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Session & account</h2><p>Information available from your authenticated Supabase session.</p></div><Fingerprint size={21} /></div><div className="security-session-card"><span className="security-session-indicator"><i /> Authenticated session</span><div><small>Account</small><strong>{displayName} · {user?.email}</strong></div><div><small>Most recent sign-in reported by the auth provider</small><strong>{user?.last_sign_in_at ? formatTime(user.last_sign_in_at) : 'Not available'}</strong></div><div><small>Current session expiry</small><strong>{session?.expires_at ? formatTime(new Date(session.expires_at * 1000).toISOString()) : 'Not provided by the auth provider'}</strong></div><div><small>Email confirmation</small><strong>{user?.email_confirmed_at ? `Confirmed ${formatTime(user.email_confirmed_at)}` : 'Not confirmed or not available'}</strong></div></div><p className="security-note">The app can display the current session’s expiry and the auth provider’s account sign-in timestamp, but cannot enumerate active devices or historical sessions.</p><Link className="security-button" to="/settings/permissions">Open permission center</Link><button className="security-button security-button-danger" disabled={signingOut} onClick={() => void signOutEverywhere()} type="button"><LogOut size={15} /> {signingOut ? 'Signing out…' : 'Sign out of all sessions'}</button></section>
          <section className="security-panel"><div className="security-section-heading"><div><h2>Change your password</h2><p>Use a unique password stored in a reputable password manager.</p></div><ShieldCheck size={18} /></div>{passwordError && <p className="security-inline-error" role="alert">{passwordError}</p>}{passwordMessage && <p className="security-success" role="status"><Check size={14} />{passwordMessage}</p>}<form className="security-password-form" onSubmit={(event) => void submitPasswordChange(event)}><label>New password<input autoComplete="new-password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label><label>Confirm new password<input autoComplete="new-password" minLength={12} onChange={(event) => setPasswordConfirmation(event.target.value)} required type="password" value={passwordConfirmation} /></label><button className="security-button security-button-primary" disabled={passwordBusy} type="submit">{passwordBusy ? 'Updating…' : 'Update password'}</button></form><p className="security-note">If you cannot sign in to update your password, use the account recovery flow from the sign-in page.</p></section>
          <section className="security-panel">
            <div className="security-section-heading"><div><h2>Notification preferences</h2><p>These preferences are saved to your authenticated account.</p></div><Bell size={18} /></div>
            {preferencesError && <p className="security-inline-error" role="alert">{preferencesError}</p>}
            {!preferences && !preferencesError && <div className="security-loading"><LoaderCircle size={16} /> Loading notification preferences…</div>}
            {preferences && <>
              <div className="security-preference-list">{preferenceLabels.map((item) => <label className="security-preference" key={item.key}><span><strong>{item.label}</strong><small>{item.description}</small></span><input checked={preferences[item.key]} disabled={preferencesBusy} onChange={(event) => void handlePreferenceChange(item.key, event.target.checked)} type="checkbox" /><i /></label>)}</div>
              <div className="security-browser-notification"><div><strong>Desktop notifications while the app is open</strong><small>Enabling asks this browser for notification permission after your action.</small></div><button className="security-button" disabled={preferencesBusy || preferences.browser_notifications} onClick={() => void enableBrowserNotifications()} type="button">{preferences.browser_notifications ? 'Enabled' : 'Enable desktop alerts'}</button>{preferences.browser_notifications && <button className="security-text-button" disabled={preferencesBusy} onClick={() => void handlePreferenceChange('browser_notifications', false)} type="button">Disable</button>}</div>
            </>}
          </section>
          <section className="security-panel">
            <div className="security-section-heading"><div><h2>Background push</h2><p>Receive non-sensitive alerts when CyberSaathi is closed, where supported.</p></div><Bell size={18} /></div>
            {pushError && <p className="security-inline-error" role="alert">{pushError}</p>}
            {!pushSupported && <p className="security-note">This browser does not support service-worker push notifications.</p>}
            {pushSupported && <>
              <p className="security-note">{pushConfiguration?.configured ? 'VAPID is configured on the backend. Push is sent for critical/high-risk saved scans and investigation status/evidence updates, subject to your saved notification preferences.' : 'Push delivery is unavailable until VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT are configured on the backend.'} Push text does not include scan contents, evidence, or investigation details.</p>
              <div className="security-browser-notification">
                <div><strong>{pushSubscribed ? 'Push enabled for this browser' : 'Enable push on this browser'}</strong><small>Clicking enable requests permission and registers this device’s push endpoint to your account.</small></div>
                {pushSubscribed
                  ? <button className="security-button" disabled={pushBusy} onClick={() => void disablePushNotifications()} type="button">{pushBusy ? 'Updating…' : 'Unsubscribe'}</button>
                  : <button className="security-button" disabled={pushBusy || !pushConfiguration?.configured} onClick={() => void enablePushNotifications()} type="button">{pushBusy ? 'Enabling…' : 'Enable Web Push'}</button>}
              </div>
            </>}
            <p className="security-note">Community warning feeds and scheduled learning reminders are not available, so those saved preferences do not currently generate push notifications.</p>
          </section>
        </div>
      )}
      <footer className="security-center-footer"><ShieldCheck size={14} /> Account-scoped data · No device scanning · No safety guarantees from missing detections</footer>
    </section>
  )
}

function ScanSearchIcon() {
  return <Search size={17} />
}
