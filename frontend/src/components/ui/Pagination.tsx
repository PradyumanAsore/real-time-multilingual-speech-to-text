interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        className="btn-secondary px-3 py-1.5 text-xs"
        disabled={page === 1}
        onClick={() => onPageChange(page - 1)}
      >
        ←
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${p === page ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
        >
          {p}
        </button>
      ))}
      <button
        className="btn-secondary px-3 py-1.5 text-xs"
        disabled={page === totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        →
      </button>
    </div>
  )
}
