import type { ReactNode } from 'react'

/** Animated placeholder block */
function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/** Single table row skeleton */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="skeleton-row" aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 pr-4">
          <SkeletonBlock className={i === 0 ? 'h-4 w-32' : 'h-4 w-20'} />
        </td>
      ))}
    </tr>
  )
}

/** Multiple table row skeletons */
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cols={cols} />
      ))}
    </>
  )
}

/** Stat card skeleton (dashboard) */
export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <SkeletonBlock className="h-3 w-24 mb-3" />
      <SkeletonBlock className="h-9 w-16" />
    </div>
  )
}

/** Detail header skeleton (MemberDetailPage) */
export function SkeletonDetailHeader() {
  return (
    <div className="skeleton-detail-header" aria-hidden="true">
      <SkeletonBlock className="h-8 w-48 mb-2" />
      <SkeletonBlock className="h-4 w-32" />
    </div>
  )
}

/** Modal body skeleton */
export function SkeletonModalBody({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-modal-body" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-modal-body__row">
          <SkeletonBlock className="h-3 w-20 mb-1.5" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}
