import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface CollectionRow {
  created_at: string
  member: { full_name: string }
  entry_type: string
  amount: number | string
  payment_method: string
  receipt_number: number | string
}

function toRows(payments: CollectionRow[]) {
  return payments.map((p) => ({
    Date: new Date(p.created_at).toLocaleDateString(),
    Member: p.member.full_name,
    Type: p.entry_type === 'refund' ? 'Refund' : 'Payment',
    Amount: p.entry_type === 'refund' ? -Number(p.amount) : Number(p.amount),
    Method: p.payment_method,
    Receipt: p.receipt_number,
  }))
}

export function exportCollectionsExcel(payments: CollectionRow[], fromDate: string, toDate: string) {
  const worksheet = XLSX.utils.json_to_sheet(toRows(payments))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Collections')
  XLSX.writeFile(workbook, `collections_${fromDate}_to_${toDate}.xlsx`)
}

export function exportCollectionsPdf(
  payments: CollectionRow[],
  fromDate: string,
  toDate: string,
  totals: { collected: number; refunds: number; net: number },
) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('Collections report', 14, 16)
  doc.setFontSize(10)
  doc.text(`${fromDate} to ${toDate}`, 14, 22)
  doc.text(
    `Collected: ${totals.collected.toFixed(2)}   Refunded: ${totals.refunds.toFixed(2)}   Net: ${totals.net.toFixed(2)}`,
    14, 28,
  )

  autoTable(doc, {
    startY: 34,
    head: [['Date', 'Member', 'Type', 'Amount', 'Method', 'Receipt #']],
    body: toRows(payments).map((r) => [r.Date, r.Member, r.Type, r.Amount.toFixed(2), r.Method, String(r.Receipt)]),
  })

  doc.save(`collections_${fromDate}_to_${toDate}.pdf`)
}