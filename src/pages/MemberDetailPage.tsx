import { useState, type FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { useMembershipPlans } from '../features/members/queries'
import {
  useMember, useMemberStatus, useMemberships, useCharges, usePayments, useCreditBalance,
  useRecordPayment, useFreezeMembership, useUnfreezeMembership, useRenewMembership,
} from '../features/members/detailQueries'

export default function MemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [freezeModalOpen, setFreezeModalOpen] = useState(false)
  const [unfreezeModalOpen, setUnfreezeModalOpen] = useState(false)
  const [renewModalOpen, setRenewModalOpen] = useState(false)

  const { data: member, isLoading: memberLoading } = useMember(memberId!)
  const { data: status } = useMemberStatus(memberId!)
  const { data: memberships, isLoading: membershipsLoading } = useMemberships(memberId!)
  const { data: charges } = useCharges(memberId!)
  const { data: payments } = usePayments(memberId!)
  const { data: credit } = useCreditBalance(memberId!)

  if (!memberId) return null
  if (memberLoading || membershipsLoading) return <p className="text-sm text-muted">Loading...</p>
  if (!member) return <p className="text-sm text-danger">Member not found.</p>

  const latest = memberships?.[0] ?? null
  const totalOutstanding = (charges ?? []).reduce((sum, c) => sum + c.outstanding, 0)

  return (
    <div className="space-y-6">
      <Link to="/app/members" className="text-sm text-muted hover:text-foreground">← Back to members</Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-wide">{member.full_name}</h1>
          <p className="mt-1 text-sm text-muted">{member.phone}</p>
          {member.emergency_contact_name && (
            <p className="text-sm text-muted">Emergency: {member.emergency_contact_name} ({member.emergency_contact_phone})</p>
          )}
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      <div className="flex gap-6 rounded border border-border p-4">
        <div>
          <p className="text-xs text-muted">Outstanding balance</p>
          <p className={`font-display text-2xl ${totalOutstanding > 0 ? 'text-danger' : 'text-success'}`}>
            {totalOutstanding.toFixed(2)}
          </p>
        </div>
        {credit != null && credit > 0 && (
          <div>
            <p className="text-xs text-muted">Available credit</p>
            <p className="font-display text-2xl text-accent">{credit.toFixed(2)}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPaymentModalOpen(true)} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white">
          Record payment
        </button>
        {latest?.status === 'active' && (
          <button onClick={() => setFreezeModalOpen(true)} className="rounded border border-border px-4 py-2 text-sm font-medium">
            Freeze membership
          </button>
        )}
        {latest?.status === 'frozen' && (
          <button onClick={() => setUnfreezeModalOpen(true)} className="rounded border border-border px-4 py-2 text-sm font-medium">
            Unfreeze membership
          </button>
        )}
        {latest && ['active', 'frozen', 'expired'].includes(latest.status) && (
          <button onClick={() => setRenewModalOpen(true)} className="rounded border border-border px-4 py-2 text-sm font-medium">
            Renew
          </button>
        )}
      </div>

      <section>
        <h2 className="mb-2 font-display text-xl tracking-wide">Membership history</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4 font-medium">Plan</th>
              <th className="py-2 pr-4 font-medium">Start</th>
              <th className="py-2 pr-4 font-medium">End</th>
              <th className="py-2 pr-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {memberships?.map((m) => (
              <tr key={m.id} className="border-b border-border">
                <td className="py-2 pr-4">{m.plan_name_snapshot}</td>
                <td className="py-2 pr-4 text-muted">{m.start_date}</td>
                <td className="py-2 pr-4 text-muted">{m.end_date}</td>
                <td className="py-2 pr-4"><StatusBadge status={m.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl tracking-wide">Payment history</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Amount</th>
              <th className="py-2 pr-4 font-medium">Method</th>
              <th className="py-2 pr-4 font-medium">Receipt #</th>
            </tr>
          </thead>
          <tbody>
            {payments?.map((p) => (
              <tr key={p.id} className="border-b border-border">
                <td className="py-2 pr-4 text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="py-2 pr-4">{p.entry_type === 'refund' ? 'Refund' : 'Payment'}</td>
                <td className={`py-2 pr-4 ${p.entry_type === 'refund' ? 'text-danger' : 'text-success'}`}>
                  {p.entry_type === 'refund' ? '-' : ''}{Number(p.amount).toFixed(2)}
                </td>
                <td className="py-2 pr-4 text-muted">{p.payment_method}</td>
                <td className="py-2 pr-4 text-muted">#{p.receipt_number}</td>
              </tr>
            ))}
            {payments?.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-muted">No payments recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <RecordPaymentModal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} memberId={memberId} />
      {latest && (
        <FreezeModal open={freezeModalOpen} onClose={() => setFreezeModalOpen(false)} memberId={memberId} membershipId={latest.id} />
      )}
      {latest?.activeFreeze && (
        <UnfreezeModal open={unfreezeModalOpen} onClose={() => setUnfreezeModalOpen(false)} memberId={memberId} freezeId={latest.activeFreeze.id} />
      )}
      {latest && (
        <RenewModal open={renewModalOpen} onClose={() => setRenewModalOpen(false)} memberId={memberId} membershipId={latest.id} />
      )}
    </div>
  )
}

function RecordPaymentModal({ open, onClose, memberId }: { open: boolean; onClose: () => void; memberId: string }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [error, setError] = useState<string | null>(null)
  const recordPayment = useRecordPayment(memberId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await recordPayment.mutateAsync({ amount: Number(amount), method })
      setAmount('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
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

function FreezeModal({ open, onClose, memberId, membershipId }: { open: boolean; onClose: () => void; memberId: string; membershipId: string }) {
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const freeze = useFreezeMembership(memberId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await freeze.mutateAsync({ membershipId, startDate })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Freeze membership">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Start date</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" />
        </div>
        <button type="submit" disabled={freeze.isPending} className="w-full rounded bg-accent py-2 font-medium text-white disabled:opacity-50">
          {freeze.isPending ? 'Freezing...' : 'Freeze'}
        </button>
      </form>
    </Modal>
  )
}

function UnfreezeModal({ open, onClose, memberId, freezeId }: { open: boolean; onClose: () => void; memberId: string; freezeId: string }) {
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const unfreeze = useUnfreezeMembership(memberId)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await unfreeze.mutateAsync({ freezeId, endDate })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Unfreeze membership">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Active again from</label>
          <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" />
        </div>
        <button type="submit" disabled={unfreeze.isPending} className="w-full rounded bg-accent py-2 font-medium text-white disabled:opacity-50">
          {unfreeze.isPending ? 'Unfreezing...' : 'Unfreeze'}
        </button>
      </form>
    </Modal>
  )
}

function RenewModal({ open, onClose, memberId, membershipId }: { open: boolean; onClose: () => void; memberId: string; membershipId: string }) {
  const [planId, setPlanId] = useState('')
  const [durationDays, setDurationDays] = useState(30)
  const [grossAmount, setGrossAmount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const { data: plans } = useMembershipPlans()
  const renew = useRenewMembership(memberId)

  function handlePlanChange(id: string) {
    setPlanId(id)
    const plan = plans?.find((p) => p.id === id)
    if (plan) {
      if (plan.duration_days) setDurationDays(plan.duration_days)
      setGrossAmount(Number(plan.default_price))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await renew.mutateAsync({
        membershipId,
        planId: planId || null,
        planName: plans?.find((p) => p.id === planId)?.name ?? 'Custom',
        durationDays,
        grossAmount,
        discountAmount,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Renew membership">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Plan</label>
          <select value={planId} onChange={(e) => handlePlanChange(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2">
            <option value="">Custom</option>
            {plans?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Duration (days)</label>
            <input type="number" required min={1} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Price</label>
            <input type="number" required min={0} value={grossAmount} onChange={(e) => setGrossAmount(Number(e.target.value))} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Discount</label>
            <input type="number" min={0} value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" />
          </div>
        </div>
        <button type="submit" disabled={renew.isPending} className="w-full rounded bg-accent py-2 font-medium text-white disabled:opacity-50">
          {renew.isPending ? 'Renewing...' : 'Renew'}
        </button>
      </form>
    </Modal>
  )
}