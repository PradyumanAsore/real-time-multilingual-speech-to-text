"""Application configuration using Pydantic Settings."""
from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Speech to Text"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    API_PREFIX: str = "/api"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Database
    DATABASE_URL_OVERRIDE: Optional[str] = None
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "speech_user"
    POSTGRES_PASSWORD: str = "speech_password"
    POSTGRES_DB: str = "speech_db"

    @property
    def DATABASE_URL(self) -> str:
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        if self.DATABASE_URL_OVERRIDE:
            return self.DATABASE_URL_OVERRIDE.replace("+asyncpg", "+psycopg2").replace("+aiosqlite", "")
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Whisper model settings
    WHISPER_MODEL_SIZE: str = "medium"          # tiny/base/small/medium/large-v3
    WHISPER_DEVICE: str = "cpu"                 # cpu or cuda
    WHISPER_COMPUTE_TYPE: str = "int8"          # int8, float16, float32
    WHISPER_LANGUAGE: Optional[str] = None      # None = auto-detect (multilingual)
    WHISPER_BEAM_SIZE: int = 5
    WHISPER_VAD_FILTER: bool = True             # Use Silero VAD inside faster-whisper
    WHISPER_VAD_THRESHOLD: float = 0.5

    # Audio settings
    AUDIO_SAMPLE_RATE: int = 16000
    AUDIO_CHUNK_DURATION_MS: int = 2000         # Process every 2 seconds
    AUDIO_MAX_BUFFER_SECONDS: int = 30          # Rolling buffer max

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
