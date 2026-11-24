import axios from 'axios'
import type {
  DashboardStats,
  Transcription,
  TranscriptionCreate,
  TranscriptionListResponse,
  TranscriptionUpdate,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ─── Transcription CRUD ───────────────────────────────────────────────────────

export const transcriptionApi = {
  async create(payload: TranscriptionCreate): Promise<Transcription> {
    const { data } = await api.post<Transcription>('/transcriptions', payload)
    return data
  },

  async list(params: {
    search?: string
    page?: number
    page_size?: number
  } = {}): Promise<TranscriptionListResponse> {
    const { data } = await api.get<TranscriptionListResponse>('/transcriptions', { params })
    return data
  },

  async get(id: string): Promise<Transcription> {
    const { data } = await api.get<Transcription>(`/transcriptions/${id}`)
    return data
  },

  async update(id: string, payload: TranscriptionUpdate): Promise<Transcription> {
    const { data } = await api.put<Transcription>(`/transcriptions/${id}`, payload)
    return data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/transcriptions/${id}`)
  },

  async getStats(): Promise<DashboardStats> {
    const { data } = await api.get<DashboardStats>('/transcriptions/stats')
    return data
  },
}

export default api
