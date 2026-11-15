import { Suspense, lazy } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Fingerprint,
  LifeBuoy,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { AppSidebar } from './components/AppSidebar'
import { DevicePermissionsPage } from './components/DevicePermissionsPage'
import { ConnectionStatus } from './components/ConnectionStatus'
import { AccountMenu } from './auth/AccountMenu'
import { useAuth } from './auth/AuthContext'
import { useSystemStatus } from './hooks/useSystemStatus'
import { useLocation } from 'react-router-dom'
import './App.css'

const FraudRecoveryPage = lazy(() => import('./recovery/FraudRecoveryPage').then((module) => ({ default: module.FraudRecoveryPage })))
const DashboardScannerSummary = lazy(() => import('./scanner/DashboardScannerSummary').then((module) => ({ default: module.DashboardScannerSummary })))
const ScanHistoryPage = lazy(() => import('./scanner/ScanHistoryPage').then((module) => ({ default: module.ScanHistoryPage })))
const ScannerPage = lazy(() => import('./scanner/ScannerPage').then((module) => ({ default: module.ScannerPage })))
const AppScannerPage = lazy(() => import('./app-scanner/AppScannerPage').then((module) => ({ default: module.AppScannerPage })))
const CallScannerPage = lazy(() => import('./call-scanner/CallScannerPage').then((module) => ({ default: module.CallScannerPage })))
const FamilySafetyPage = lazy(() => import('./family-safety/FamilySafetyPage').then((module) => ({ default: module.FamilySafetyPage })))
const InvestigationRoom = lazy(() => import('./investigations/InvestigationRoom').then((module) => ({ default: module.InvestigationRoom })))
const CommunityPage = lazy(() => import('./community/CommunityPage').then((module) => ({ default: module.CommunityPage })))
const AcademyPage = lazy(() => import('./academy/AcademyPage').then((module) => ({ default: module.AcademyPage })))
const SecurityCenterPage = lazy(() => import('./security-center/SecurityCenterPage').then((module) => ({ default: module.SecurityCenterPage })))
const AssistantPage = lazy(() => import('./assistant/AssistantPage'))

const capabilities = [
  {
    title: 'Protect',
    description: 'Practical guidance to help strengthen your digital safety.',
    icon: LockKeyhole,
    status: 'AVAILABLE',
  },
  {
    title: 'Detect',
    description: 'Evidence-led checks for suspicious links and messages.',
    icon: ScanSearch,
    status: 'AVAILABLE',
  },
  {
    title: 'Investigate',
    description: 'Organize incident details and preserve useful context.',
    icon: Fingerprint,
    status: 'AVAILABLE',
  },
  {
    title: 'Recover',
    description: 'Golden Hour emergency actions, 1930 Helpline workflows & formal FIR complaint drafting.',
    icon: LifeBuoy,
    status: 'AVAILABLE',
  },
  {
    title: 'Learn',
    description: 'Build safer habits with clear, approachable education.',
    icon: BookOpen,
    status: 'IN DEVELOPMENT',
  },
]

function App() {
  const systemStatus = useSystemStatus()
  const { user, profile, profileError, profileLoading } = useAuth()
  const { pathname } = useLocation()
  const displayName = profile?.full_name || user?.user_metadata.full_name || 'Account'
  const isRecovery = pathname.startsWith('/recovery')
  const isAppSecurity = pathname === '/app-security'
  const isCallSecurity = pathname === '/call-security'
  const isFamilySafety = pathname === '/family-safety'
  const isScanner = pathname === '/scanner'
  const isHistory = pathname.startsWith('/history')
  const isInvestigation = pathname.startsWith('/investigations')
  const isCommunity = pathname === '/community'
  const isAcademy = pathname.startsWith('/academy')
  const isSecurityCenter = pathname.startsWith('/security')
  const isAssistant = pathname.startsWith('/assistant')
  const isPermissions = pathname === '/settings/permissions'
  const pageTitle = isRecovery
    ? 'Fraud recovery guide'
    : isAppSecurity
      ? 'Mobile app security'
      : isCallSecurity
        ? 'Call analyzer'
        : isFamilySafety
          ? 'Family safety circles'
          : isScanner
        ? 'Scam scanner'
        : isHistory
          ? 'Scan history'
          : isInvestigation
            ? 'Investigation room'
            : isCommunity
              ? 'Community chat'
              : isAcademy
                ? 'Cyber academy'
                : isSecurityCenter
                  ? pathname === '/security'
                    ? 'Security center'
                    : pathname.split('/').pop()?.replaceAll('-', ' ') ?? 'Security center'
                  : isAssistant
                    ? 'CyberSaathi Assistant'
                    : isPermissions
                      ? 'Permission center'
                      : 'Overview'

  return (
    <div className="app-shell">
      <AppSidebar />

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment-badge">
              <span className="state-dot state-dot-connected" />
              DEVELOPMENT
            </span>
            <AccountMenu />
          </div>
        </header>

        <div className="dashboard-content">
          {profileError && <p className="profile-warning" role="status">{profileError}</p>}
          {profileLoading && <p className="profile-loading" role="status">Loading your profile…</p>}
          <Suspense fallback={<div className="page-loading" role="status">Loading CyberSaathi…</div>}>
          {isRecovery
            ? <FraudRecoveryPage />
            : isAppSecurity
              ? <AppScannerPage />
              : isCallSecurity
                ? <CallScannerPage />
                : isFamilySafety
                  ? <FamilySafetyPage />
                : isScanner
                ? <ScannerPage />
                : isHistory
                  ? <ScanHistoryPage />
                  : isInvestigation
                    ? <InvestigationRoom />
                    : isCommunity
                      ? <CommunityPage />
                      : isAcademy
                        ? <AcademyPage />
                        : isSecurityCenter
                          ? <SecurityCenterPage />
                          : isAssistant
                            ? <AssistantPage />
                            : isPermissions
                              ? <DevicePermissionsPage />
                  : (
                <>
          <section className="welcome-row">
            <div>
              <p className="eyebrow">CYBERSAATHI AI / SECURITY CONSOLE</p>
              <h1>Welcome, {displayName.split(/\s+/)[0]}.<br /><span>Your digital world. Our protection.</span></h1>
              <p className="welcome-copy">
                A safer way to navigate digital threats starts with clear,
                trustworthy information.
              </p>
              <a className="button button-primary" href="#connections">
                <ShieldCheck aria-hidden="true" size={17} />
                View live connections
                <ArrowUpRight aria-hidden="true" size={16} />
              </a>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="hero-orbit hero-orbit-outer" />
              <div className="hero-orbit hero-orbit-inner" />
              <div className="hero-glow" />
              <div className="hero-shield">
                <ShieldCheck size={66} strokeWidth={1.35} />
              </div>
              <span className="orbit-node orbit-node-one" />
              <span className="orbit-node orbit-node-two" />
              <span className="orbit-node orbit-node-three" />
              <Sparkles className="hero-sparkle" size={20} />
            </div>
          </section>

          <div className="dashboard-grid dashboard-grid-single">
            <ConnectionStatus status={systemStatus} />
          </div>
          <DashboardScannerSummary />

          <section className="capabilities-section" aria-labelledby="capabilities-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">BUILT AROUND YOUR SAFETY</p>
                <h2 id="capabilities-title">A thoughtful approach to protection</h2>
              </div>
              <span className="section-note">Platform capabilities</span>
            </div>
            <div className="capability-grid">
              {capabilities.map(({ title, description, icon: Icon, status }) => (
                <article className="capability-card" key={title}>
                  <span className="capability-icon">
                    <Icon aria-hidden="true" size={19} />
                  </span>
                  <span className="capability-stage">{status}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <span className="capability-arrow" aria-hidden="true">
                    <ArrowUpRight size={16} />
                  </span>
                </article>
              ))}
            </div>
          </section>
                </>
              )}
          </Suspense>

          <footer className="dashboard-footer">
            <span>CyberSaathi AI</span>
            <span>Your Digital World. Our Protection.</span>
            <span className="footer-privacy">
              <ShieldCheck aria-hidden="true" size={14} />
              Privacy-first by design
            </span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App
