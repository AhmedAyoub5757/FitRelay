import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useMembers } from '../features/members/queries'
import { useGymPayments, useRecordGymPayment } from '../features/payments/queries'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function PaymentsPage() {
  const [fromDate, setFromDate] = useState(daysAgoISO(30))
  const [toDate, setToDate] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [recordModalOpen, setRecordModalOpen] = useState(false)

  const { data: payments, isLoading } = useGymPayments({ search, fromDate, toDate })

  const totals = (payments ?? []).reduce(
    (acc, p) => {
      const amount = Number(p.amount)
      if (p.entry_type === 'refund') {
        acc.net -= amount
        acc.refunds += amount
      } else {
        acc.net += amount
        acc.collected += amount
      }
      acc.count += 1
      return acc
    },
    { collected: 0, refunds: 0, net: 0, count: 0 },
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">Payments</h1>
        <button onClick={() => setRecordModalOpen(true)} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white">
          Record payment
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 rounded border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 rounded border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium">Search member</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name"
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-6 rounded border border-border p-4">
        <div>
          <p className="text-xs text-muted">Collected</p>
          <p className="font-display text-2xl text-success">{totals.collected.toFixed(2)}</p>
        </div>
        {totals.refunds > 0 && (
          <div>
            <p className="text-xs text-muted">Refunded</p>
            <p className="font-display text-2xl text-danger">{totals.refunds.toFixed(2)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted">Net</p>
          <p className="font-display text-2xl">{totals.net.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Transactions</p>
          <p className="font-display text-2xl">{totals.count}</p>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Member</th>
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Method</th>
            <th className="py-2 pr-4 font-medium">Receipt #</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={6} className="py-4 text-center text-muted">Loading...</td></tr>
          )}
          {!isLoading && payments?.length === 0 && (
            <tr><td colSpan={6} className="py-4 text-center text-muted">No payments in this range.</td></tr>
          )}
          {payments?.map((p) => (
            <tr key={p.id} className="border-b border-border">
              <td className="py-2 pr-4 text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
              <td className="py-2 pr-4">
                <Link to={`/app/members/${p.member.id}`} className="hover:underline">{p.member.full_name}</Link>
              </td>
              <td className="py-2 pr-4">{p.entry_type === 'refund' ? 'Refund' : 'Payment'}</td>
              <td className={`py-2 pr-4 ${p.entry_type === 'refund' ? 'text-danger' : 'text-success'}`}>
                {p.entry_type === 'refund' ? '-' : ''}{Number(p.amount).toFixed(2)}
              </td>
              <td className="py-2 pr-4 text-muted">{p.payment_method}</td>
              <td className="py-2 pr-4 text-muted">#{p.receipt_number}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <RecordPaymentModal open={recordModalOpen} onClose={() => setRecordModalOpen(false)} />
    </div>
  )
}

function RecordPaymentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedMember, setSelectedMember] = useState<{ id: string; full_name: string } | null>(null)
  const [search, setSearch] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [error, setError] = useState<string | null>(null)

  const { data: members } = useMembers(search, undefined)
  const recordPayment = useRecordGymPayment()

  function reset() {
    setSelectedMember(null)
    setSearch('')
    setAmount('')
    setMethod('cash')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedMember) {
      setError('Select a member first')
      return
    }
    try {
      await recordPayment.mutateAsync({ memberId: selectedMember.id, amount: Number(amount), method })
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Record payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}

        {!selectedMember && (
          <div>
            <label className="block text-sm font-medium">Member</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2"
            />
            {search.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border">
                {members?.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => { setSelectedMember({ id: m.id, full_name: m.full_name }); setSearch('') }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
                  >
                    {m.full_name} <span className="text-muted">{m.phone}</span>
                  </button>
                ))}
                {members?.length === 0 && <p className="px-3 py-2 text-sm text-muted">No matches.</p>}
              </div>
            )}
          </div>
        )}

        {selectedMember && (
          <div className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
            <span>{selectedMember.full_name}</span>
            <button type="button" onClick={() => setSelectedMember(null)} className="text-muted hover:text-foreground">
              Change
            </button>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium">Amount</label>
          <input type="number" required min={0.01} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Payment method</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
        <p className="text-xs text-muted">Applied automatically to the oldest outstanding charge first.</p>
        <button type="submit" disabled={recordPayment.isPending} className="w-full rounded bg-accent py-2 font-medium text-white disabled:opacity-50">
          {recordPayment.isPending ? 'Recording...' : 'Record payment'}
        </button>
      </form>
    </Modal>
  )
}