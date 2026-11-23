import { Loader2 } from 'lucide-react'

interface SpinnerProps {
  size?: number
  className?: string
  label?: string
}

export function Spinner({ size = 15, className = '', label }: SpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <Loader2 size={size} className="animate-spin text-current shrink-0" aria-hidden="true" />
      {label && <span>{label}</span>}
      <span className="sr-only">{label || 'Loading...'}</span>
    </span>
  )
}
