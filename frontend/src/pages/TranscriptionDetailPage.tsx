import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Trash2, Copy, Save, X, Loader2, Calendar, Clock, Globe,
} from 'lucide-react'
import { transcriptionApi } from '../services/api'
import type { Transcription } from '../types'
import { formatDate, formatDuration, copyToClipboard, languageLabel } from '../utils'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Toast from '../components/ui/Toast'

export default function TranscriptionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [item, setItem] = useState<Transcription | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!id) return
    transcriptionApi
      .get(id)
      .then((data) => {
        setItem(data)
        setEditTitle(data.title)
        setEditText(data.transcript)
      })
      .catch(() => showToast('Failed to load transcription.', 'error'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (!id || !item) return
    setSaving(true)
    try {
      const updated = await transcriptionApi.update(id, {
        title: editTitle,
        transcript: editText,
      })
      setItem(updated)
      setEditing(false)
      showToast('Saved successfully!')
    } catch {
      showToast('Failed to save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      await transcriptionApi.delete(id)
      navigate('/history')
    } catch {
      showToast('Failed to delete.', 'error')
    }
  }

  const handleCopy = async () => {
    if (!item) return
    const ok = await copyToClipboard(item.transcript)
    showToast(ok ? 'Copied!' : 'Failed to copy.', ok ? 'success' : 'error')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>Transcription not found.</p>
        <Link to="/history" className="btn-secondary mt-4 inline-flex">← Back</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> Back to History
      </Link>

      {/* Header card */}
      <div className="card p-6 space-y-4">
        {/* Title */}
        {editing ? (
          <input
            className="input text-lg font-semibold"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Transcription title"
          />
        ) : (
          <h1 className="text-xl font-bold text-gray-900">{item.title}</h1>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {formatDate(item.created_at)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {formatDuration(item.duration_seconds)}
          </span>
          {item.language && (
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4" />
              {languageLabel(item.language)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {editing ? (
            <>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
              <button className="btn-secondary" onClick={() => { setEditing(false); setEditTitle(item.title); setEditText(item.transcript) }}>
                <X className="w-4 h-4" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => setEditing(true)}>
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button className="btn-secondary" onClick={handleCopy}>
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button className="btn-danger" onClick={() => setShowDelete(true)}>
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-700 mb-3 text-sm">Transcript</h2>
        {editing ? (
          <textarea
            className="input min-h-64 resize-y leading-relaxed"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Transcript content…"
            style={{ fontFamily: "'Inter', 'Noto Sans Devanagari', sans-serif" }}
          />
        ) : (
          <p
            className="text-gray-800 leading-relaxed whitespace-pre-wrap"
            style={{ fontFamily: "'Inter', 'Noto Sans Devanagari', sans-serif" }}
          >
            {item.transcript || <em className="text-gray-400">No transcript content.</em>}
          </p>
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        title="Delete Transcription"
        message="This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
