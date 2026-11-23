import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import {
  useMemberStatusCounts, useGymOutstandingTotal, useTodaysCollections,
  usePendingReminderCount, useExpiringSoon,
} from '../features/dashboard/queries'

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-border p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`font-display text-3xl ${accent ? 'text-accent' : ''}`}>{value}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { data: counts } = useMemberStatusCounts()
  const { data: outstanding } = useGymOutstandingTotal()
  const { data: collections } = useTodaysCollections()
  const { data: pendingReminders } = usePendingReminderCount()
  const { data: expiringSoon } = useExpiringSoon()

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-wide">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active members" value={String(counts?.active ?? 0)} />
        <StatCard label="Frozen" value={String(counts?.frozen ?? 0)} />
        <StatCard label="Expired" value={String(counts?.expired ?? 0)} />
        <StatCard label="Outstanding (gym-wide)" value={outstanding != null ? outstanding.toFixed(2) : '—'} accent />
        <StatCard label="Collected today" value={collections != null ? collections.toFixed(2) : '—'} />
        <StatCard label="Pending reminders" value={String(pendingReminders ?? 0)} />
      </div>

      <section>
        <h2 className="mb-2 font-display text-xl tracking-wide">Expiring in the next 7 days</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4 font-medium">Member</th>
              <th className="py-2 pr-4 font-medium">Plan</th>
              <th className="py-2 pr-4 font-medium">End date</th>
            </tr>
          </thead>
          <tbody>
            {expiringSoon?.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-muted">Nothing expiring soon.</td></tr>
            )}
            {expiringSoon?.map((m) => (
              <tr key={m.id} className="border-b border-border">
                <td className="py-2 pr-4">
                  <Link to={`/app/members/${m.member.id}`} className="hover:underline">{m.member.full_name}</Link>
                </td>
                <td className="py-2 pr-4 text-muted">{m.plan_name_snapshot}</td>
                <td className="py-2 pr-4 text-muted">{m.end_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Link to="/app/reminders" className="group inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        View all reminders
        <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-1" />
      </Link>
    </div>
  )
}