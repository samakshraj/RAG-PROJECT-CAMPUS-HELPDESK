# Campus Helpdesk

This repository contains the student dashboard, login page, admin panel, and shared FastAPI service. The three web apps use the same Firebase project and API. The API stores user data in SQLite and indexes campus PDFs in Chroma.

## Setup

Install Node.js 22.12 or later and Python 3.10 or later. From the repository root:

```powershell
npm install
python -m venv campus-helpdesk-chat/.venv
& "campus-helpdesk-chat/.venv/Scripts/python.exe" -m pip install -r campus-helpdesk-chat/rag-service/requirements.txt
```

Copy `campus-helpdesk-chat/.env.example` to `campus-helpdesk-chat/.env`, then configure Firebase service-account credentials, any super-admin UIDs, the Groq key, and the campus PDF folder as described in [the API setup guide](campus-helpdesk-chat/rag-service/README.md). On first startup the configured local demo admin and student accounts are restored automatically; this is enabled by `PRELOAD_DEMO_ACCOUNTS=true`. The login app and admin panel also have `.env.example` files; copy them to `.env` in their respective folders if their settings need to differ. Never commit `.env` files or service-account keys.

## Run an app

Run these commands from the repository root. Each web app connects to the shared API on port 8000.

```powershell
npm run dev          # All panels plus the shared API
npm run dev:student  # Student dashboard only, http://localhost:5174
npm run dev:login    # Login page, http://localhost:5173
npm run dev:admin    # Admin panel, http://localhost:5175
```

`npm run dev:full` starts the shared API plus all three panels together. The launcher reuses a compatible API already listening on port 8000.

If port 8000 is occupied by an incompatible API, the launcher automatically starts this project's API on the next available port from 8001 through 8010 and points panels started by it at that API. For a clean session, close any earlier development terminals before running the command.

## Build and check

```powershell
npm run build
npm run lint
npm test
```
