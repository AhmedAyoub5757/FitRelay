import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react'
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Bell,
  BarChart2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Home,
  Calendar as CalendarIcon,
} from 'lucide-react'

// ─── Nav definition ─────────────────────────────────────────────
const navItems = [
  { to: '/app',           label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/members',   label: 'Members',   icon: Users },
  { to: '/app/payments',  label: 'Payments',  icon: CreditCard },
  { to: '/app/reminders', label: 'Reminders', icon: Bell },
  { to: '/app/reports',   label: 'Reports',   icon: BarChart2 },
  { to: '/app/settings',  label: 'Settings',  icon: Settings },
]

// ─── Breadcrumb builder ─────────────────────────────────────────
interface Crumb { label: string; to?: string }

function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation()
  const segments = pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean)

  if (segments.length === 0) return [{ label: 'Dashboard' }]

  const crumbs: Crumb[] = [{ label: 'Home', to: '/app' }]

  const segmentLabels: Record<string, string> = {
    members: 'Members',
    payments: 'Payments',
    reminders: 'Reminders',
    reports: 'Reports',
    settings: 'Settings',
  }

  segments.forEach((seg, idx) => {
    const isLast = idx === segments.length - 1
    const isKnown = segmentLabels[seg]
    const label = isKnown
      ? segmentLabels[seg]
      : seg.length > 20
        ? 'Member Details'
        : seg
    const to = '/app/' + segments.slice(0, idx + 1).join('/')
    crumbs.push(isLast ? { label } : { label, to })
  })

  return crumbs
}

// ─── Helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = 'fitrelay-sidebar-collapsed'

function getInitialCollapsed(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

function getInitials(name: string | null | undefined): string {
  if (!name) return 'O'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getFormattedDate(): string {
  try {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Today'
  }
}

// ─── Focus-trap hook ─────────────────────────────────────────────
function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !containerRef.current) return
    const el = containerRef.current
    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    first?.focus()
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (focusable.length === 0) { e.preventDefault(); return }
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, containerRef])
}

// ─── Main Component ───────────────────────────────────────────────
export function AppLayout() {
  const { appUser, signOut } = useAuth()
  const location = useLocation()
  const breadcrumbs = useBreadcrumbs()

  // Sidebar collapsed state — persisted
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch {}
      return next
    })
  }, [])

  // Mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef     = useRef<HTMLDivElement>(null)
  const hamburgerRef  = useRef<HTMLButtonElement>(null)

  // Sign-out popover
  const [showSignOut, setShowSignOut] = useState(false)
  const signOutRef = useRef<HTMLDivElement>(null)

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') { setDrawerOpen(false); hamburgerRef.current?.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [drawerOpen])

  // Close sign-out popover on outside click / Escape
  useEffect(() => {
    if (!showSignOut) return
    function handleClick(e: MouseEvent) {
      if (signOutRef.current && !signOutRef.current.contains(e.target as Node)) {
        setShowSignOut(false)
      }
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setShowSignOut(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [showSignOut])

  useFocusTrap(drawerOpen, drawerRef)

  const initials     = getInitials(appUser?.full_name)
  const displayName  = appUser?.full_name ?? 'Owner'
  const displayRole  = appUser?.role ?? 'Admin'
  const currentDate  = getFormattedDate()

  // ── Shared nav links ────────────────────────────────────────────
  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="nav-item__icon" aria-hidden="true">
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                </span>
                <span className="nav-item__label">{label}</span>
                <span className="nav-item__tooltip" role="tooltip">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    )
  }

  // ── User footer ─────────────────────────────────────────────────
  function UserFooter({ mode }: { mode: 'sidebar' | 'drawer' }) {
    const isDrawer = mode === 'drawer'
    return (
      <div className="sidebar-footer" ref={isDrawer ? undefined : signOutRef}>
        <button
          type="button"
          onClick={() => setShowSignOut(v => !v)}
          aria-expanded={showSignOut}
          aria-haspopup="true"
          className="sidebar-user"
        >
          <span className="sidebar-user__avatar" aria-hidden="true">{initials}</span>
          <span className="sidebar-user__info">
            <span className="sidebar-user__name">{displayName}</span>
            {displayRole && <span className="sidebar-user__role">{displayRole}</span>}
          </span>
          <ChevronRight size={14} className="sidebar-user__chevron" aria-hidden="true" />
        </button>

        {showSignOut && (
          <div className="signout-popover" role="menu">
            <div className="signout-popover__user">
              <span className="signout-popover__name">{displayName}</span>
              {displayRole && <span className="signout-popover__role">{displayRole}</span>}
            </div>
            <button
              role="menuitem"
              type="button"
              className="signout-popover__btn"
              onClick={async () => { setShowSignOut(false); await signOut() }}
            >
              <LogOut size={14} aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Breadcrumbs component ───────────────────────────────────────
  function Breadcrumbs() {
    if (breadcrumbs.length === 1 && !breadcrumbs[0].to) {
      return (
        <div className="topbar-breadcrumbs">
          <span className="topbar-breadcrumbs__current">{breadcrumbs[0].label}</span>
        </div>
      )
    }
    return (
      <nav className="topbar-breadcrumbs" aria-label="Breadcrumb">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <span key={i} className="topbar-breadcrumbs__item">
              {i > 0 && <span className="topbar-breadcrumbs__sep" aria-hidden="true">/</span>}
              {crumb.to && !isLast ? (
                <Link to={crumb.to} className="topbar-breadcrumbs__link">
                  {i === 0 ? <Home size={13} aria-hidden="true" /> : crumb.label}
                </Link>
              ) : (
                <span
                  className={isLast ? 'topbar-breadcrumbs__current' : 'topbar-breadcrumbs__link'}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {i === 0 ? <Home size={13} aria-hidden="true" /> : crumb.label}
                </span>
              )}
            </span>
          )
        })}
      </nav>
    )
  }

  return (
    <div className="app-shell">
      {/* ════════ DESKTOP SIDEBAR ════════ */}
      <aside
        className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}
        aria-label="Sidebar navigation"
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand__mark" aria-hidden="true">F</div>
          <span className="sidebar-brand__name">FitRelay</span>
        </div>

        <div className="sidebar-nav-wrap">
          <NavLinks />
        </div>

        <UserFooter mode="sidebar" />
      </aside>

      {/* ════════ MAIN CONTENT ════════ */}
      <div className="app-main">
        <header className="app-topbar">
          {/* LEFT: mobile hamburger + desktop sidebar toggle */}
          <div className="app-topbar__left">
            {/* Mobile hamburger */}
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="app-topbar__hamburger"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
            >
              <Menu size={20} aria-hidden="true" />
            </button>

            {/* Desktop sidebar toggle button */}
            <button
              type="button"
              onClick={toggleCollapsed}
              className="app-topbar__sidebar-toggle"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} aria-hidden="true" />
              ) : (
                <PanelLeftClose size={18} aria-hidden="true" />
              )}
            </button>
          </div>

          {/* CENTER: brand on mobile, rich breadcrumbs on desktop */}
          <div className="app-topbar__center">
            <span className="app-topbar__brand">FitRelay</span>
            <div className="app-topbar__breadcrumbs">
              <Breadcrumbs />
            </div>
          </div>

          {/* RIGHT: Live status indicator, date pill, and Theme toggle */}
          <div className="app-topbar__right">
            <div className="app-topbar__status" title="Gym operations active">
              <span className="app-topbar__status-dot" aria-hidden="true" />
              <span className="app-topbar__status-text">Operations Live</span>
            </div>

            <div className="app-topbar__date" title="Today's date">
              <CalendarIcon size={13} aria-hidden="true" />
              <span>{currentDate}</span>
            </div>

            <div className="app-topbar__divider" aria-hidden="true" />

            <ThemeToggle />
          </div>
        </header>

        <main className="app-content">
          <div key={location.pathname} className="route-transition-wrap">
            <Outlet />
          </div>
        </main>
      </div>

      {/* ════════ MOBILE DRAWER ════════ */}
      <div
        className={`drawer-backdrop${drawerOpen ? ' drawer-backdrop--open' : ''}`}
        aria-hidden="true"
        onClick={() => { setDrawerOpen(false); hamburgerRef.current?.focus() }}
      />
      <div
        id="mobile-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`drawer${drawerOpen ? ' drawer--open' : ''}`}
      >
        <div className="drawer-header">
          <div className="drawer-brand">
            <div className="sidebar-brand__mark" aria-hidden="true">F</div>
            <span className="sidebar-brand__name">FitRelay</span>
          </div>
          <button
            type="button"
            onClick={() => { setDrawerOpen(false); hamburgerRef.current?.focus() }}
            className="drawer-close"
            aria-label="Close navigation menu"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="drawer-nav-wrap">
          <NavLinks onNavigate={() => setDrawerOpen(false)} />
        </div>
        <UserFooter mode="drawer" />
      </div>
    </div>
  )
}
