import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  BookOpen,
  Bot,
  ChevronLeft,
  Clock3,
  Fingerprint,
  HeartHandshake,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  PhoneCall,
  ScanSearch,
  Settings,
  Shield,
  ShieldAlert,
  Smartphone,
  Users,
  X,
} from 'lucide-react'

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const mobileNavigation = [
    { label: 'Home', path: '/', icon: LayoutDashboard, active: pathname === '/' },
    { label: 'Recovery', path: '/recovery', icon: LifeBuoy, active: pathname.startsWith('/recovery') },
    { label: 'Scan', path: '/scanner', icon: ScanSearch, active: pathname === '/scanner' },
    { label: 'Cases', path: '/investigations', icon: Fingerprint, active: pathname.startsWith('/investigations') },
    { label: 'Community', path: '/community', icon: Users, active: pathname === '/community' },
    { label: 'Academy', path: '/academy', icon: BookOpen, active: pathname.startsWith('/academy') },
    { label: 'Assistant', path: '/assistant', icon: Bot, active: pathname.startsWith('/assistant') },
    { label: 'Settings', path: '/security/account', icon: Settings, active: pathname.startsWith('/security') || pathname.startsWith('/settings') },
  ]

  return (
    <>
      <button
        className="mobile-menu-button"
        type="button"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
        <Link
          className="brand"
          to="/"
          onClick={() => setMobileOpen(false)}
        >
          <span className="brand-mark">
            <Shield aria-hidden="true" size={22} />
          </span>
          <span className="brand-copy">
            <strong>CyberSaathi</strong>
            <small>AI SECURITY PLATFORM</small>
          </span>
          <ChevronLeft aria-hidden="true" className="sidebar-collapse" size={17} />
        </Link>

        <div className="sidebar-section-label">WORKSPACE</div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          <Link
            className={`nav-item${pathname === '/' ? ' nav-item-active' : ''}`}
            to="/"
            onClick={() => setMobileOpen(false)}
          >
            <LayoutDashboard aria-hidden="true" size={18} />
            <span>Overview</span>
          </Link>
          <Link
            className={`nav-item${pathname.startsWith('/recovery') ? ' nav-item-active' : ''}`}
            to="/recovery"
            onClick={() => setMobileOpen(false)}
          >
            <LifeBuoy aria-hidden="true" size={18} />
            <span>Fraud recovery</span>
          </Link>
          <Link
            className={`nav-item${pathname.startsWith('/security') ? ' nav-item-active' : ''}`}
            to="/security"
            onClick={() => setMobileOpen(false)}
          >
            <ShieldAlert aria-hidden="true" size={18} />
            <span>Security center</span>
          </Link>
          <Link
            className={`nav-item${pathname === '/scanner' ? ' nav-item-active' : ''}`}
            to="/scanner"
            onClick={() => setMobileOpen(false)}
          >
            <ScanSearch aria-hidden="true" size={18} />
            <span>Scam scanner</span>
          </Link>
          <Link
            className={`nav-item${pathname === '/app-security' ? ' nav-item-active' : ''}`}
            to="/app-security"
            onClick={() => setMobileOpen(false)}
          >
            <Smartphone aria-hidden="true" size={18} />
            <span>App security</span>
          </Link>
          <Link
            className={`nav-item${pathname === '/call-security' ? ' nav-item-active' : ''}`}
            to="/call-security"
            onClick={() => setMobileOpen(false)}
          >
            <PhoneCall aria-hidden="true" size={18} />
            <span>Call analyzer</span>
          </Link>
          <Link
            className={`nav-item${pathname === '/family-safety' ? ' nav-item-active' : ''}`}
            to="/family-safety"
            onClick={() => setMobileOpen(false)}
          >
            <HeartHandshake aria-hidden="true" size={18} />
            <span>Family safety</span>
          </Link>
          <Link
            className={`nav-item${pathname.startsWith('/history') ? ' nav-item-active' : ''}`}
            to="/history"
            onClick={() => setMobileOpen(false)}
          >
            <Clock3 aria-hidden="true" size={18} />
            <span>Scan history</span>
          </Link>
          <Link
            className={`nav-item${pathname.startsWith('/investigations') ? ' nav-item-active' : ''}`}
            to="/investigations"
            onClick={() => setMobileOpen(false)}
          >
            <Fingerprint aria-hidden="true" size={18} />
            <span>Investigations</span>
          </Link>
          <Link
            className={`nav-item${pathname === '/community' ? ' nav-item-active' : ''}`}
            to="/community"
            onClick={() => setMobileOpen(false)}
          >
            <Users aria-hidden="true" size={18} />
            <span>Community</span>
          </Link>
          <Link
            className={`nav-item${pathname.startsWith('/academy') ? ' nav-item-active' : ''}`}
            to="/academy"
            onClick={() => setMobileOpen(false)}
          >
            <BookOpen aria-hidden="true" size={18} />
            <span>Cyber academy</span>
          </Link>
          <Link
            className={`nav-item${pathname.startsWith('/assistant') ? ' nav-item-active' : ''}`}
            to="/assistant"
            onClick={() => setMobileOpen(false)}
          >
            <Bot aria-hidden="true" size={18} />
            <span>CyberSaathi Assistant</span>
          </Link>
          <Link
            className="nav-item"
            to="/#connections"
            onClick={() => setMobileOpen(false)}
          >
            <Activity aria-hidden="true" size={18} />
            <span>System status</span>
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-privacy">
            <Shield aria-hidden="true" size={17} />
            <p>
              <strong>Privacy first</strong>
              <span>Assistant messages are saved to your account. Private context is shared only when you select it.</span>
            </p>
          </div>
          <Link className="nav-item nav-item-muted" to="/settings/permissions" onClick={() => setMobileOpen(false)}>
            <Settings aria-hidden="true" size={17} />
            <span>Permission center</span>
          </Link>
        </div>
      </aside>
      <nav className="mobile-bottom-nav" aria-label="Primary mobile navigation">
        {mobileNavigation.map(({ label, path, icon: Icon, active }) => (
          <Link aria-current={active ? 'page' : undefined} className={active ? 'mobile-nav-item active' : 'mobile-nav-item'} key={label} to={path}>
            <Icon aria-hidden="true" size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
