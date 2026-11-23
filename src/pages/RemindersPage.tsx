import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useReminders, useMarkReminderSent, type ReminderStatusFilter } from '../features/reminders/queries'

const STAGE_LABELS: Record<string, string> = {
  '7_days_before': 'Expires in 7 days',
  '3_days_before': 'Expires in 3 days',
  'expiry_day': 'Expires today',
  '1_day_after': 'Expired yesterday',
}

function buildWhatsAppLink(phoneNormalized: string, message: string) {
  const digits = phoneNormalized.replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export default function RemindersPage() {
  const [status, setStatus] = useState<ReminderStatusFilter>('pending')
  const { data: reminders, isLoading } = useReminders(status)
  const markSent = useMarkReminderSent()

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-wide">Reminders</h1>

      <div className="flex gap-2">
        {(['pending', 'owner_confirmed_sent', 'resolved', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              status === s ? 'bg-accent text-white' : 'border border-border text-muted hover:text-foreground'
            }`}
          >
            {s === 'owner_confirmed_sent' ? 'Sent' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-4 font-medium">Member</th>
            <th className="py-2 pr-4 font-medium">Reason</th>
            <th className="py-2 pr-4 font-medium">Scheduled</th>
            <th className="py-2 pr-4 font-medium">Message</th>
            <th className="py-2 pr-4 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={5} className="py-4 text-center text-muted">Loading...</td></tr>
          )}
          {!isLoading && reminders?.length === 0 && (
            <tr><td colSpan={5} className="py-4 text-center text-muted">Nothing here.</td></tr>
          )}
          {reminders?.map((r) => (
            <tr key={r.id} className="border-b border-border align-top">
              <td className="py-2 pr-4">
                <Link to={`/app/members/${r.member.id}`} className="hover:underline">{r.member.full_name}</Link>
              </td>
              <td className="py-2 pr-4">
                {r.category === 'payment_due'
                  ? `Payment due${r.amount_snapshot ? ` (${Number(r.amount_snapshot).toFixed(2)})` : ''}`
                  : STAGE_LABELS[r.reminder_stage ?? ''] ?? r.reminder_stage}
              </td>
              <td className="py-2 pr-4 text-muted">{r.scheduled_for}</td>
              <td className="max-w-xs py-2 pr-4 text-muted">{r.message_snapshot}</td>
              <td className="py-2 pr-4">
                <div className="flex gap-2">
                  <a
                    href={buildWhatsAppLink(r.member.phone_normalized, r.message_snapshot ?? '')}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface"
                  >
                    WhatsApp
                  </a>
                  {r.status === 'pending' && (
                    <button
                      onClick={() => markSent.mutate(r.id)}
                      disabled={markSent.isPending}
                      className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Mark sent
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}