/**
 * useRecorder hook
 *
 * Manages:
 * - Microphone access via MediaDevices API
 * - Resampling audio to 16kHz PCM (required by Whisper)
 * - Chunking audio and sending to WebSocket
 * - Recording duration timer
 * - WebSocket connection lifecycle
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { TranscriptionWebSocket, type WsCallbacks } from '../services/websocket'

const TARGET_SAMPLE_RATE = 16000
const CHUNK_INTERVAL_MS = 1000 // Send chunk every 1.0 second

export type RecordingState = 'idle' | 'connecting' | 'recording' | 'stopping' | 'error'

export interface UseRecorderOptions {
  onPartial: (text: string, confirmed: string, language: string) => void
  onFinal: (text: string, language: string, duration: number) => void
  onError: (msg: string) => void
}

export function useRecorder({ onPartial, onFinal, onError }: UseRecorderOptions) {
  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [micError, setMicError] = useState<string | null>(null)

  const wsRef = useRef<TranscriptionWebSocket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(0)
  const chunkBufferRef = useRef<Float32Array[]>([])
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Utilities ─────────────────────────────────────────────────────────────

  const float32ToPCM16 = (float32Array: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(float32Array.length * 2)
    const view = new DataView(buffer)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return buffer
  }

  const downsampleBuffer = (
    buffer: Float32Array,
    inputRate: number,
    outputRate: number,
  ): Float32Array => {
    if (inputRate === outputRate) return buffer
    const ratio = inputRate / outputRate
    const newLength = Math.round(buffer.length / ratio)
    const result = new Float32Array(newLength)
    for (let i = 0; i < newLength; i++) {
      result[i] = buffer[Math.round(i * ratio)]
    }
    return result
  }

  const flushChunk = useCallback(() => {
    if (!wsRef.current || chunkBufferRef.current.length === 0) return
    // Concatenate buffered frames
    const totalLen = chunkBufferRef.current.reduce((s, a) => s + a.length, 0)
    const merged = new Float32Array(totalLen)
    let offset = 0
    for (const frame of chunkBufferRef.current) {
      merged.set(frame, offset)
      offset += frame.length
    }
    chunkBufferRef.current = []
    const pcm = float32ToPCM16(merged)
    wsRef.current.sendAudioChunk(pcm)
  }, [])

  // ── Start recording ────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setMicError(null)
    setState('connecting')

    // 1. Request mic
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: TARGET_SAMPLE_RATE,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied. Please allow access and try again.'
          : `Microphone error: ${err instanceof Error ? err.message : String(err)}`
      setMicError(msg)
      onError(msg)
      setState('error')
      return
    }

    streamRef.current = stream

    // 2. Create WebSocket
    const callbacks: WsCallbacks = {
      onConnected: () => setState('recording'),
      onPartial,
      onFinal,
      onError: (msg) => { onError(msg); setState('error') },
      onDisconnect: () => {
        if (state === 'recording') setState('idle')
      },
    }
    const ws = new TranscriptionWebSocket(callbacks)
    wsRef.current = ws
    ws.connect()

    // 3. Set up AudioContext for capture and resampling
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const context = new AudioContextClass({ sampleRate: TARGET_SAMPLE_RATE })
    audioContextRef.current = context

    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch (e) {
        console.warn('Could not resume AudioContext:', e)
      }
    }

    const source = context.createMediaStreamSource(stream)
    const processor = context.createScriptProcessor(4096, 1, 1)
    processorRef.current = processor

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0)
      
      // Calculate audio energy/level for UI feedback
      let sum = 0
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i]
      }
      const rms = Math.sqrt(sum / inputData.length)
      setAudioLevel(Math.min(100, Math.round(rms * 600)))

      const resampled = downsampleBuffer(inputData, context.sampleRate, TARGET_SAMPLE_RATE)
      chunkBufferRef.current.push(new Float32Array(resampled))
    }

    // Connect to destination through zero-gain node so user does not hear feedback echo
    const zeroGain = context.createGain()
    zeroGain.gain.value = 0
    source.connect(processor)
    processor.connect(zeroGain)
    zeroGain.connect(context.destination)

    // 4. Send chunk every interval
    chunkTimerRef.current = setInterval(flushChunk, CHUNK_INTERVAL_MS)

    // 5. Duration timer
    durationRef.current = 0
    setDuration(0)
    intervalRef.current = setInterval(() => {
      durationRef.current += 1
      setDuration(durationRef.current)
    }, 1000)
  }, [onPartial, onFinal, onError, flushChunk, state])

  // ── Stop recording ────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    setState('stopping')

    // Clear timers
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current)

    // Flush remaining audio
    flushChunk()

    // Disconnect audio pipeline
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    // Signal backend to finalize
    if (wsRef.current) {
      wsRef.current.stop()
      // Disconnect after a short delay to let the final message arrive
      setTimeout(() => {
        wsRef.current?.disconnect()
        wsRef.current = null
        setState('idle')
      }, 3000)
    } else {
      setState('idle')
    }
  }, [flushChunk])

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current)
      wsRef.current?.disconnect()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioContextRef.current?.close()
    }
  }, [])

  return {
    state,
    duration,
    audioLevel,
    micError,
    startRecording,
    stopRecording,
    isRecording: state === 'recording',
    isStopping: state === 'stopping',
    isConnecting: state === 'connecting',
  }
}
