import { useState, useRef, useEffect, useMemo, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useMembers } from '../features/members/queries'
import { useGymPayments, useRecordGymPayment } from '../features/payments/queries'
import { Pagination, usePagination } from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useDebounce } from '../lib/useDebounce'
import { useToast } from '../context/ToastContext'
import { formatCurrency } from '../lib/formatCurrency'
import { formatDate } from '../lib/formatDate'
import { Spinner } from '../components/Spinner'
import { CreditCard, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

function todayISO() { return new Date().toISOString().slice(0, 10) }
function daysAgoISO(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10)
}

const PAGE_SIZE = 10

type SortField = 'date' | 'amount'
type SortOrder = 'asc' | 'desc'

export default function PaymentsPage() {
  const [fromDate, setFromDate] = useState(daysAgoISO(30))
  const [toDate, setToDate]     = useState(todayISO())
  const [searchRaw, setSearchRaw] = useState('')
  const [recordModalOpen, setRecordModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const tableRef = useRef<HTMLDivElement>(null)

  const search = useDebounce(searchRaw, 280)
  useEffect(() => { setPage(1) }, [search, fromDate, toDate, sortField, sortOrder])
  useEffect(() => { tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' }) }, [page])

  const { data: payments, isLoading } = useGymPayments({ search, fromDate, toDate })

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'date' ? 'desc' : 'desc')
    }
  }

  const totals = useMemo(() => {
    return (payments ?? []).reduce(
      (acc, p) => {
        const amount = Number(p.amount)
        if (p.entry_type === 'refund') { acc.net -= amount; acc.refunds += amount }
        else { acc.net += amount; acc.collected += amount }
        acc.count += 1; return acc
      },
      { collected: 0, refunds: 0, net: 0, count: 0 },
    )
  }, [payments])

  const sortedPayments = useMemo(() => {
    if (!payments) return []
    return [...payments].sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.created_at).getTime() || 0
        const dateB = new Date(b.created_at).getTime() || 0
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      }
      if (sortField === 'amount') {
        const amtA = Number(a.amount) || 0
        const amtB = Number(b.amount) || 0
        return sortOrder === 'asc' ? amtA - amtB : amtB - amtA
      }
      return 0
    })
  }, [payments, sortField, sortOrder])

  const paged = usePagination(sortedPayments, PAGE_SIZE, page)

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <h1 className="page-title">Payments</h1>
        <button onClick={() => setRecordModalOpen(true)} className="btn-primary">
          Record payment
        </button>
      </div>

      <div className="table-filters flex-wrap">
        <div>
          <label className="filter-label">From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="filter-input" />
        </div>
        <div>
          <label className="filter-label">To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="filter-input" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="filter-label">Search member</label>
          <input
            type="text" value={searchRaw} onChange={e => setSearchRaw(e.target.value)}
            placeholder="Name" className="filter-input w-full" aria-label="Search by member name"
          />
        </div>
      </div>

      {/* Summary strip */}
      <div className="summary-strip">
        <div className="summary-strip__item">
          <span className="summary-strip__label">Collected</span>
          <span className="summary-strip__value text-success">{formatCurrency(totals.collected)}</span>
        </div>
        {totals.refunds > 0 && (
          <div className="summary-strip__item">
            <span className="summary-strip__label">Refunded</span>
            <span className="summary-strip__value text-danger">-{formatCurrency(totals.refunds)}</span>
          </div>
        )}
        <div className="summary-strip__item">
          <span className="summary-strip__label">Net</span>
          <span className="summary-strip__value">{formatCurrency(totals.net)}</span>
        </div>
        <div className="summary-strip__item">
          <span className="summary-strip__label">Transactions</span>
          <span className="summary-strip__value">{totals.count}</span>
        </div>
      </div>

      <div ref={tableRef} className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  onClick={() => handleSort('date')}
                  className="inline-flex items-center gap-1.5 hover:text-foreground font-semibold"
                  title="Sort by date"
                >
                  <span>Date</span>
                  {sortField === 'date' ? (
                    sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={13} className="opacity-40" />
                  )}
                </button>
              </th>
              <th>Member</th>
              <th>Type</th>
              <th>
                <button
                  type="button"
                  onClick={() => handleSort('amount')}
                  className="inline-flex items-center gap-1.5 hover:text-foreground font-semibold"
                  title="Sort by amount"
                >
                  <span>Amount</span>
                  {sortField === 'amount' ? (
                    sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={13} className="opacity-40" />
                  )}
                </button>
              </th>
              <th>Method</th>
              <th>Receipt #</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTable rows={8} cols={6} />}
            {!isLoading && paged.map(p => (
              <tr key={p.id}>
                <td className="text-muted">{formatDate(p.created_at)}</td>
                <td>
                  <Link to={`/app/members/${p.member.id}`} className="table-link">{p.member.full_name}</Link>
                </td>
                <td>{p.entry_type === 'refund' ? 'Refund' : 'Payment'}</td>
                <td className={p.entry_type === 'refund' ? 'text-danger font-medium' : 'text-success font-medium'}>
                  {p.entry_type === 'refund' ? '-' : ''}{formatCurrency(p.amount)}
                </td>
                <td className="text-muted capitalize">{p.payment_method?.replace('_', ' ')}</td>
                <td className="text-muted">#{p.receipt_number}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && (payments?.length ?? 0) === 0 && (
          <EmptyState
            icon={<CreditCard size={32} />}
            title="No payments in this period"
            description="Try a wider date range or a different member search."
          />
        )}
      </div>

      {!isLoading && (payments?.length ?? 0) > 0 && (
        <Pagination
          page={page} pageSize={PAGE_SIZE} total={sortedPayments.length} onPage={setPage}
          onPageSize={() => {}} pageSizeOptions={[10, 20, 50]}
        />
      )}

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
  const debouncedSearch = useDebounce(search, 280)

  const { data: members } = useMembers(debouncedSearch, 'all')
  const recordPayment = useRecordGymPayment()
  const toast = useToast()

  function reset() { setSelectedMember(null); setSearch(''); setAmount(''); setMethod('cash'); setError(null) }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (!selectedMember) { setError('Select a member first'); return }
    try {
      await recordPayment.mutateAsync({ memberId: selectedMember.id, amount: Number(amount), method })
      toast.success('Payment recorded successfully')
      reset(); onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      toast.error(msg)
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Record payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        {!selectedMember && (
          <div>
            <label className="block text-sm font-medium">Member</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or phone"
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground" />
            {debouncedSearch.length > 0 && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border">
                {members?.map(m => (
                  <button type="button" key={m.id}
                    onClick={() => { setSelectedMember({ id: m.id, full_name: m.full_name }); setSearch('') }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-surface">
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
            <span className="font-medium text-foreground">{selectedMember.full_name}</span>
            <button type="button" onClick={() => setSelectedMember(null)} className="text-xs text-accent hover:underline">Change</button>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Amount</label>
          <input type="number" required min={0.01} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground" />
        </div>
        <div>
          <label className="block text-sm font-medium">Payment method</label>
          <select value={method} onChange={e => setMethod(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
        <p className="text-xs text-muted">Applied automatically to the oldest outstanding charge first.</p>
        <button type="submit" disabled={recordPayment.isPending} className="w-full btn-primary justify-center py-2.5">
          {recordPayment.isPending ? <Spinner size={14} label="Recording payment..." /> : 'Record payment'}
        </button>
      </form>
    </Modal>
  )
}
