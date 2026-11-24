import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Trash2, Edit2, ChevronRight, Loader2, Mic, FileText } from 'lucide-react'
import { transcriptionApi } from '../services/api'
import type { Transcription } from '../types'
import { formatDate, formatDuration, truncate, languageLabel } from '../utils'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'
import Toast from '../components/ui/Toast'

export default function HistoryPage() {
  const [items, setItems] = useState<Transcription[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [draftSearch, setDraftSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await transcriptionApi.list({ search: search || undefined, page, page_size: 15 })
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch {
      showToast('Failed to load transcriptions.', 'error')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(draftSearch)
    setPage(1)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await transcriptionApi.delete(deleteTarget)
      showToast('Transcription deleted.')
      setDeleteTarget(null)
      fetchData()
    } catch {
      showToast('Failed to delete.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transcription History</h1>
          <p className="text-gray-500 text-sm mt-1">{total} transcription{total !== 1 ? 's' : ''} found</p>
        </div>
        <Link to="/transcribe" className="btn-primary">
          <Mic className="w-4 h-4" /> New Recording
        </Link>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by title or content…"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-secondary">Search</button>
        {search && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { setSearch(''); setDraftSearch(''); setPage(1) }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">
              {search ? `No results for "${search}"` : 'No transcriptions yet.'}
            </p>
            {!search && (
              <Link to="/transcribe" className="btn-primary mt-4 inline-flex">Start Recording</Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 group">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{t.title}</div>
                  <div className="text-sm text-gray-500 truncate">{truncate(t.transcript, 90)}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{formatDate(t.created_at)}</span>
                    <span>·</span>
                    <span>{formatDuration(t.duration_seconds)}</span>
                    {t.language && (
                      <>
                        <span>·</span>
                        <span className="badge bg-blue-50 text-blue-600">{languageLabel(t.language)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    to={`/transcriptions/${t.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500"
                    title="View & Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(t.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-gray-500 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <Link
                    to={`/transcriptions/${t.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pagination */}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Transcription"
        message="This action cannot be undone. Are you sure you want to delete this transcription?"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
