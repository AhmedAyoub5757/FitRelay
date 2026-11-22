import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'

const navItems = [
  { to: '/app', label: 'Dashboard', end: true },
  { to: '/app/members', label: 'Members' },
  { to: '/app/payments', label: 'Payments' },
  { to: '/app/reminders', label: 'Reminders' },
  { to: '/app/reports', label: 'Reports' },
  { to: '/app/settings', label: 'Settings' },
]

export function AppLayout() {
  const { appUser, signOut } = useAuth()

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 flex-col border-r border-border bg-surface">
        <div className="px-5 py-5">
          <span className="font-display text-2xl tracking-wide text-accent">FitRelay</span>
        </div>

        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-l-2 border-accent bg-background text-accent'
                    : 'border-l-2 border-transparent text-muted hover:text-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-4">
          <p className="truncate text-sm font-medium">{appUser?.full_name ?? 'Owner'}</p>
          <button onClick={signOut} className="mt-1 text-xs text-muted underline">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-border px-6 py-3">
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}