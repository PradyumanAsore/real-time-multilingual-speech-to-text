# Real-Time Multilingual Speech-to-Text Application — Project Context

> **Project Name:** Speech to Text  
> **Repository Root:** `d:\Asccesment\Transcription`  
> **Architecture:** Decoupled Full-Stack Web Application (FastAPI + React + Faster-Whisper + PostgreSQL)

---

## 1. Executive Summary & Objective

This application enables users to speak naturally into their browser microphone and view their spoken words transcribed into text in **real time** (incrementally). 

A core requirement is robust support for **multilingual speech**, particularly **Hindi**, **English**, and **mixed Hindi-English conversations (Hinglish)**, such as:
> *"आज मुझे Python में एक नया project बनाना है और उसको deploy करना है."*

The application streams raw PCM audio from the client over WebSockets to a self-hosted speech recognition service running **Faster-Whisper** with **Silero VAD**, performs real-time deduplication and incremental transcription, and provides full **CRUD** management of transcriptions backed by a relational database with dashboard analytics.

---

## 2. Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Bundler / Dev Server:** Vite
- **Styling:** Tailwind CSS (custom components, responsive layouts, Inter font)
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Real-Time Streaming:** Browser MediaDevices API + Web Audio API (`AudioContext`, `ScriptProcessorNode`, zero-gain monitoring, live audio level detection) + Native WebSockets

### Backend
- **Language / Runtime:** Python 3.11+
- **API Framework:** FastAPI (asynchronous REST + WebSocket endpoints)
- **ASGI Server:** Uvicorn
- **ORM & Database Toolkit:** SQLAlchemy 2.0 (AsyncIO engine with `asyncpg` / `aiosqlite`)
- **Schema Validation & Settings:** Pydantic v2 & `pydantic-settings`
- **Database Migrations:** Alembic

### Speech Recognition & Audio Pipeline
- **STT Engine:** Faster-Whisper (CTranslate2 optimized Whisper implementation)
- **Voice Activity Detection:** Silero VAD (integrated filter to discard non-speech frames)
- **Audio Format:** 16,000 Hz, 16-bit Mono Linear PCM
- **Model Support:** Multilingual Whisper models (`tiny`, `base`, `small`, `medium`, `large-v3`) with automated language detection

### Database & Storage
- **Primary Database:** PostgreSQL 16+ (`speech_db`)
- **Local Dev Fallback:** SQLite with `aiosqlite` via `DATABASE_URL_OVERRIDE`
- **Search Capabilities:** PostgreSQL `pg_trgm` GIN indexes for fuzzy search over titles and transcripts

### Infrastructure & Containerization
- **Containerization:** Docker with multi-stage builds (Frontend: Alpine Nginx; Backend: Python Slim with ffmpeg/libsndfile)
- **Orchestration:** Docker Compose (services: `db`, `backend`, `frontend`, `migrate`)

---

## 3. Directory & File Architecture

```
Transcription/
├── .env                              # Active environment configuration
├── .env.example                      # Configuration template
├── .gitignore                        # Git exclusion rules
├── docker-compose.yml                # Docker service orchestration
├── README.md                         # Setup and execution guide
├── PROJECT_CONTEXT.md                # Comprehensive system architecture & context
│
├── backend/
│   ├── alembic.ini                   # Alembic migration configuration
│   ├── Dockerfile                    # Container definition for FastAPI backend
│   ├── pytest.ini                    # Pytest configuration (asyncio mode)
│   ├── requirements.txt              # Pinned Python package dependencies
│   ├── setup_db.ps1                  # PowerShell helper for PostgreSQL user/database creation
│   ├── setup_db.sql                  # Raw SQL for PostgreSQL user/database setup
│   │
│   ├── alembic/
│   │   ├── env.py                    # Async migration environment script
│   │   ├── script.py.mako            # Migration template
│   │   └── versions/
│   │       └── 0001_initial.py       # Initial schema creation (transcriptions table + indexes)
│   │
│   ├── app/
│   │   ├── main.py                   # FastAPI entrypoint, CORS, lifespan model & table loader
│   │   ├── api/
│   │   │   └── routes/
│   │   │       └── transcriptions.py # REST endpoints (CRUD + dashboard statistics)
│   │   ├── core/
│   │   │   └── config.py             # Pydantic Settings class (.env reader)
│   │   ├── db/
│   │   │   └── database.py           # Async engine, sessionmaker, Base, create_tables
│   │   ├── models/
│   │   │   └── transcription.py      # SQLAlchemy ORM model for transcriptions
│   │   ├── schemas/
│   │   │   └── transcription.py      # Pydantic models (Create, Update, Response, List, Stats)
│   │   ├── services/
│   │   │   ├── speech_service.py     # Faster-Whisper wrapper, AudioBuffer, sliding window, deduplication
│   │   │   └── transcription_service.py # Database CRUD business logic
│   │   └── websocket/
│   │       └── transcription_ws.py   # WebSocket handler (JSON framing, audio decoding, inference loop)
│   │
│   └── tests/
│       └── test_api.py               # 11 unit & integration tests (CRUD, Audio, WS, Dedup)
│
└── frontend/
    ├── index.html                    # Single Page Application entry HTML
    ├── nginx.conf                    # Nginx reverse proxy configuration for production
    ├── Dockerfile                    # Multi-stage production build (Node -> Nginx)
    ├── package.json                  # NPM dependencies and scripts
    ├── postcss.config.js             # PostCSS Tailwind plugins
    ├── tailwind.config.js            # Tailwind styling tokens
    ├── tsconfig.json                 # TypeScript compiler configuration
    ├── vite.config.ts                # Vite config with proxy routes for /api and /ws
    │
    └── src/
        ├── main.tsx                  # React DOM mount point
        ├── App.tsx                   # Top-level routing definition
        ├── index.css                 # Global CSS and Tailwind directives
        ├── types/
        │   └── index.ts              # TypeScript domain and WebSocket interfaces
        ├── services/
        │   ├── api.ts                # Axios API service for transcription CRUD
        │   └── websocket.ts          # TranscriptionWebSocket class with auto-reconnection
        ├── hooks/
        │   └── useRecorder.ts        # Microphone capture, PCM downsampling, level meter, WS orchestrator
        ├── utils/
        │   └── index.ts              # Duration, date formatting, and clipboard helpers
        ├── components/ui/
        │   ├── Layout.tsx            # Navigation header and responsive layout wrapper
        │   ├── ConfirmDialog.tsx     # Modal confirmation dialog for deletion
        │   ├── Pagination.tsx        # Numbered pagination component
        │   └── Toast.tsx             # Notification toast messages
        └── pages/
            ├── DashboardPage.tsx     # Overview metrics and recent transcriptions
            ├── TranscribePage.tsx    # Live speech transcription with audio level meter
            ├── HistoryPage.tsx       # Paginated history table with full-text search
            └── TranscriptionDetailPage.tsx # Dedicated view/edit/delete transcription screen
```

---

## 4. Real-Time Audio Streaming Pipeline

```
[Browser Microphone]
        │
        ▼ (navigator.mediaDevices.getUserMedia)
[Web Audio AudioContext]
        │ (Resampled to 16,000 Hz Mono via ScriptProcessorNode)
        ▼ (Computed RMS audio energy for live UI listening bar)
[Float32 -> 16-bit Linear PCM]
        │
        ▼ (Buffered into 1.0 second chunks, Base64 encoded)
[WebSocket Connection: ws://host/ws/transcribe]
        │
        ▼ (JSON Message: { "type": "audio_chunk", "data": "..." })
[FastAPI WebSocket Handler]
        │
        ▼ (Decoded into numpy float32 normalized to [-1.0, 1.0])
[Thread-Safe Rolling AudioBuffer (30s max sliding window)]
        │
        ▼ (Silero Voice Activity Detection filters silent frames)
[Faster-Whisper Model (CTranslate2)]
        │
        ▼ (Incremental Transcription Segments generated)
[Word-Overlap Deduplication Engine]
        │
        ▼ (JSON: { "type": "partial", "text": "...", "confirmed": "...", "language": "hi" })
[React Live Transcription Screen]
        │
        ▼ (User clicks "Stop Recording" -> "Save")
[PostgreSQL Database (Persistent Storage)]
```

### Key Audio Processing Strategies
1. **Multilingual Auto-Detection:** Faster-Whisper requires `language=None` to activate its automated multilingual routing. This allows Hindi, English, and Hinglish sentences to be recognized within the same speech session without forcing a single script.
2. **Sliding Audio Window:** The backend maintains up to 30 seconds of rolling audio to preserve acoustic context across sentence boundaries.
3. **Deduplication:** When Whisper transcribes the rolling audio window, `merge_and_deduplicate()` analyzes word-level suffix/prefix intersections against previously finalized text to prevent repeating words across successive chunks.
4. **Finalization:** When the client sends `{"type": "stop"}`, the backend runs inference over the accumulated audio buffer and sends `{"type": "final"}` with the definitive transcript and total duration.

---

## 5. WebSocket Communication Protocol

### Client-to-Server Messages
| Message Type | Format | Description |
|---|---|---|
| `audio_chunk` | `{"type": "audio_chunk", "data": "<base64 PCM>"}` | 16kHz 16-bit mono raw audio frames |
| `stop` | `{"type": "stop"}` | Instructs the backend to finalize transcription |
| `ping` | `{"type": "ping"}` | Keep-alive heartbeat message |

### Server-to-Client Messages
| Message Type | Format | Description |
|---|---|---|
| `connected` | `{"type": "connected", "message": "Ready to transcribe"}` | Sent immediately upon handshake acceptance |
| `partial` | `{"type": "partial", "text": "...", "confirmed": "...", "language": "hi"}` | Real-time incremental recognition update |
| `final` | `{"type": "final", "text": "...", "confirmed": "...", "language": "hi", "duration": 12.5}` | Final transcription upon recording completion |
| `pong` | `{"type": "pong"}` | Heartbeat response |
| `error` | `{"type": "error", "message": "..."}` | Error alert notification |

---

## 6. REST API Endpoints

Base URL: `/api`

| Method | Endpoint | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/transcriptions/stats` | Dashboard aggregated statistics | None | `DashboardStats` |
| `POST` | `/transcriptions` | Save a completed transcription | `TranscriptionCreate` | `TranscriptionResponse` (201) |
| `GET` | `/transcriptions` | List transcriptions (paginated & searched) | Query: `search`, `page`, `page_size` | `TranscriptionListResponse` |
| `GET` | `/transcriptions/{id}` | Retrieve individual transcription by UUID | None | `TranscriptionResponse` |
| `PUT` | `/transcriptions/{id}` | Update title or transcript text | `TranscriptionUpdate` | `TranscriptionResponse` |
| `DELETE` | `/transcriptions/{id}` | Delete transcription record | None | Empty (204) |
| `GET` | `/health` | Health check probe | None | `{"status": "ok", "version": "1.0.0"}` |

---

## 7. Database Model & Schema

**Table Name:** `transcriptions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | Primary Key, Default: `uuid4()` | Unique transcription identifier |
| `title` | `VARCHAR(255)` | Not Null, Indexed | Transcription title or generated snippet |
| `transcript` | `TEXT` | Not Null, Default: `""` | Complete transcribed text |
| `language` | `VARCHAR(50)` | Nullable | Detected language code (`hi`, `en`, etc.) |
| `duration_seconds` | `FLOAT` | Not Null, Default: `0.0` | Recorded duration in seconds |
| `created_at` | `TIMESTAMPTZ` | Not Null, Server Default: `now()` | Timestamp of creation |
| `updated_at` | `TIMESTAMPTZ` | Not Null, Auto-updated: `now()` | Timestamp of last modification |

**Indexes:**
- `ix_transcriptions_created_at` (B-Tree on `created_at DESC`)
- `ix_transcriptions_title` (B-Tree on `title`)
- `ix_transcriptions_title_trgm` (PostgreSQL GIN trigram index using `pg_trgm` for fast substring matching)

---

## 8. Configuration & Environment Variables

| Variable | Default Value | Purpose |
|---|---|---|
| `APP_NAME` | `Speech to Text` | Display name of the application |
| `DEBUG` | `false` | Enables verbose SQL logging and debug logs |
| `DATABASE_URL_OVERRIDE` | *(None)* | Set to `sqlite+aiosqlite:///./speech_db.sqlite3` for zero-setup local dev |
| `POSTGRES_HOST` | `localhost` (or `db` in Docker) | PostgreSQL host address |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `speech_user` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `speech_password` | PostgreSQL password |
| `POSTGRES_DB` | `speech_db` | PostgreSQL database name |
| `WHISPER_MODEL_SIZE` | `base` (local) / `medium` (docker) | Faster-Whisper model variant |
| `WHISPER_DEVICE` | `cpu` | Inference device (`cpu` or `cuda`) |
| `WHISPER_COMPUTE_TYPE` | `int8` | Precision (`int8` for CPU, `float16` for GPU) |
| `WHISPER_LANGUAGE` | *(empty string)* | Multilingual auto-detection (empty = auto) |
| `WHISPER_VAD_FILTER` | `true` | Enables Silero VAD silence filtering |
| `WHISPER_VAD_THRESHOLD` | `0.5` | VAD voice sensitivity threshold |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | Allowed HTTP/WS origins |

---

## 9. Development & Deployment Procedures

### Standalone Local Development
```powershell
# 1. Backend Setup
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 2. Frontend Setup (separate terminal)
cd frontend
npm install
npm run dev
# Access: http://localhost:5173
```

### Full Docker Deployment
```bash
docker compose up --build
# Access: http://localhost (Frontend port 80, Backend port 8000)
```

### Testing Suite
```powershell
cd backend
.venv\Scripts\activate
pytest -v
# Executes 11 automated test cases with in-memory SQLite and mocked model loading
```
