// API types matching backend Pydantic schemas

export interface Transcription {
  id: string
  title: string
  transcript: string
  language: string | null
  duration_seconds: number
  created_at: string
  updated_at: string
}

export interface TranscriptionCreate {
  title: string
  transcript: string
  language?: string | null
  duration_seconds?: number
}

export interface TranscriptionUpdate {
  title?: string
  transcript?: string
  language?: string | null
  duration_seconds?: number
}

export interface TranscriptionListResponse {
  items: Transcription[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface DashboardStats {
  total_transcriptions: number
  total_duration_seconds: number
  recent_transcriptions: Transcription[]
}

// WebSocket message types
export type WsIncomingType = 'connected' | 'partial' | 'final' | 'error' | 'pong'

export interface WsMessage {
  type: WsIncomingType
  text?: string
  confirmed?: string
  language?: string
  duration?: number
  message?: string
}
