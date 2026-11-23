import { useState } from 'react'
import { useReportPayments } from '../features/reports/queries'
import { exportCollectionsExcel, exportCollectionsPdf } from '../features/reports/exportCollections'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(daysAgoISO(30))
  const [toDate, setToDate] = useState(todayISO())

  const { data: payments, isLoading } = useReportPayments({ fromDate, toDate })

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

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-wide">Reports</h1>

      <section className="space-y-4 rounded border border-border p-4">
        <h2 className="font-display text-xl tracking-wide">Collections report</h2>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 rounded border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 rounded border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button
              disabled={!hasData}
              onClick={() => exportCollectionsExcel(payments!, fromDate, toDate)}
              className="rounded border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Export Excel
            </button>
            <button
              disabled={!hasData}
              onClick={() => exportCollectionsPdf(payments!, fromDate, toDate, totals)}
              className="rounded border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="flex gap-6">
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
            {isLoading && <tr><td colSpan={6} className="py-4 text-center text-muted">Loading...</td></tr>}
            {!isLoading && !hasData && (
              <tr><td colSpan={6} className="py-4 text-center text-muted">No payments in this range.</td></tr>
            )}
            {payments?.map((p) => (
              <tr key={p.id} className="border-b border-border">
                <td className="py-2 pr-4 text-muted">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="py-2 pr-4">{p.member.full_name}</td>
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
      </section>
    </div>
  )
}