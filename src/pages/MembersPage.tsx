import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMembers } from '../features/members/queries'
import { MemberFormModal } from '../features/members/MemberFormModal'
import { StatusBadge } from '../components/StatusBadge'
import { Pagination, usePagination } from '../components/Pagination'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useDebounce } from '../lib/useDebounce'
import { formatDate } from '../lib/formatDate'
import { Users, UserPlus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'expired', label: 'Expired' },
  { value: 'no_membership', label: 'No membership' },
]

const PAGE_SIZE = 10

type SortField = 'name' | 'joined'
type SortOrder = 'asc' | 'desc'

export default function MembersPage() {
  const navigate = useNavigate()
  const [searchRaw, setSearchRaw] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const tableRef = useRef<HTMLDivElement>(null)

  const search = useDebounce(searchRaw, 280)

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, statusFilter, sortField, sortOrder])

  // Scroll table top on page change
  useEffect(() => {
    tableRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const { data: members, isLoading, error } = useMembers(search, statusFilter)

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const sortedMembers = useMemo(() => {
    if (!members) return []
    if (!sortField) return members
    return [...members].sort((a, b) => {
      if (sortField === 'name') {
        const cmp = a.full_name.localeCompare(b.full_name)
        return sortOrder === 'asc' ? cmp : -cmp
      }
      if (sortField === 'joined') {
        const dateA = new Date(a.joining_date).getTime() || 0
        const dateB = new Date(b.joining_date).getTime() || 0
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      }
      return 0
    })
  }, [members, sortField, sortOrder])

  const paged = usePagination(sortedMembers, PAGE_SIZE, page)

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Members</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <UserPlus size={15} aria-hidden="true" />
          Add member
        </button>
      </div>

      <div className="table-filters">
        <input
          placeholder="Search by name or phone"
          value={searchRaw}
          onChange={e => setSearchRaw(e.target.value)}
          className="filter-input"
          aria-label="Search members"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="filter-select"
          aria-label="Filter by status"
        >
          {statusOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div ref={tableRef} className="table-wrap">
        {error && <p className="text-sm text-danger">Couldn't load members.</p>}

        <table className="data-table">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="inline-flex items-center gap-1.5 hover:text-foreground font-semibold"
                  title="Sort by name"
                >
                  <span>Name</span>
                  {sortField === 'name' ? (
                    sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={13} className="opacity-40" />
                  )}
                </button>
              </th>
              <th>Phone</th>
              <th>Status</th>
              <th>
                <button
                  type="button"
                  onClick={() => handleSort('joined')}
                  className="inline-flex items-center gap-1.5 hover:text-foreground font-semibold"
                  title="Sort by joining date"
                >
                  <span>Joined</span>
                  {sortField === 'joined' ? (
                    sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                  ) : (
                    <ArrowUpDown size={13} className="opacity-40" />
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTable rows={8} cols={4} />}
            {!isLoading && paged.map(m => (
              <tr
                key={m.id}
                onClick={() => navigate(`/app/members/${m.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/app/members/${m.id}`)
                  }
                }}
                tabIndex={0}
                role="link"
                className="cursor-pointer hover:bg-surface/70 transition-colors focus-visible:outline-none focus-visible:bg-surface"
                aria-label={`View details for ${m.full_name}`}
              >
                <td>
                  <span className="table-link font-semibold text-foreground">
                    {m.full_name}
                  </span>
                </td>
                <td className="text-muted">{m.phone}</td>
                <td><StatusBadge status={m.status} /></td>
                <td className="text-muted">{formatDate(m.joining_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && !error && (members?.length ?? 0) === 0 && (
          <EmptyState
            icon={<Users size={32} />}
            title={search || statusFilter !== 'all' ? 'No members match your search' : 'No members yet'}
            description={search || statusFilter !== 'all' ? 'Try adjusting your search or filter.' : 'Add your first member to get started.'}
            action={
              !search && statusFilter === 'all' ? (
                <button onClick={() => setModalOpen(true)} className="btn-primary">
                  Add member
                </button>
              ) : undefined
            }
          />
        )}
      </div>

      {!isLoading && (members?.length ?? 0) > 0 && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={sortedMembers.length}
          onPage={setPage}
        />
      )}

      <MemberFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
