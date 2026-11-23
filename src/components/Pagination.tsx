import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  onPageSize?: (n: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizeOptions = [10, 25, 50],
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, total)

  if (total === 0) return null

  return (
    <div className="pagination">
      <span className="pagination__info">
        {from}–{to} of {total}
      </span>

      {onPageSize && (
        <select
          value={pageSize}
          onChange={e => { onPageSize(Number(e.target.value)); onPage(1) }}
          className="pagination__size-select"
          aria-label="Rows per page"
        >
          {pageSizeOptions.map(n => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      )}

      <div className="pagination__controls">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="pagination__btn"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>

        {/* Page number pills */}
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | 'gap')[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('gap')
            acc.push(p)
            return acc
          }, [])
          .map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} className="pagination__gap">…</span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPage(item as number)}
                className={`pagination__btn pagination__btn--num${item === page ? ' pagination__btn--active' : ''}`}
                aria-label={`Page ${item}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {item}
              </button>
            )
          )}

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="pagination__btn"
          aria-label="Next page"
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/** Hook: slice an array to the current page */
export function usePagination<T>(items: T[], pageSize: number, page: number) {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}
