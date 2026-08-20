# lia-til API (Phase 2 · S1)

FastAPI backend for lia-til, deployed on **Render**, backed by **Neon Postgres**.
Public endpoints expose **aggregate counts only** — no company names, roles, or
other private data. Full private views come later behind auth (S2).

## Endpoints

- `GET /health` → `{"status":"ok"}`
- `GET /api/applications/summary` → `{ updatedAt, totalSubmitted, byStatus, byDate }`

## Render config

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Env var | `DATABASE_URL` = your Neon connection string |

## Seed the database (one-time, local)

The importer reads the **local** ledger + writes the full data into your
**private** Neon DB. Run it yourself with your own `DATABASE_URL`:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require' \
  LEDGER_PATH='/path/to/application_log.md' \
  python import_ledger.py
```

## Local dev

```bash
cd backend && source .venv/bin/activate
DATABASE_URL='...' uvicorn main:app --reload
# http://localhost:8000/health
```
