import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useReminders, useMarkReminderSent, type ReminderStatusFilter } from '../features/reminders/queries'
import { Pagination, usePagination } from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../context/ToastContext'
import { formatCurrency } from '../lib/formatCurrency'
import { formatDate } from '../lib/formatDate'
import { Spinner } from '../components/Spinner'
import { Bell } from 'lucide-react'

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

const PAGE_SIZE = 10

export default function RemindersPage() {
  const [status, setStatus] = useState<ReminderStatusFilter>('pending')
  const [page, setPage] = useState(1)
  const tableRef = useRef<HTMLDivElement>(null)

  const { data: reminders, isLoading } = useReminders(status)
  const markSent = useMarkReminderSent()
  const toast = useToast()

  useEffect(() => { setPage(1) }, [status])
  useEffect(() => { tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }, [page])

  const paged = usePagination(reminders ?? [], PAGE_SIZE, page)

  const emptyMessages: Record<string, string> = {
    pending: 'No pending reminders — you\'re all caught up!',
    owner_confirmed_sent: 'No sent reminders in this filter.',
    resolved: 'No resolved reminders yet.',
    all: 'No reminders found.',
  }

  return (
    <div className="page-container space-y-6">
      <h1 className="page-title">Reminders</h1>

      <div className="flex gap-2 flex-wrap">
        {(['pending', 'owner_confirmed_sent', 'resolved', 'all'] as const).map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              status === s ? 'bg-accent text-white' : 'border border-border text-muted hover:text-foreground'
            }`}
          >
            {s === 'owner_confirmed_sent' ? 'Sent' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div ref={tableRef} className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Reason</th>
              <th>Scheduled</th>
              <th>Message</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTable rows={6} cols={5} />}
            {!isLoading && paged.map(r => (
              <tr key={r.id} className="align-top">
                <td>
                  <Link to={`/app/members/${r.member.id}`} className="table-link">{r.member.full_name}</Link>
                </td>
                <td>
                  {r.category === 'payment_due'
                    ? `Payment due${r.amount_snapshot ? ` (${formatCurrency(r.amount_snapshot)})` : ''}`
                    : STAGE_LABELS[r.reminder_stage ?? ''] ?? r.reminder_stage}
                </td>
                <td className="text-muted">{formatDate(r.scheduled_for)}</td>
                <td className="max-w-xs text-muted">{r.message_snapshot}</td>
                <td>
                  <div className="flex gap-2">
                    <a
                      href={buildWhatsAppLink(r.member.phone_normalized, r.message_snapshot ?? '')}
                      target="_blank" rel="noreferrer"
                      className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface text-foreground transition-colors"
                    >
                      WhatsApp
                    </a>
                    {r.status === 'pending' && (
                      <button
                        onClick={() =>
                          markSent.mutate(r.id, {
                            onSuccess: () => toast.success('Reminder marked as sent'),
                            onError: (err) =>
                              toast.error(err instanceof Error ? err.message : 'Failed to update reminder'),
                          })
                        }
                        disabled={markSent.isPending}
                        className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 inline-flex items-center justify-center min-w-[75px]"
                      >
                        {markSent.isPending ? <Spinner size={12} label="Updating..." /> : 'Mark sent'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && (reminders?.length ?? 0) === 0 && (
          <EmptyState
            icon={<Bell size={32} />}
            title={emptyMessages[status] ?? 'No reminders found.'}
          />
        )}
      </div>

      {!isLoading && (reminders?.length ?? 0) > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={reminders?.length ?? 0} onPage={setPage} />
      )}
    </div>
  )
}
