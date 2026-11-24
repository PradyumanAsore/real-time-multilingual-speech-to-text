import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic, Clock, FileText, ChevronRight, Loader2 } from 'lucide-react'
import { transcriptionApi } from '../services/api'
import type { DashboardStats } from '../types'
import { formatDuration, formatDate, truncate, languageLabel } from '../utils'

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    transcriptionApi
      .getStats()
      .then(setStats)
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>{error ?? 'Unknown error'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Your transcription activity at a glance.</p>
        </div>
        <Link to="/transcribe" className="btn-primary">
          <Mic className="w-4 h-4" />
          New Recording
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={FileText}
          label="Total Transcriptions"
          value={String(stats.total_transcriptions)}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={Clock}
          label="Total Duration"
          value={formatDuration(stats.total_duration_seconds)}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Recent transcriptions */}
      <div className="card">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Transcriptions</h2>
          <Link to="/history" className="text-sm text-blue-600 hover:underline">
            View all →
          </Link>
        </div>

        {stats.recent_transcriptions.length === 0 ? (
          <div className="p-12 text-center">
            <Mic className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">No transcriptions yet.</p>
            <Link to="/transcribe" className="btn-primary mt-4 inline-flex">
              Start Recording
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {stats.recent_transcriptions.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/transcriptions/${t.id}`}
                  className="flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{t.title}</div>
                    <div className="text-sm text-gray-500 truncate mt-0.5">
                      {truncate(t.transcript, 80)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{formatDate(t.created_at)}</span>
                      <span>·</span>
                      <span>{formatDuration(t.duration_seconds)}</span>
                      {t.language && (
                        <>
                          <span>·</span>
                          <span>{languageLabel(t.language)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
