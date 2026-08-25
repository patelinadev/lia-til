"""lia-til API — FastAPI backend (Phase 2 · S1).

Public endpoints only. The applications table holds full private data, but this
service exposes ONLY aggregate counts (no company names, roles, salaries).
Private full views come later behind auth (S2).
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from db import Base, SessionLocal, engine
from models import Application, DailyLog, LeetcodeProblem, SDDeck

LEETCODE_TRACK = "0x3f Basic Algorithms"
LEETCODE_TRACK_URL = "https://space.bilibili.com/206214/channel/collectiondetail?sid=842776"

# Shared secret for the private endpoints. The site's server (never the browser)
# sends it after it has verified the admin's session. Set BACKEND_SECRET on Render.
ADMIN_SECRET = os.environ.get("BACKEND_SECRET")


def require_admin(x_admin_secret: Optional[str] = Header(default=None)) -> None:
    """Gate a private endpoint: reject unless the shared secret matches. If the
    secret isn't configured at all, the private endpoints stay closed."""
    if not ADMIN_SECRET or x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")


# ---- Write schemas (P2·S4 CRUD). Pydantic validates the body → 422 on bad shape.
class DailyLogIn(BaseModel):
    """Full body for creating/replacing one day (the `date` is the URL path)."""
    week: Optional[str] = None
    done: list[str] = Field(default_factory=list)
    summary: Optional[str] = None
    note: Optional[str] = None
    leetcode: list[dict] = Field(default_factory=list)


class DailyLogPatch(BaseModel):
    """Partial update — every field optional; only the ones sent are applied."""
    week: Optional[str] = None
    done: Optional[list[str]] = None
    summary: Optional[str] = None
    note: Optional[str] = None
    leetcode: Optional[list[dict]] = None


class DailyLogFull(DailyLogIn):
    """One entry for the bulk endpoint — carries its own `date`."""
    date: str


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Ensure the table exists so /summary never errors before the first import.
    if engine is not None:
        Base.metadata.create_all(engine)
    yield


app = FastAPI(title="lia-til API", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/applications/summary")
def applications_summary():
    """Anonymized aggregates: total, per-status counts, per-day counts."""
    if SessionLocal is None:
        return {"updatedAt": None, "totalSubmitted": 0, "byStatus": {}, "byDate": []}

    with SessionLocal() as session:
        total = session.scalar(select(func.count()).select_from(Application)) or 0

        by_status = {
            status: count
            for status, count in session.execute(
                select(Application.status, func.count()).group_by(Application.status)
            ).all()
        }

        by_date = [
            {"date": day.isoformat(), "count": count}
            for day, count in session.execute(
                select(Application.applied_date, func.count())
                .where(Application.applied_date.isnot(None))
                .group_by(Application.applied_date)
                .order_by(Application.applied_date)
            ).all()
        ]

    return {
        "updatedAt": by_date[-1]["date"] if by_date else None,
        "totalSubmitted": total,
        "byStatus": by_status,
        "byDate": by_date,
    }


@app.get("/api/applications/full", dependencies=[Depends(require_admin)])
def applications_full():
    """PRIVATE — full per-company ledger rows. Only reachable with the shared
    secret; the public site gates this behind the admin's GitHub session."""
    if SessionLocal is None:
        return {"applications": []}
    with SessionLocal() as session:
        rows = (
            session.execute(select(Application).order_by(Application.app_num))
            .scalars()
            .all()
        )
        apps = [
            {
                "appNum": r.app_num,
                "company": r.company,
                "role": r.role,
                "resume": r.resume,
                "appliedDate": r.applied_date.isoformat() if r.applied_date else None,
                "status": r.status,
                "notes": r.notes,
            }
            for r in rows
        ]
    return {"total": len(apps), "applications": apps}


@app.get("/api/leetcode")
def leetcode():
    """Solved problems in 0x3f plan order (episode, then plan order within it)."""
    if SessionLocal is None:
        return {"track": LEETCODE_TRACK, "trackUrl": LEETCODE_TRACK_URL, "updatedAt": None, "problems": []}
    with SessionLocal() as session:
        rows = (
            session.execute(select(LeetcodeProblem).order_by(LeetcodeProblem.seq))
            .scalars()
            .all()
        )
        problems = [
            {
                "id": r.id,
                "slug": r.slug,
                "title": r.title,
                "topics": r.topics or [],
                "ep": r.ep,
                "difficulty": r.difficulty,
                "status": r.status,
                "date": r.date,
                "solutionUrl": r.solution_url,
            }
            for r in rows
        ]
    dates = sorted(p["date"] for p in problems if p["date"])
    return {
        "track": LEETCODE_TRACK,
        "trackUrl": LEETCODE_TRACK_URL,
        "updatedAt": dates[-1] if dates else None,
        "problems": problems,
    }


@app.get("/api/system-design")
def system_design():
    """Completed System Design decks in curriculum order. Each deck carries its
    full slide array; the diagram components live in the frontend by key."""
    if SessionLocal is None:
        return {"decks": []}
    with SessionLocal() as session:
        rows = session.execute(select(SDDeck).order_by(SDDeck.n)).scalars().all()
        decks = [
            {
                "n": r.n,
                "slug": r.slug,
                "title": r.title,
                "lastReviewed": r.last_reviewed,
                "slides": r.slides or [],
            }
            for r in rows
        ]
    return {"decks": decks}


def _daily_log_entries():
    """Daily-log entries newest-first, LeetCode items enriched with their
    solution URL from the leetcode table (single source). Shared by the public
    and the private (authenticated) endpoints."""
    if SessionLocal is None:
        return []
    with SessionLocal() as session:
        sol = {
            pid: url
            for pid, url in session.execute(
                select(LeetcodeProblem.id, LeetcodeProblem.solution_url)
            ).all()
        }
        rows = session.execute(select(DailyLog).order_by(DailyLog.date.desc())).scalars().all()
        return [
            {
                "date": r.date,
                "week": r.week,
                "done": r.done or [],
                "summary": r.summary,
                "note": r.note,
                "leetcode": [
                    {**item, "solutionUrl": sol.get(item.get("id"))} for item in (r.leetcode or [])
                ],
            }
            for r in rows
        ]


@app.get("/api/daily-log")
def daily_log():
    """Public — the curated daily-log entries (checked items + one-line summary)."""
    return _daily_log_entries()


@app.get("/api/daily-log/full", dependencies=[Depends(require_admin)])
def daily_log_full():
    """PRIVATE — the daily log through the authenticated channel. Same curated
    fields today; the full private per-day sections will land here (behind the
    shared secret) once wired. Gated by X-Admin-Secret (fail-closed)."""
    return {"entries": _daily_log_entries()}


# ---------------------------------------------------------------------------
# Daily-log CRUD (P2·S4 pilot). All write endpoints are X-Admin-Secret-gated.
# These make Neon the source of truth so a day can be created / edited / deleted
# from anywhere by API — no local file, no importer. `import_daily_log.py` is
# superseded by POST /bulk. NOTE: /full is declared above so it wins the route
# match over /{date}.
# ---------------------------------------------------------------------------


def _serialize_daily(row: DailyLog) -> dict:
    """The stored row as-is (round-trips with PUT); reads that enrich LeetCode
    solution links stay in _daily_log_entries()."""
    return {
        "date": row.date,
        "week": row.week,
        "done": row.done or [],
        "summary": row.summary,
        "note": row.note,
        "leetcode": row.leetcode or [],
    }


def _apply_full(row: DailyLog, body: DailyLogIn) -> None:
    row.week = body.week
    row.done = body.done
    row.summary = body.summary
    row.note = body.note
    row.leetcode = body.leetcode


@app.get("/api/daily-log/{date}", dependencies=[Depends(require_admin)])
def daily_log_get(date: str):
    """PRIVATE — one day's raw stored row (for editing)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(DailyLog, date)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        return _serialize_daily(row)


@app.put("/api/daily-log/{date}", dependencies=[Depends(require_admin)])
def daily_log_put(date: str, body: DailyLogIn):
    """PRIVATE — create-or-replace the whole day (upsert)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(DailyLog, date)
        created = row is None
        if created:
            row = DailyLog(date=date)
            session.add(row)
        _apply_full(row, body)
        session.commit()
        session.refresh(row)
        return {"created": created, **_serialize_daily(row)}


@app.patch("/api/daily-log/{date}", dependencies=[Depends(require_admin)])
def daily_log_patch(date: str, body: DailyLogPatch):
    """PRIVATE — update only the fields sent (404 if the day doesn't exist)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(DailyLog, date)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        for key, value in body.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        session.commit()
        session.refresh(row)
        return _serialize_daily(row)


@app.delete("/api/daily-log/{date}", dependencies=[Depends(require_admin)])
def daily_log_delete(date: str):
    """PRIVATE — delete one day (404 if it doesn't exist)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(DailyLog, date)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        session.delete(row)
        session.commit()
        return {"deleted": date}


@app.post("/api/daily-log/bulk", dependencies=[Depends(require_admin)])
def daily_log_bulk(entries: list[DailyLogFull]):
    """PRIVATE — upsert a whole array in one call. Replaces import_daily_log.py."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        for entry in entries:
            row = session.get(DailyLog, entry.date)
            if row is None:
                row = DailyLog(date=entry.date)
                session.add(row)
            _apply_full(row, entry)
        session.commit()
        return {"upserted": len(entries)}
