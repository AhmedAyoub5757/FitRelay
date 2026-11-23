/**
 * Formats a numeric or numeric-string value into PKR currency.
 * Example: 12500 -> "Rs. 12,500.00", -500 -> "-Rs. 500.00"
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null || amount === '') return 'Rs. 0.00'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return 'Rs. 0.00'

  const isNegative = num < 0
  const abs = Math.abs(num)
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)

  return isNegative ? `-Rs. ${formatted}` : `Rs. ${formatted}`
}
