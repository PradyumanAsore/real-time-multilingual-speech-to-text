"""
Real-time speech recognition service using faster-whisper.

Architecture:
 - Maintains a single Whisper model instance (loaded once at startup).
 - Accumulates incoming PCM audio into a rolling buffer.
 - Every CHUNK_DURATION seconds of *new* audio, runs Whisper inference on
   the most recent MAX_BUFFER_SECONDS of audio (sliding window with overlap
   for context) with Silero VAD filtering enabled.
 - Tracks already-confirmed text to strip duplicates from subsequent runs.
"""
import io
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Generator, Optional

import numpy as np

logger = logging.getLogger(__name__)

try:
    from faster_whisper import WhisperModel
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    logger.warning("faster-whisper not installed – using mock transcription service.")


@dataclass
class TranscriptionSegment:
    text: str
    start: float
    end: float
    is_final: bool = False
    language: Optional[str] = None


@dataclass
class AudioBuffer:
    """Thread-safe rolling audio buffer."""
    sample_rate: int = 16000
    max_seconds: int = 30

    _lock: threading.Lock = field(default_factory=threading.Lock, init=False, repr=False)
    _data: list[np.ndarray] = field(default_factory=list, init=False, repr=False)
    _total_samples: int = field(default=0, init=False, repr=False)

    def append(self, chunk: np.ndarray) -> None:
        with self._lock:
            self._data.append(chunk)
            self._total_samples += len(chunk)
            # Trim oldest samples beyond max window
            max_samples = self.max_seconds * self.sample_rate
            while self._total_samples > max_samples and self._data:
                removed = self._data.pop(0)
                self._total_samples -= len(removed)

    def get_audio(self) -> np.ndarray:
        with self._lock:
            if not self._data:
                return np.zeros(0, dtype=np.float32)
            return np.concatenate(self._data)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
            self._total_samples = 0

    @property
    def duration_seconds(self) -> float:
        return self._total_samples / self.sample_rate


class WhisperTranscriptionService:
    """
    Wraps faster-whisper for incremental, multilingual transcription.
    Thread-safe for concurrent WebSocket sessions.
    """

    _model: Optional["WhisperModel"] = None
    _model_lock = threading.Lock()

    def __init__(self, settings=None):
        if settings is None:
            from app.core.config import get_settings
            settings = get_settings()
        self.settings = settings

    @classmethod
    def get_model(cls, settings=None) -> Optional["WhisperModel"]:
        """Return the shared model instance, loading it if necessary."""
        if not WHISPER_AVAILABLE:
            return None
        if cls._model is None:
            with cls._model_lock:
                if cls._model is None:  # double-checked locking
                    if settings is None:
                        from app.core.config import get_settings
                        settings = get_settings()
                    logger.info(
                        "Loading Whisper model '%s' on device '%s' (compute_type=%s)…",
                        settings.WHISPER_MODEL_SIZE,
                        settings.WHISPER_DEVICE,
                        settings.WHISPER_COMPUTE_TYPE,
                    )
                    t0 = time.time()
                    cls._model = WhisperModel(
                        settings.WHISPER_MODEL_SIZE,
                        device=settings.WHISPER_DEVICE,
                        compute_type=settings.WHISPER_COMPUTE_TYPE,
                        download_root="/models",
                    )
                    logger.info("Whisper model loaded in %.1f s", time.time() - t0)
        return cls._model

    def pcm_bytes_to_float32(self, raw_bytes: bytes) -> np.ndarray:
        """Convert raw 16-bit PCM bytes to float32 numpy array normalised to [-1, 1]."""
        audio_int16 = np.frombuffer(raw_bytes, dtype=np.int16)
        return audio_int16.astype(np.float32) / 32768.0

    def transcribe_buffer(
        self,
        audio: np.ndarray,
        language: Optional[str] = None,
    ) -> list[TranscriptionSegment]:
        """Run Whisper on a numpy float32 audio array."""
        model = self.get_model(self.settings)
        if model is None:
            # Mock mode: return a fake segment
            return [
                TranscriptionSegment(
                    text="[Whisper not installed – install faster-whisper to enable real transcription]",
                    start=0.0,
                    end=1.0,
                    is_final=True,
                    language="en",
                )
            ]

        if len(audio) < self.settings.AUDIO_SAMPLE_RATE * 0.5:
            # Less than 0.5s – not enough audio
            return []

        # Resolve target language: must be a valid non-empty string or None for auto-detect
        target_lang = None
        if language and str(language).strip() and str(language).strip().lower() not in ("auto", "none"):
            target_lang = str(language).strip().lower()
        elif self.settings.WHISPER_LANGUAGE and str(self.settings.WHISPER_LANGUAGE).strip():
            cand = str(self.settings.WHISPER_LANGUAGE).strip().lower()
            if cand not in ("auto", "none"):
                target_lang = cand

        segments_iter, info = model.transcribe(
            audio,
            language=target_lang,
            beam_size=self.settings.WHISPER_BEAM_SIZE,
            vad_filter=self.settings.WHISPER_VAD_FILTER,
            vad_parameters={
                "threshold": self.settings.WHISPER_VAD_THRESHOLD,
                "min_speech_duration_ms": 250,
                "max_speech_duration_s": float("inf"),
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 400,
            },
        )

        results: list[TranscriptionSegment] = []
        for seg in segments_iter:
            text = seg.text.strip()
            if text:
                results.append(
                    TranscriptionSegment(
                        text=text,
                        start=seg.start,
                        end=seg.end,
                        is_final=False,
                        language=info.language,
                    )
                )
        return results

    def merge_and_deduplicate(
        self,
        confirmed_text: str,
        new_segments: list[TranscriptionSegment],
    ) -> tuple[str, str]:
        """
        Given previously confirmed text and new segments from the latest window,
        return (updated_confirmed_text, partial_addition).

        Strategy: treat the last confirmed sentence as overlap anchor.
        """
        new_text = " ".join(s.text for s in new_segments).strip()
        if not new_text:
            return confirmed_text, ""

        if not confirmed_text:
            return confirmed_text, new_text

        # Find the longest suffix of confirmed_text that is a prefix of new_text
        # (handles overlap due to sliding window)
        words_confirmed = confirmed_text.split()
        words_new = new_text.split()

        overlap_len = 0
        for n in range(min(len(words_confirmed), len(words_new), 20), 0, -1):
            if words_confirmed[-n:] == words_new[:n]:
                overlap_len = n
                break

        addition = " ".join(words_new[overlap_len:]).strip()
        return confirmed_text, addition


class SessionTranscriptionContext:
    """
    Per-WebSocket-session transcription context.
    Manages audio buffer, confirmed text, and incremental chunk processing.
    """

    def __init__(self, service: WhisperTranscriptionService):
        self.service = service
        self.buffer = AudioBuffer(
            sample_rate=service.settings.AUDIO_SAMPLE_RATE,
            max_seconds=service.settings.AUDIO_MAX_BUFFER_SECONDS,
        )
        self.confirmed_text: str = ""
        self.detected_language: Optional[str] = None
        self._last_processed_duration: float = 0.0
        self._chunk_duration = service.settings.AUDIO_CHUNK_DURATION_MS / 1000.0
        self._start_time = time.time()

    def push_audio(self, raw_bytes: bytes) -> Optional[list[TranscriptionSegment]]:
        """
        Add audio bytes to the buffer. Returns transcription segments if
        enough new audio has accumulated to warrant inference; else None.
        """
        chunk = self.service.pcm_bytes_to_float32(raw_bytes)
        self.buffer.append(chunk)

        current_duration = self.buffer.duration_seconds
        if current_duration - self._last_processed_duration < self._chunk_duration:
            return None  # Not enough new audio yet

        self._last_processed_duration = current_duration
        return self._run_inference(is_final=False)

    def finalize(self) -> list[TranscriptionSegment]:
        """Run final inference on the complete buffer."""
        segments = self._run_inference(is_final=True)
        # Mark all as final
        for s in segments:
            s.is_final = True
        return segments

    def _run_inference(self, is_final: bool) -> list[TranscriptionSegment]:
        audio = self.buffer.get_audio()
        if len(audio) == 0:
            return []

        try:
            segments = self.service.transcribe_buffer(audio)
        except Exception as exc:
            logger.exception("Whisper inference error: %s", exc)
            return []

        if segments:
            if self.detected_language is None and segments[0].language:
                self.detected_language = segments[0].language

            confirmed, addition = self.service.merge_and_deduplicate(
                self.confirmed_text, segments
            )

            if is_final:
                # On final call, fully replace confirmed text with fresh inference
                new_full = " ".join(s.text for s in segments).strip()
                if new_full:
                    self.confirmed_text = new_full
            elif addition:
                self.confirmed_text = (confirmed + " " + addition).strip()
            elif not self.confirmed_text:
                self.confirmed_text = " ".join(s.text for s in segments).strip()

        return segments

    def reset(self) -> None:
        self.buffer.clear()
        self.confirmed_text = ""
        self._last_processed_duration = 0.0
        self._start_time = time.time()

    @property
    def recording_duration(self) -> float:
        return time.time() - self._start_time


# Singleton service instance
_service_instance: Optional[WhisperTranscriptionService] = None
_service_lock = threading.Lock()


def get_transcription_service() -> WhisperTranscriptionService:
    global _service_instance
    if _service_instance is None:
        with _service_lock:
            if _service_instance is None:
                _service_instance = WhisperTranscriptionService()
    return _service_instance
