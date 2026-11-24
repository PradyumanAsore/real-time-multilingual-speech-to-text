import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Mic, MicOff, Square, Copy, Save, Trash2, Loader2, CheckCircle, AlertCircle,
} from 'lucide-react'
import { useRecorder } from '../hooks/useRecorder'
import { transcriptionApi } from '../services/api'
import { formatDuration, copyToClipboard, languageLabel } from '../utils'
import Toast from '../components/ui/Toast'

interface ToastState { message: string; type: 'success' | 'error' | 'info' }

export default function TranscribePage() {
  const [confirmedText, setConfirmedText] = useState('')
  const [partialText, setPartialText] = useState('')
  const [language, setLanguage] = useState('auto')
  const [finalDuration, setFinalDuration] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const showToast = (message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handlePartial = useCallback(
    (_text: string, confirmed: string, lang: string) => {
      if (confirmed) {
        setConfirmedText(confirmed)
        if (_text && _text !== confirmed && _text.startsWith(confirmed)) {
          setPartialText(_text.slice(confirmed.length).trim())
        } else if (_text && _text !== confirmed) {
          setPartialText(_text)
        } else {
          setPartialText('')
        }
      } else if (_text) {
        setConfirmedText(_text)
        setPartialText('')
      }
      if (lang && lang !== 'auto') setLanguage(lang)
    },
    [],
  )

  const handleFinal = useCallback(
    (text: string, lang: string, dur: number) => {
      setConfirmedText(text)
      setPartialText('')
      if (lang && lang !== 'auto') setLanguage(lang)
      setFinalDuration(dur)
    },
    [],
  )

  const handleError = useCallback((msg: string) => {
    showToast(msg, 'error')
  }, [])

  const { duration, audioLevel, micError, startRecording, stopRecording, isRecording, isStopping, isConnecting } =
    useRecorder({ onPartial: handlePartial, onFinal: handleFinal, onError: handleError })

  const fullTranscript = confirmedText + (partialText ? ' ' + partialText : '')

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [fullTranscript])

  const handleClear = () => {
    setConfirmedText('')
    setPartialText('')
    setLanguage('auto')
    setFinalDuration(0)
  }

  const handleCopy = async () => {
    if (!fullTranscript.trim()) return
    const ok = await copyToClipboard(fullTranscript)
    showToast(ok ? 'Copied to clipboard!' : 'Failed to copy', ok ? 'success' : 'error')
  }

  const handleSave = async () => {
    const text = confirmedText.trim()
    if (!text) return showToast('Nothing to save yet.', 'error')
    setIsSaving(true)
    try {
      const title = text.slice(0, 60) + (text.length > 60 ? '…' : '')
      await transcriptionApi.create({
        title,
        transcript: text,
        language: language !== 'auto' ? language : undefined,
        duration_seconds: finalDuration || duration,
      })
      showToast('Transcription saved!', 'success')
    } catch {
      showToast('Failed to save transcription.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Live Transcription</h1>
        <p className="text-gray-500 text-sm mt-1">
          Speak in Hindi, English or Hinglish — your speech appears in real time.
        </p>
      </div>

      {/* Mic permission error */}
      {micError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{micError}</span>
        </div>
      )}

      {/* Controls card */}
      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Mic icon + status */}
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors
                ${isRecording ? 'bg-red-100' : 'bg-gray-100'}`}
            >
              {isRecording ? (
                <Mic className="w-8 h-8 text-red-500" />
              ) : (
                <MicOff className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isRecording && <span className="recording-dot" />}
                <span className="font-semibold text-gray-900">
                  {isConnecting
                    ? 'Connecting…'
                    : isStopping
                    ? 'Processing…'
                    : isRecording
                    ? 'Recording'
                    : 'Ready'}
                </span>
              </div>
              <div className="text-2xl font-mono font-bold text-gray-700 mt-0.5">
                {formatDuration(duration)}
              </div>
              {language !== 'auto' && (
                <span className="badge bg-blue-100 text-blue-700 mt-1">
                  {languageLabel(language)}
                </span>
              )}
              {isRecording && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-green-500 h-1.5 rounded-full transition-all duration-75"
                      style={{ width: `${Math.min(100, Math.max(8, audioLevel))}%` }}
                    />
                  </div>
                  <span className="text-xs text-green-600 font-medium">Listening</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            {!isRecording && !isStopping ? (
              <button
                className="btn-primary"
                onClick={startRecording}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                Start Recording
              </button>
            ) : (
              <button
                className="btn-danger"
                onClick={stopRecording}
                disabled={isStopping}
              >
                {isStopping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                Stop Recording
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transcript area */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700 text-sm">Transcript</span>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-xs px-3 py-1.5"
              onClick={handleClear}
              disabled={!fullTranscript.trim()}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
            <button
              className="btn-secondary text-xs px-3 py-1.5"
              onClick={handleCopy}
              disabled={!fullTranscript.trim()}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            <button
              className="btn-primary text-xs px-3 py-1.5"
              onClick={handleSave}
              disabled={!confirmedText.trim() || isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Save
            </button>
          </div>
        </div>

        <div
          className="min-h-48 max-h-96 overflow-y-auto rounded-lg bg-gray-50 p-4 text-base leading-relaxed"
          style={{ fontFamily: "'Inter', 'Noto Sans Devanagari', sans-serif" }}
        >
          {!fullTranscript.trim() ? (
            <p className="text-gray-400 italic">
              Your transcription will appear here as you speak…
            </p>
          ) : (
            <>
              <span className="text-gray-900">{confirmedText}</span>
              {partialText && (
                <span className="text-gray-400 italic"> {partialText}</span>
              )}
            </>
          )}
          <div ref={transcriptEndRef} />
        </div>

        {confirmedText && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle className="w-3.5 h-3.5" />
            {confirmedText.split(' ').filter(Boolean).length} words transcribed
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700 space-y-1">
        <p className="font-medium">Tips for best results:</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-600">
          <li>Speak clearly at a normal pace</li>
          <li>Works best in a quiet environment</li>
          <li>Hindi, English and Hinglish are all supported</li>
          <li>Short pauses help the model detect sentence boundaries</li>
        </ul>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  )
}
