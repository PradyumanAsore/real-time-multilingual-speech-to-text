# Speech to Text — Real-Time Multilingual Transcription Web Application

A full-stack, production-ready web application for real-time multilingual speech-to-text transcription powered by **Faster-Whisper**, **FastAPI**, **React**, and **PostgreSQL**.

Specifically engineered for real-time transcription of **Hindi**, **English**, and **mixed Hindi-English conversations (Hinglish)**, e.g.:
> *"आज मुझे Python में एक नया project बनाना है और उसको deploy करना है."*

---

## 📋 Table of Contents
- [✨ Key Features](#-key-features)
- [🏗️ System Architecture](#️-system-architecture)
- [📁 Project Structure](#-project-structure)
- [🚀 Quick Start (Docker — Recommended)](#-quick-start-docker--recommended)
- [🛠️ Standalone Local Development](#️-standalone-local-development)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Database Setup (PostgreSQL or SQLite)](#2-database-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [🧪 Running Automated Tests](#-running-automated-tests)
- [🎙️ Manual Testing Guide (Hinglish)](#️-manual-testing-guide-hinglish)
- [📡 API & WebSocket Reference](#-api--websocket-reference)
- [⚙️ Configuration & Environment Variables](#️-configuration--environment-variables)
- [🐛 Troubleshooting & FAQ](#-troubleshooting--faq)

---

## ✨ Key Features

- 🎙️ **Real-Time Streaming Transcription:** Audio is captured, downsampled to 16kHz PCM, and streamed via WebSockets with incremental partial and confirmed sentence rendering.
- 🌐 **Multilingual & Hinglish Support:** Native support for Hindi, English, and code-mixed speech without locking into a single language.
- 🤖 **100% Self-Hosted & Free:** Powered by **Faster-Whisper** (CTranslate2) with integrated **Silero VAD** (Voice Activity Detection). No paid third-party APIs or cloud egress.
- 📊 **Real-Time Visual Sound Meter:** Live audio energy meter gives immediate visual feedback that your microphone is active.
- 💾 **Full CRUD Management:** Persist transcriptions with title, detected language, and duration. Search, paginate, edit, and delete with confirmation dialogs.
- 🐳 **Universal Docker Deployment:** One-command setup running PostgreSQL, FastAPI backend, and Nginx-served React frontend.
- 💻 **Cross-Platform:** Runs seamlessly on macOS, Linux, and Windows.

---

## 🏗️ System Architecture

```
[Browser Microphone]
       │
       ▼ (MediaDevices API + ScriptProcessorNode)
[Resampled 16kHz 16-bit Mono PCM]
       │ (WebSocket JSON Chunking: ws://host:8000/ws/transcribe)
       ▼
[FastAPI Backend Handler]
       │ (Silero VAD filters silence)
       ▼
[Faster-Whisper Model (CTranslate2)]
       │ (Sliding 30s window + Word-Overlap Deduplication)
       ▼
[Real-Time WebSocket Response: partial / final]
       │
       ▼
[React Live Transcript Interface]
       │
       ▼ (User clicks "Save")
[PostgreSQL Database (Persistent Storage)]
```

---

## 📁 Project Structure

```
Transcription/
├── backend/
│   ├── app/
│   │   ├── api/routes/transcriptions.py   # REST API CRUD & stats endpoints
│   │   ├── core/config.py                 # Pydantic BaseSettings (.env reader)
│   │   ├── db/database.py                 # Async SQLAlchemy engine & session
│   │   ├── models/transcription.py        # ORM model (UUID, timestamps, indexes)
│   │   ├── schemas/transcription.py       # Pydantic schemas (Request / Response)
│   │   ├── services/
│   │   │   ├── speech_service.py          # Whisper model, VAD & deduplication
│   │   │   └── transcription_service.py   # Database query business logic
│   │   ├── websocket/transcription_ws.py  # WebSocket protocol handler
│   │   └── main.py                        # FastAPI entry point & CORS
│   ├── alembic/                           # Database schema migration scripts
│   ├── tests/test_api.py                  # 11 unit & integration test cases
│   ├── Dockerfile                         # Backend container definition
│   └── requirements.txt                   # Universal Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/ui/                 # Layout, ConfirmDialog, Pagination, Toast
│   │   ├── hooks/useRecorder.ts           # Mic streaming, audio meter, WS lifecycle
│   │   ├── pages/                         # Dashboard, Transcribe, History, Detail
│   │   ├── services/                      # Axios API and WebSocket clients
│   │   ├── types/index.ts                 # TypeScript interfaces
│   │   └── utils/index.ts                 # Duration & date formatters
│   ├── Dockerfile                         # Multi-stage production Nginx container
│   ├── nginx.conf                         # Reverse proxy config for SPA + /api + /ws
│   └── vite.config.ts                     # Dev server proxy configuration
├── docker-compose.yml                     # Multi-container orchestration
├── .env.example                           # Configuration blueprint
├── PROJECT_CONTEXT.md                     # Deep-dive architecture & context file
└── README.md                              # Main documentation
```

---

## 🚀 Quick Start (Docker — Recommended)

Docker Compose starts PostgreSQL, executes migrations, pre-loads the speech model, and boots both frontend and backend.

### 1. Clone & Enter Project Directory
```bash
git clone https://github.com/PradyumanAsore/real-time-multilingual-speech-to-text
cd real-time-multilingual-speech-to-text
```

### 2. Prepare Environment File

**macOS / Linux:**
```bash
cp .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Windows (Command Prompt):**
```cmd
copy .env.example .env
```

### 3. Launch Services
```bash
docker compose up --build
```

- **Frontend Application:** [http://localhost](http://localhost) (port 80)
- **Backend API & Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

*Note: On the first run, Docker will download the Whisper model (~1.4 GB for `medium`). Subsequent starts use the cached Docker volume.*

To stop the containers:
```bash
docker compose down
```

---

## 🛠️ Standalone Local Development

If you prefer to run without Docker, follow these cross-platform steps:

### Prerequisites
- **Python:** 3.11, 3.12, or 3.13
- **Node.js:** 18+ and **npm**
- **FFmpeg:** Installed on your system PATH (required by Faster-Whisper for audio decoding)
  - **macOS:** `brew install ffmpeg`
  - **Linux (Ubuntu/Debian):** `sudo apt update && sudo apt install -y ffmpeg`
  - **Windows:** `winget install Gyan.FFmpeg` (or download from [ffmpeg.org](https://ffmpeg.org))

---

### 1. Backend Setup

From the project root:

```bash
cd backend
```

#### Create Virtual Environment

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows (PowerShell):**
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
python -m venv .venv
.venv\Scripts\activate.bat
```

#### Install Dependencies
```bash
pip install -r requirements.txt
```

---

### 2. Database Setup

You have two options for the database:

#### Option A: Zero-Configuration Local SQLite (Fastest)
The backend includes built-in support for an async SQLite database for immediate local development. In `backend/.env` (or root `.env`), set:
```ini
DATABASE_URL_OVERRIDE="sqlite+aiosqlite:///./speech_db.sqlite3"
```
The application will automatically create all tables on startup.

#### Option B: Local PostgreSQL
If using your local PostgreSQL instance:
1. Ensure PostgreSQL is running on port 5432.
2. Create the user and database:
   - **Using the provided script (PowerShell):**
     ```powershell
     .\setup_db.ps1
     ```
   - **Or via psql CLI (macOS / Linux / Windows):**
     ```bash
     psql -U postgres -h localhost -f setup_db.sql
     ```
3. Run Alembic migrations:
   ```bash
   alembic upgrade head
   ```

#### Start the Backend Server
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 3. Frontend Setup

In a new terminal window, navigate to the frontend directory:

```bash
cd frontend
```

#### Install Node Dependencies
```bash
npm install
```

#### Run Frontend Dev Server
```bash
npm run dev
```

Open your browser at **[http://localhost:5173](http://localhost:5173)**.  
The Vite dev server automatically proxies `/api` and `/ws` requests to `http://localhost:8000`.

---

## 🧪 Running Automated Tests

The backend includes a comprehensive test suite covering CRUD APIs, database transactions, empty audio handling, deduplication algorithms, and WebSocket connectivity.

From the `backend` directory with your virtual environment activated:

```bash
# Run all tests
pytest -v

# Run with test coverage report
pytest -v --cov=app
```

Expected output:
```text
============================= 11 passed in ~4.5s ==============================
```

---

## 🎙️ Manual Testing Guide (Hinglish)

1. Open **[http://localhost:5173](http://localhost:5173)** in Google Chrome or Microsoft Edge.
2. Navigate to **Transcribe** in the top navigation bar.
3. Click **Start Recording**. When prompted by your browser, click **Allow** for microphone access.
4. Verify that the green **"Listening"** energy bar pulses as you speak.
5. Speak the following test sentence at a normal conversational pace:
   > *"आज मुझे Python में एक नया project बनाना है और उसको deploy करना है."*
6. Observe the text appearing incrementally on the screen in real time.
7. Click **Stop Recording** — the finalized transcript will be rendered.
8. Click **Save** to persist the record to the database.
9. Navigate to **Dashboard** or **History** to:
   - Search for the transcript using keywords (e.g., `Python` or `deploy`).
   - Click to open the record, edit the title or text, copy it, or delete it.

---

## 📡 API & WebSocket Reference

### REST Endpoints (`/api`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/transcriptions/stats` | Aggregated statistics (total count, total duration, recent items) |
| `POST` | `/api/transcriptions` | Persist a new transcription record |
| `GET` | `/api/transcriptions?search=&page=1&page_size=20` | Paginated transcription list with full-text search |
| `GET` | `/api/transcriptions/{id}` | Retrieve individual transcription by UUID |
| `PUT` | `/api/transcriptions/{id}` | Update title or transcript text |
| `DELETE` | `/api/transcriptions/{id}` | Delete a transcription record |
| `GET` | `/health` | Service health status check |

### WebSocket Protocol (`/ws/transcribe`)

#### Client → Server
```json
// Send raw 16kHz 16-bit mono PCM chunk (Base64 encoded)
{ "type": "audio_chunk", "data": "<base64_encoded_pcm>" }

// Stop recording and request final inference
{ "type": "stop" }

// Connection heartbeat
{ "type": "ping" }
```

#### Server → Client
```json
// Connection established
{ "type": "connected", "message": "Ready to transcribe" }

// Incremental partial transcription
{ "type": "partial", "text": "आज मुझे Python", "confirmed": "आज मुझे Python", "language": "hi" }

// Finalized transcription
{ "type": "final", "text": "आज मुझे Python में एक नया project बनाना है", "confirmed": "...", "language": "hi", "duration": 5.4 }

// Error message
{ "type": "error", "message": "Detailed error message" }
```

---

## ⚙️ Configuration & Environment Variables

All settings are configured via `.env` in the project root:

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `Speech to Text` | Application title |
| `DEBUG` | `false` | Enables verbose SQL and debug logs |
| `DATABASE_URL_OVERRIDE` | `""` | Set to `sqlite+aiosqlite:///./speech_db.sqlite3` for local SQLite |
| `POSTGRES_HOST` | `localhost` (or `db`) | PostgreSQL host address |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `speech_user` | PostgreSQL user role |
| `POSTGRES_PASSWORD` | `speech_password` | PostgreSQL user password |
| `POSTGRES_DB` | `speech_db` | PostgreSQL database name |
| `WHISPER_MODEL_SIZE` | `base` (local) / `medium` (docker) | Model variant (`tiny`, `base`, `small`, `medium`, `large-v3`) |
| `WHISPER_DEVICE` | `cpu` | Processing device (`cpu` or `cuda`) |
| `WHISPER_COMPUTE_TYPE` | `int8` | Quantization (`int8` for CPU, `float16` for GPU) |
| `WHISPER_LANGUAGE` | `""` | Leave empty for automatic multilingual detection |
| `WHISPER_VAD_FILTER` | `true` | Enables Silero VAD silence filtering |
| `WHISPER_VAD_THRESHOLD` | `0.5` | Voice activity detection sensitivity threshold |
| `CORS_ORIGINS` | `["http://localhost:5173", ...]` | Allowed origins for web and websocket clients |

### Model Selection Guide

| Model Size | Weights Size | Hindi / Hinglish Accuracy | CPU Speed | Recommended For |
|---|---|---|---|---|
| `tiny` | ~75 MB | Fair | Ultra-fast | Low-power devices / CI |
| `base` | ~145 MB | Good | Fast | Rapid local testing |
| `small` | ~465 MB | Very Good | Moderate | Balanced CPU usage |
| `medium` | ~1.5 GB | **Superior** | Moderate | **Production / Docker (Recommended)** |
| `large-v3` | ~3.1 GB | State-of-the-art | Slower on CPU | NVIDIA GPU deployments (`cuda`) |

---

## 🐛 Troubleshooting & FAQ

### 1. Microphone Access Denied or No Audio
- Browsers only permit microphone access over `http://localhost` or `https://`. Ensure you are not accessing via raw IP without an SSL certificate.
- Look at the **green Listening bar** on the screen while recording. If it remains completely flat, check your OS microphone privacy settings and input device selection.

### 2. "ValueError: '' is not a valid language code"
- Faster-Whisper requires `language=None` (not an empty string `""`) to enable multilingual auto-detection. This is already handled automatically in `speech_service.py`. Keep `WHISPER_LANGUAGE=` empty in `.env` to retain auto-detection.

### 3. PostgreSQL Password Authentication Failed
- If running locally without Docker and you haven't configured PostgreSQL roles yet, either:
  1. Use the SQLite fallback by adding `DATABASE_URL_OVERRIDE="sqlite+aiosqlite:///./speech_db.sqlite3"` to `backend/.env`.
  2. Or run `setup_db.sql` / `setup_db.ps1` with your PostgreSQL superuser to create the `speech_user` role.

### 4. WebSocket Disconnection
- The frontend client includes automatic retry logic with exponential backoff (up to 3 attempts).
- Ensure the backend server is running on port 8000 and that no firewall is blocking WebSocket traffic.

---

## 📄 License

This project is licensed under the MIT License — free for personal, academic, and commercial use.
