import { useState, useRef, useEffect } from 'react'
import { useReportPayments } from '../features/reports/queries'
import { exportCollectionsExcel, exportCollectionsPdf } from '../features/reports/exportCollections'
import { Pagination, usePagination } from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { formatCurrency } from '../lib/formatCurrency'
import { formatDate } from '../lib/formatDate'
import { FileText, Download, FileSpreadsheet } from 'lucide-react'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const PAGE_SIZE = 10

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(daysAgoISO(30))
  const [toDate, setToDate] = useState(todayISO())
  const [page, setPage] = useState(1)
  const tableRef = useRef<HTMLDivElement>(null)

  const { data: payments, isLoading } = useReportPayments({ fromDate, toDate })

  useEffect(() => {
    setPage(1)
  }, [fromDate, toDate])

  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

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
      return acc
    },
    { collected: 0, refunds: 0, net: 0 },
  )

  const hasData = !!payments && payments.length > 0
  const pagedPayments = usePagination(payments ?? [], PAGE_SIZE, page)

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-surface/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Collections report</h2>
            <p className="text-xs text-muted">Audited financial export of collections, refunds, and net totals</p>
          </div>

          <div className="flex gap-2">
            <button
              disabled={!hasData}
              onClick={() => exportCollectionsExcel(payments!, fromDate, toDate)}
              className="btn-secondary text-xs"
            >
              <FileSpreadsheet size={15} aria-hidden="true" />
              Export Excel
            </button>
            <button
              disabled={!hasData}
              onClick={() => exportCollectionsPdf(payments!, fromDate, toDate, totals)}
              className="btn-secondary text-xs"
            >
              <Download size={15} aria-hidden="true" />
              Export PDF
            </button>
          </div>
        </div>

        <div className="table-filters flex-wrap">
          <div>
            <label className="filter-label">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="filter-input"
            />
          </div>
          <div>
            <label className="filter-label">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="filter-input"
            />
          </div>
        </div>

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
            <span className="summary-strip__label">Net Collections</span>
            <span className="summary-strip__value">{formatCurrency(totals.net)}</span>
          </div>
          <div className="summary-strip__item">
            <span className="summary-strip__label">Transactions</span>
            <span className="summary-strip__value">{payments?.length ?? 0}</span>
          </div>
        </div>

        <div ref={tableRef} className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Receipt #</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonTable rows={6} cols={6} />}
              {!isLoading && pagedPayments.map((p) => (
                <tr key={p.id}>
                  <td className="text-muted">{formatDate(p.created_at)}</td>
                  <td className="font-medium text-foreground">{p.member.full_name}</td>
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

          {!isLoading && !hasData && (
            <EmptyState
              icon={<FileText size={32} />}
              title="No payments in this range"
              description="Select a broader date range to generate report records."
            />
          )}
        </div>

        {!isLoading && (payments?.length ?? 0) > 0 && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={payments?.length ?? 0}
            onPage={setPage}
          />
        )}
      </section>
    </div>
  )
}
