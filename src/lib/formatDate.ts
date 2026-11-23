/**
 * Formats an ISO date string or Date object consistently across the application.
 * Example: "2026-11-23" or "2026-11-23T14:30:00Z" -> "Nov 23, 2026"
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—'
  const date = typeof dateInput === 'string'
    ? new Date(dateInput.includes('T') ? dateInput : `${dateInput}T00:00:00`)
    : dateInput

  if (isNaN(date.getTime())) return String(dateInput)

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
