const statusStyles: Record<string, string> = {
  active: 'bg-success/10 text-success',
  upcoming: 'bg-accent/10 text-accent',
  frozen: 'bg-paused/10 text-paused',
  expired: 'bg-danger/10 text-danger',
  no_membership: 'bg-muted/10 text-muted',
}

const statusLabels: Record<string, string> = {
  active: 'Active',
  upcoming: 'Upcoming',
  frozen: 'Frozen',
  expired: 'Expired',
  no_membership: 'No membership',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyles[status] ?? 'bg-muted/10 text-muted'}`}>
      {statusLabels[status] ?? status}
    </span>
  )
}