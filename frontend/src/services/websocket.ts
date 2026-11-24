/**
 * WebSocket service for real-time transcription.
 *
 * Usage:
 *   const ws = new TranscriptionWebSocket({ onPartial, onFinal, onError, onConnected })
 *   ws.connect()
 *   ws.sendAudioChunk(pcmBytes)   // call repeatedly during recording
 *   ws.stop()                     // triggers final transcription
 *   ws.disconnect()               // cleanup
 */

import type { WsMessage } from '../types'

export interface WsCallbacks {
  onConnected?: () => void
  onPartial?: (text: string, confirmed: string, language: string) => void
  onFinal?: (text: string, language: string, duration: number) => void
  onError?: (message: string) => void
  onDisconnect?: () => void
}

export class TranscriptionWebSocket {
  private ws: WebSocket | null = null
  private callbacks: WsCallbacks
  private wsUrl: string
  private shouldReconnect = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 2000

  constructor(callbacks: WsCallbacks) {
    this.callbacks = callbacks
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    this.wsUrl = `${protocol}//${host}/ws/transcribe`
  }

  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return

    this.ws = new WebSocket(this.wsUrl)
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data as string)
        this.handleMessage(msg)
      } catch {
        console.error('Failed to parse WS message:', event.data)
      }
    }

    this.ws.onerror = () => {
      this.callbacks.onError?.('WebSocket connection error. Retrying…')
    }

    this.ws.onclose = () => {
      this.callbacks.onDisconnect?.()
      if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        setTimeout(() => this.connect(), this.reconnectDelay)
      }
    }
  }

  private handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'connected':
        this.callbacks.onConnected?.()
        break
      case 'partial':
        this.callbacks.onPartial?.(msg.text ?? '', msg.confirmed ?? '', msg.language ?? 'auto')
        break
      case 'final':
        this.callbacks.onFinal?.(msg.text ?? '', msg.language ?? 'auto', msg.duration ?? 0)
        break
      case 'error':
        this.callbacks.onError?.(msg.message ?? 'Unknown error')
        break
      case 'pong':
        // heartbeat response – no action needed
        break
    }
  }

  sendAudioChunk(pcmBytes: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    // Convert ArrayBuffer → Base64
    const uint8 = new Uint8Array(pcmBytes)
    let binary = ''
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const base64 = btoa(binary)

    this.send({ type: 'audio_chunk', data: base64 })
  }

  stop(): void {
    this.send({ type: 'stop' })
  }

  ping(): void {
    this.send({ type: 'ping' })
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  enableReconnect(): void {
    this.shouldReconnect = true
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private send(payload: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }
}
