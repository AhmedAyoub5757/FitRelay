import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Clock } from 'lucide-react'
import { formatDate } from '../lib/formatDate'
import {
  useMemberStatusCounts, useGymOutstandingTotal, useTodaysCollections,
  usePendingReminderCount, useExpiringSoon,
} from '../features/dashboard/queries'
import { SkeletonCard, SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { CountUp } from '../components/CountUp'
import type { ReactNode } from 'react'

function StatCard({
  label, value, accent, loading,
}: { label: string; value: ReactNode; accent?: boolean; loading?: boolean }) {
  if (loading) return <SkeletonCard />
  return (
    <div className="stat-card">
      <p className="stat-card__label">{label}</p>
      <p className={`stat-card__value font-display${accent ? ' text-accent' : ''}`}>{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: counts,     isLoading: loadCounts }  = useMemberStatusCounts()
  const { data: outstanding, isLoading: loadOut }     = useGymOutstandingTotal()
  const { data: collections, isLoading: loadColl }    = useTodaysCollections()
  const { data: pendingReminders, isLoading: loadReminders } = usePendingReminderCount()
  const { data: expiringSoon, isLoading: loadExpiry } = useExpiringSoon()

  return (
    <div className="space-y-8">
      <h1 className="page-title">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Active members"
          loading={loadCounts}
          value={counts?.active != null ? <CountUp value={counts.active} /> : '0'}
        />
        <StatCard
          label="Frozen"
          loading={loadCounts}
          value={counts?.frozen != null ? <CountUp value={counts.frozen} /> : '0'}
        />
        <StatCard
          label="Expired"
          loading={loadCounts}
          value={counts?.expired != null ? <CountUp value={counts.expired} /> : '0'}
        />
        <StatCard
          label="Outstanding"
          accent
          loading={loadOut}
          value={outstanding != null ? <CountUp value={outstanding} decimals={2} prefix="Rs. " /> : '—'}
        />
        <StatCard
          label="Collected today"
          loading={loadColl}
          value={collections != null ? <CountUp value={collections} decimals={2} prefix="Rs. " /> : '—'}
        />
        <StatCard
          label="Pending reminders"
          loading={loadReminders}
          value={pendingReminders != null ? <CountUp value={pendingReminders} /> : '0'}
        />
      </div>

      <section>
        <h2 className="section-title">Expiring in the next 7 days</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Plan</th>
                <th>End date</th>
              </tr>
            </thead>
            <tbody>
              {loadExpiry && <SkeletonTable rows={4} cols={3} />}
              {!loadExpiry && (expiringSoon ?? []).map(m => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/app/members/${m.member.id}`)}
                  tabIndex={0}
                  role="link"
                  className="cursor-pointer hover:bg-surface/70 transition-colors focus-visible:outline-none focus-visible:bg-surface"
                  aria-label={`View member ${m.member.full_name}`}
                >
                  <td>
                    <span className="table-link font-semibold text-foreground">{m.member.full_name}</span>
                  </td>
                  <td className="text-muted">{m.plan_name_snapshot}</td>
                  <td className="text-muted">{formatDate(m.end_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loadExpiry && (expiringSoon?.length ?? 0) === 0 && (
            <EmptyState
              icon={<Clock size={28} />}
              title="No memberships expiring in the next 7 days"
              description="Check back here as renewal time approaches."
            />
          )}
        </div>
      </section>

      <Link to="/app/reminders" className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        View all reminders
        <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
      </Link>
    </div>
  )
}
