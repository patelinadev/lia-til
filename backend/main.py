"""lia-til API — FastAPI backend (Phase 2 · S1).

Public endpoints only. The applications table holds full private data, but this
service exposes ONLY aggregate counts (no company names, roles, salaries).
Private full views come later behind auth (S2).
"""

import os
import re
from contextlib import asynccontextmanager
from datetime import date as date_type, datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, text

from db import Base, SessionLocal, engine
from models import (
    Application,
    ApplicationStatusHistory,
    Company,
    DailyLog,
    LeetcodeProblem,
    Resume,
    SDDeck,
    ShadowHistory,
    SiteMeta,
    StudyNote,
    ToApply,
)

LEETCODE_TRACK = "0x3f Basic Algorithms"
LEETCODE_TRACK_URL = "https://space.bilibili.com/206214/channel/collectiondetail?sid=842776"

# Shared secret for the private endpoints. The site's server (never the browser)
# sends it after it has verified the admin's session. Set BACKEND_SECRET on Render.
ADMIN_SECRET = os.environ.get("BACKEND_SECRET")
# Scoped write token — authorizes ONLY the daily-log + index routes, nothing else.
# Meant for a less-trusted env (cloud chat / a scheduled task) so it can do daily-log
# CRUD from any device without holding the master secret (which also unlocks the full
# applications ledger, résumés, and deletes). Optional; unset → only the master works.
DAILYLOG_SECRET = os.environ.get("DAILYLOG_SECRET")
# URL-embedded token gating the mounted MCP server (phone / Cowork custom connector).
# The MCP endpoint lives under /mcp/<MCP_TOKEN>/ — knowing that full path IS the auth
# (Option 1 / MVP); a wrong or absent token just 404s. Unset → the MCP server is not
# mounted at all. Keep it long + random (secrets.token_urlsafe(32)); NEVER commit it —
# set it in Render's env, same as the other secrets. Upgrade path (Option 2): replace
# this URL token with OAuth / a header check later, tools unchanged.
MCP_TOKEN = os.environ.get("MCP_TOKEN")
# Built at the bottom of the file (if fastmcp is installed AND MCP_TOKEN is set); the
# lifespan below starts/stops its Streamable-HTTP session manager alongside the app.
_MCP_APP = None


def require_admin(x_admin_secret: Optional[str] = Header(default=None)) -> None:
    """Gate a private endpoint: reject unless the shared secret matches. If the
    secret isn't configured at all, the private endpoints stay closed. This is the
    FULL-power gate (applications ledger, résumés, deletes) — master secret only."""
    if not ADMIN_SECRET or x_admin_secret != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")


def require_daily_writer(x_admin_secret: Optional[str] = Header(default=None)) -> None:
    """Gate for the daily-log + index routes only. Accepts the master BACKEND_SECRET
    OR the scoped DAILYLOG_SECRET. Lets a cloud/phone chat session log the day (CRUD
    on daily_logs + index) with a token whose blast radius is just the daily log —
    it can't touch applications, résumés, or delete other tables."""
    ok_master = bool(ADMIN_SECRET) and x_admin_secret == ADMIN_SECRET
    ok_scoped = bool(DAILYLOG_SECRET) and x_admin_secret == DAILYLOG_SECRET
    if not (ok_master or ok_scoped):
        raise HTTPException(status_code=401, detail="unauthorized")


# ---- Write schemas (P2·S4 CRUD). Pydantic validates the body → 422 on bad shape.
class DailyLogIn(BaseModel):
    """Full body for creating/replacing one day (the `date` is the URL path).
    `sections` is the full faithful vault record ({heading -> content}) — PRIVATE,
    served only on /full; the public endpoint never returns it."""
    week: Optional[str] = None
    done: list[str] = Field(default_factory=list)
    summary: Optional[str] = None
    note: Optional[str] = None
    leetcode: list[dict] = Field(default_factory=list)
    sections: Optional[dict] = None
    tags: list[str] = Field(default_factory=list)


class DailyLogPatch(BaseModel):
    """Partial update — every field optional; only the ones sent are applied."""
    week: Optional[str] = None
    done: Optional[list[str]] = None
    summary: Optional[str] = None
    note: Optional[str] = None
    leetcode: Optional[list[dict]] = None
    sections: Optional[dict] = None
    tags: Optional[list[str]] = None


class DailyLogFull(DailyLogIn):
    """One entry for the bulk endpoint — carries its own `date`."""
    date: str


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Ensure the table exists so /summary never errors before the first import.
    if engine is not None:
        Base.metadata.create_all(engine)
        # Lightweight migration: create_all never ALTERs an existing table, so add
        # the daily_logs.sections column if it's missing. Idempotent; best-effort
        # (a fresh SQLite table already has it, so the ALTER is skipped/ignored).
        for col in ("sections JSON", "tags JSON"):
            try:
                with engine.begin() as conn:
                    conn.execute(text(f"ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS {col}"))
            except Exception:
                pass
        # applications.last_update — added after the table already existed in prod.
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS last_update DATE"))
        except Exception:
            pass
        # Phase 1 (DB as source of truth, D8): applications.company_id → companies.id.
        # create_all created the new `companies` table above but never ALTERs the
        # existing applications table, so add the column + FK constraint here.
        # Both idempotent; the DO block guards the constraint by name.
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS company_id INTEGER"))
        except Exception:
            pass
        try:
            with engine.begin() as conn:
                conn.execute(
                    text(
                        "DO $$ BEGIN "
                        "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_company_id_fkey') THEN "
                        "ALTER TABLE applications ADD CONSTRAINT applications_company_id_fkey "
                        "FOREIGN KEY (company_id) REFERENCES companies(id); "
                        "END IF; END $$;"
                    )
                )
        except Exception:
            pass
        # applications.apply_url — R8 hard identifier for dedup (Phase 3).
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE applications ADD COLUMN IF NOT EXISTS apply_url TEXT"))
        except Exception:
            pass
        # to_apply.backup — reserve rows; the table already exists in prod.
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE to_apply ADD COLUMN IF NOT EXISTS backup BOOLEAN NOT NULL DEFAULT false"))
        except Exception:
            pass
    # Starlette does NOT auto-run a mounted sub-app's lifespan, so when the MCP
    # server is mounted (bottom of file), nest its lifespan inside ours to start
    # and stop its Streamable-HTTP session manager with the app.
    if _MCP_APP is not None:
        async with _MCP_APP.lifespan(_app):
            yield
    else:
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
                "lastUpdate": r.last_update.isoformat() if r.last_update else None,
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


_LC = re.compile(r"\blc\s*\d+", re.I)


def _section_has_content(md) -> bool:
    for raw in (md or "").split("\n"):
        line = raw.strip()
        if not line or re.match(r"^#{1,6}\s", line):
            continue
        s = re.sub(r"^[-*]\s*\[[ xX]\]\s*", "", line)
        s = re.sub(r"^[-*]\s+", "", s)
        if s.strip() and s.strip() != "-":
            return True
    return False


def _signal_text(sections: dict) -> str:
    """Text that reflects what the day ACTUALLY did: completed `- [x]` items from
    anywhere, plus the prose of substantive (non-SOP-plan) sections. Excludes
    un-done template todos so a standing task like '出 1 条简历 bullet' doesn't
    tag every day."""
    parts = []
    for k, v in sections.items():
        if k == "_preamble" or not _section_has_content(v):
            continue
        is_plan = "SOP" in k or "To-Do" in k or "To-do" in k or k.strip().startswith("今日")
        for line in (v or "").split("\n"):
            lt = line.strip()
            cb = re.match(r"^[-*]\s*\[([ xX])\]\s*(.*)$", lt)
            if cb:
                if cb.group(1).lower() == "x":  # completed only
                    parts.append(cb.group(2))
            elif not is_plan:
                parts.append(lt)
    return " ".join(parts)


def _auto_tags(sections: Optional[dict]) -> list[str]:
    """Rule-based tier-1 tags. Section-presence tags come from a section actually
    having content; content-signal tags read only _signal_text (done work +
    substantive notes), so un-done template todos don't over-tag."""
    if not sections:
        return []
    tags = set()
    for k, v in sections.items():
        if k == "_preamble" or not _section_has_content(v):
            continue
        kl = k.lower()
        if "interview" in kl:
            tags.add("interview")
        if "oral english" in kl or "口语" in k:
            tags.add("oral-english")
        if "success diary" in kl or "日记" in k:
            tags.add("mindset")
        if "```" in (v or ""):
            tags.add("code")
    # LC / SD / PhD are day-SPECIFIC focuses, so a *planned* task counts → read
    # all non-empty content (loose).
    content = " ".join(v for k, v in sections.items() if k != "_preamble" and _section_has_content(v))
    cl = content.lower()
    if _LC.search(content) or "leetcode" in cl or "0x3f" in cl or any(
        x in content for x in ("刷题", "滑动窗口", "双指针", "哈希表", "二分", "回溯", "动态规划", "链表", "单调栈")
    ):
        tags.add("leetcode")
    if "system design" in cl or "系统设计" in content or "dns" in cl or "rate limit" in cl or any(
        x in content for x in ("负载均衡", "一致性哈希", "限流", "缓存层")
    ):
        tags.add("system-design")
    if "择导" in content or "advisor" in cl or "faculty" in cl or "导师" in content or "博士" in content or re.search(r"\bph\.?d", cl):
        tags.add("phd-application")
    # resume-recruit's signals (出简历bullet / 投递) are STANDING every-day template
    # todos, so read only done work + prose (tight) to avoid tagging every day.
    sig = _signal_text(sections)
    sl = sig.lower()
    if any(x in sig for x in ("简历", "投递", "投简历")) or "resume" in sl or "bullet" in sl or "recruit" in sl or re.search(r"\bcv\b", sl):
        tags.add("resume-recruit")
    return sorted(tags)


def _tags_for(row: DailyLog) -> list[str]:
    """Manual tags + rule-based auto tags, de-duplicated & sorted. Served on both
    public and private (tags are topic labels, never the private content).

    Manual tags are English-only: any non-ASCII (e.g. Chinese) manual tag is dropped
    so it can never reach the PUBLIC tag set — public content is mandatory English and
    the tag vocabulary is English kebab-case. This guards against any writer (e.g. the
    application-sync side) storing a stray Chinese tag like "投递". `_auto_tags` already
    only ever emits English labels, so this filter applies only to the manual `row.tags`."""
    manual = [t for t in (row.tags or []) if t and t.isascii()]
    return sorted(set(manual + _auto_tags(row.sections)))


def _daily_log_entries(include_sections: bool = False):
    """Daily-log entries newest-first, LeetCode items enriched with their solution
    URL from the leetcode table (single source). `include_sections` adds the full
    private `sections` — ONLY ever True for the gated /full endpoint; the public
    endpoint must never pass it, so private sections can't leak."""
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
        out = []
        for r in rows:
            entry = {
                "date": r.date,
                "week": r.week,
                "done": r.done or [],
                "summary": r.summary,
                "note": r.note,
                "tags": _tags_for(r),
                "leetcode": [
                    {**item, "solutionUrl": sol.get(item.get("id"))} for item in (r.leetcode or [])
                ],
            }
            if include_sections:
                # private: every day, with its full sections
                entry["sections"] = r.sections or {}
                out.append(entry)
            elif r.done or r.summary or r.note or r.leetcode:
                # public: only days that have curated public content — a day that
                # holds only private `sections` (not yet curated) stays hidden.
                out.append(entry)
        return out


@app.get("/api/daily-log")
def daily_log():
    """Public — curated fields only (checked items + one-line summary + LeetCode).
    Never returns `sections`, so the private per-day content can't leak."""
    return _daily_log_entries()


@app.get("/api/daily-log/full", dependencies=[Depends(require_daily_writer)])
def daily_log_full():
    """PRIVATE — the full daily log through the authenticated channel, INCLUDING
    the private `sections` (Success Diary / interview / advisor / companies).
    Gated by X-Admin-Secret (fail-closed)."""
    return {"entries": _daily_log_entries(include_sections=True)}


# ---------------------------------------------------------------------------
# Daily-log CRUD (P2·S4 pilot). All write endpoints are X-Admin-Secret-gated.
# These make Neon the source of truth so a day can be created / edited / deleted
# from anywhere by API — no local file, no importer. `import_daily_log.py` is
# superseded by POST /bulk. NOTE: /full is declared above so it wins the route
# match over /{date}.
# ---------------------------------------------------------------------------


def _serialize_daily(row: DailyLog) -> dict:
    """The stored row as-is, INCLUDING sections (this serializer backs the gated
    write/read endpoints only — never the public one). Round-trips with PUT."""
    return {
        "date": row.date,
        "week": row.week,
        "done": row.done or [],
        "summary": row.summary,
        "note": row.note,
        "leetcode": row.leetcode or [],
        "sections": row.sections or {},
        "tags": _tags_for(row),
    }


def _apply_full(row: DailyLog, body: DailyLogIn) -> None:
    row.week = body.week
    row.done = body.done
    row.summary = body.summary
    row.note = body.note
    row.leetcode = body.leetcode
    row.sections = body.sections
    row.tags = body.tags


def _shadow(session, kind: str, key: str, op: str, snapshot) -> None:
    """Append an immutable backup snapshot for a scoped-key-writable change. Added
    to the same transaction as the write, so the backup commits atomically with it.
    The scoped key can trigger this (via a normal write) but can never read/alter/
    delete shadow_history — so the audit trail is safe even from a leaked scoped key."""
    session.add(
        ShadowHistory(
            kind=kind,
            key=key,
            op=op,
            snapshot=snapshot,
            at=datetime.now(timezone.utc).isoformat(),
        )
    )


@app.get("/api/daily-log/{date}", dependencies=[Depends(require_daily_writer)])
def daily_log_get(date: str):
    """PRIVATE — one day's raw stored row (for editing)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(DailyLog, date)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        return _serialize_daily(row)


@app.put("/api/daily-log/{date}", dependencies=[Depends(require_daily_writer)])
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
        _shadow(session, "daily_log", date, "put", _serialize_daily(row))
        session.commit()
        session.refresh(row)
        return {"created": created, **_serialize_daily(row)}


@app.patch("/api/daily-log/{date}", dependencies=[Depends(require_daily_writer)])
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
        _shadow(session, "daily_log", date, "patch", _serialize_daily(row))
        session.commit()
        session.refresh(row)
        return _serialize_daily(row)


@app.delete("/api/daily-log/{date}", dependencies=[Depends(require_daily_writer)])
def daily_log_delete(date: str):
    """PRIVATE — delete one day (404 if it doesn't exist)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(DailyLog, date)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        # snapshot the FULL day before deleting, so a delete is fully recoverable
        _shadow(session, "daily_log", date, "delete", _serialize_daily(row))
        session.delete(row)
        session.commit()
        return {"deleted": date}


@app.post("/api/daily-log/bulk", dependencies=[Depends(require_daily_writer)])
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
            _shadow(session, "daily_log", entry.date, "put", _serialize_daily(row))
        session.commit()
        return {"upserted": len(entries)}


# ===========================================================================
# INDEX / TL;DR navigator (P2·S5). A single private markdown document — the
# rolling "table of contents" for fast recall. Stored in site_meta under
# key='index'. PRIVATE — both read and write are X-Admin-Secret-gated; it is
# never exposed on any public endpoint.
# ===========================================================================
INDEX_KEY = "index"


class IndexBody(BaseModel):
    value: str  # markdown


@app.get("/api/index", dependencies=[Depends(require_daily_writer)])
def index_get():
    """PRIVATE — the INDEX/TL;DR markdown (empty string if never written)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(SiteMeta, INDEX_KEY)
        if row is None:
            return {"value": "", "updatedAt": None}
        return {"value": row.value or "", "updatedAt": row.updated_at}


@app.put("/api/index", dependencies=[Depends(require_daily_writer)])
def index_put(body: IndexBody):
    """PRIVATE — replace the whole INDEX/TL;DR document (upsert). Stamps today."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    today = date_type.today().isoformat()
    with SessionLocal() as session:
        row = session.get(SiteMeta, INDEX_KEY)
        created = row is None
        if created:
            row = SiteMeta(key=INDEX_KEY)
            session.add(row)
        row.value = body.value
        row.updated_at = today
        _shadow(session, "index", INDEX_KEY, "put", {"value": row.value, "updatedAt": row.updated_at})
        session.commit()
        return {"created": created, "value": row.value, "updatedAt": row.updated_at}


# A streak week in the INDEX reads "- 2026-W35 (08-24 → 08-30): 1/7"; the
# numerator is that week's successful check-ins. Summing them = days checked in.
_STREAK_WEEK = re.compile(r"^\s*-\s*\d{4}-W\d{2}\b[^:]*:\s*(\d+)\s*/\s*\d+\s*$", re.M)


def _checkin_days() -> int:
    """Total days successfully checked in — the sum of the streak-week numerators
    in the INDEX. The streak (with its human judgement) is the source of truth;
    a day can have a note without being a check-in, so this is < the day count."""
    if SessionLocal is None:
        return 0
    with SessionLocal() as session:
        row = session.get(SiteMeta, INDEX_KEY)
        if not row or not row.value:
            return 0
        return sum(int(m.group(1)) for m in _STREAK_WEEK.finditer(row.value))


@app.get("/api/checkins")
def checkins():
    """Public — just the streak total (days checked in). Only this aggregate
    integer is exposed; the private INDEX text is never returned on this route."""
    return {"days": _checkin_days()}


# ===========================================================================
# Applications CRUD (P2·S4). PK = app_num (int). Write bodies use the same
# camelCase field names the reads return (appNum / appliedDate), so what you
# GET is what you PUT. All writes are X-Admin-Secret-gated. /summary and /full
# are declared above so they win the route match over /{app_num:int}.
# ===========================================================================
class ApplicationBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    company: Optional[str] = None
    role: Optional[str] = None
    resume: Optional[str] = None
    applied_date: Optional[date_type] = Field(default=None, alias="appliedDate")
    last_update: Optional[date_type] = Field(default=None, alias="lastUpdate")
    status: Optional[str] = None
    notes: Optional[str] = None


class ApplicationPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    # who is writing — recorded on the history row when `status` changes
    source: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    resume: Optional[str] = None
    applied_date: Optional[date_type] = Field(default=None, alias="appliedDate")
    last_update: Optional[date_type] = Field(default=None, alias="lastUpdate")
    status: Optional[str] = None
    notes: Optional[str] = None


class ApplicationFull(ApplicationBody):
    app_num: int = Field(alias="appNum")


def _serialize_app(r: Application) -> dict:
    return {
        "appNum": r.app_num,
        "company": r.company,
        "role": r.role,
        "resume": r.resume,
        "appliedDate": r.applied_date.isoformat() if r.applied_date else None,
        "lastUpdate": r.last_update.isoformat() if r.last_update else None,
        "status": r.status,
        "notes": r.notes,
        "companyId": r.company_id,
        "applyUrl": r.apply_url,
    }


def _apply_app(row: Application, body) -> None:
    row.company = body.company
    row.role = body.role
    row.resume = body.resume
    row.applied_date = body.applied_date
    row.last_update = body.last_update
    row.status = body.status
    row.notes = body.notes


@app.get("/api/applications/{app_num}", dependencies=[Depends(require_admin)])
def application_get(app_num: int):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Application, app_num)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        return _serialize_app(row)


@app.put("/api/applications/{app_num}", dependencies=[Depends(require_admin)])
def application_put(app_num: int, body: ApplicationBody):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Application, app_num)
        if row is None:
            # The caller never picks an App# — that is how 256/257 got used twice.
            raise HTTPException(
                status_code=409,
                detail="PUT updates an existing application only; create with POST /api/applications (the API assigns the App#)",
            )
        new_status = body.status
        body_no_status = body.model_copy(update={"status": row.status})
        _apply_app(row, body_no_status)
        if new_status is not None:
            _record_status(session, row, new_status, "api", None)
            if body.last_update is not None:
                row.last_update = body.last_update  # an explicit date wins over "today"
        _shadow(session, "application", str(app_num), "put", _serialize_app(row))
        session.commit()
        session.refresh(row)
        return {"created": False, **_serialize_app(row)}


@app.patch("/api/applications/{app_num}", dependencies=[Depends(require_admin)])
def application_patch(app_num: int, body: ApplicationPatch):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Application, app_num)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        data = body.model_dump(exclude_unset=True)
        source = data.pop("source", None) or "api"
        new_status = data.pop("status", None)
        # A status change ALWAYS goes through the timeline (D6) — whichever client
        # sends it and whichever route it uses, there is no way to skip the history row.
        if new_status is not None:
            _record_status(session, row, new_status, source, None)
        for key, value in data.items():  # explicit fields (incl. lastUpdate) win
            setattr(row, key, value)
        _shadow(session, "application", str(app_num), "patch", _serialize_app(row))
        session.commit()
        session.refresh(row)
        return _serialize_app(row)


@app.delete("/api/applications/{app_num}", dependencies=[Depends(require_admin)])
def application_delete(app_num: int):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Application, app_num)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        # snapshot the FULL row before deleting, so a delete is fully recoverable
        _shadow(session, "application", str(app_num), "delete", _serialize_app(row))
        session.delete(row)
        session.commit()
        return {"deleted": app_num}


@app.post("/api/applications/bulk", dependencies=[Depends(require_admin)])
def application_bulk(entries: list[ApplicationFull]):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        for entry in entries:
            row = session.get(Application, entry.app_num)
            if row is None:
                row = Application(app_num=entry.app_num)
                session.add(row)
            _apply_app(row, entry)
            _shadow(session, "application", str(entry.app_num), "put", _serialize_app(row))
        session.commit()
        return {"upserted": len(entries)}


# ===========================================================================
# Phase 3 — the API is the only counter (DB as source of truth).
#   POST  /api/applications                → T8: create; assigns the next App#
#   PATCH /api/applications/{n}/status     → T9: status change + history row
#   GET/PUT /api/to_apply, PATCH /{id}     → T10: today's On Deck queue
# Rules baked in here so no client can break them: App# is assigned atomically
# inside the transaction (never by the caller); duplicates are judged ONLY by
# the hard identifier apply_url (R8); every status change writes ONE
# application_status_history row in the SAME transaction (D6); "Last Update"
# is derived from that history (the legacy last_update column is kept in sync
# only until the website reads history directly).
# ===========================================================================
VALID_TO_APPLY_STATUS = {"queued", "applied", "skipped"}


def _find_or_create_company(session, name: Optional[str], domain: Optional[str]) -> Optional[Company]:
    """The company's identity (D8). Match by `domain` when given (the stable key),
    else by case-insensitive exact name; create when nothing matches. `name` is
    only a label — two different "Clark"s stay apart because their domains differ."""
    name = (name or "").strip()
    domain = (domain or "").strip().lower() or None
    if not name and not domain:
        return None
    row = None
    if domain:
        row = session.execute(select(Company).where(Company.domain == domain)).scalar_one_or_none()
    if row is None and name:
        row = session.execute(
            select(Company).where(func.lower(Company.name) == name.lower(), Company.domain.is_(None))
        ).scalar_one_or_none()
        if row is None and not domain:
            row = session.execute(select(Company).where(func.lower(Company.name) == name.lower())).scalar_one_or_none()
    if row is None:
        row = Company(name=name or domain, domain=domain)
        session.add(row)
        session.flush()
    elif domain and row.domain is None:
        row.domain = domain  # learned the stable key for a name-only row
    return row


def _cap_warning(session, company: Optional[Company], today: date_type) -> Optional[str]:
    """Per-company application cap (e.g. Ramp = 2 per 60 days). Warns, never blocks —
    the operator decides (R8)."""
    if company is None or not company.application_cap or not company.cap_window_days:
        return None
    since = today - timedelta(days=company.cap_window_days)
    n = session.execute(
        select(func.count()).select_from(Application).where(
            Application.company_id == company.id, Application.applied_date >= since
        )
    ).scalar_one()
    if n >= company.application_cap:
        return (
            f"cap: {company.name} allows {company.application_cap} applications per "
            f"{company.cap_window_days} days and already has {n} since {since.isoformat()}"
        )
    return None


def _next_app_num(session) -> int:
    """Gap-free App# assigned INSIDE the transaction (R6). On Postgres the table is
    locked for the duration so two concurrent creates can never pick the same
    number; SQLite (tests) has no LOCK TABLE and is single-writer anyway."""
    if session.bind.dialect.name == "postgresql":
        session.execute(text("LOCK TABLE applications IN SHARE ROW EXCLUSIVE MODE"))
    current = session.execute(select(func.max(Application.app_num))).scalar_one()
    return (current or 0) + 1


def _record_status(session, row: Application, new_status: str, source: str, note: Optional[str]) -> bool:
    """Change an application's status and append ONE history row, same transaction
    (D6). Returns False (no history row) when the status is unchanged."""
    new_status = (new_status or "").strip()
    if not new_status:
        raise HTTPException(status_code=422, detail="status required")
    if (row.status or "") == new_status:
        return False
    session.add(
        ApplicationStatusHistory(
            app_num=row.app_num,
            old_status=row.status,
            new_status=new_status,
            source=source,
            note=note,
        )
    )
    row.status = new_status
    row.last_update = date_type.today()  # legacy column, kept in sync until readers use history
    return True


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    company: Optional[str] = None
    domain: Optional[str] = None
    role: Optional[str] = None
    resume: Optional[str] = None
    applied_date: Optional[date_type] = Field(default=None, alias="appliedDate")
    status: str = "Applied"
    notes: Optional[str] = None
    apply_url: Optional[str] = Field(default=None, alias="applyUrl")
    source: str = "desktop-claude"
    # Promote a row from today's On Deck queue: fills company/role/url/resume from it
    # and marks that queue row applied — all in this one transaction.
    to_apply_id: Optional[int] = Field(default=None, alias="toApplyId")


class ApplicationStatusIn(BaseModel):
    status: str
    source: str = "desktop-claude"
    note: Optional[str] = None


def _create_application(body: ApplicationCreate) -> dict:
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    today = date_type.today()
    with SessionLocal() as session:
        queue_row = None
        company_name, domain = body.company, body.domain
        role, resume, apply_url, notes = body.role, body.resume, body.apply_url, body.notes
        if body.to_apply_id is not None:
            queue_row = session.get(ToApply, body.to_apply_id)
            if queue_row is None:
                raise HTTPException(status_code=404, detail="to_apply row not found")
            if queue_row.company_id is not None and not company_name:
                c = session.get(Company, queue_row.company_id)
                if c is not None:
                    company_name, domain = c.name, c.domain
            role = role or queue_row.role
            resume = resume or queue_row.resume
            apply_url = apply_url or queue_row.apply_url
            notes = notes if notes is not None else queue_row.note
        apply_url = (apply_url or "").strip() or None
        if not role:
            raise HTTPException(status_code=422, detail="role required")
        # R8: a duplicate is ONLY a matching hard identifier.
        if apply_url:
            dup = session.execute(select(Application).where(Application.apply_url == apply_url)).scalar_one_or_none()
            if dup is not None:
                raise HTTPException(
                    status_code=409,
                    detail={"error": "duplicate", "existingAppNum": dup.app_num, "applyUrl": apply_url},
                )
        company = _find_or_create_company(session, company_name, domain)
        warnings = []
        w = _cap_warning(session, company, today)
        if w:
            warnings.append(w)
        row = Application(
            app_num=_next_app_num(session),
            company=(company.name if company else company_name),  # legacy text, kept until Phase 5
            company_id=(company.id if company else None),
            role=role,
            resume=resume,
            applied_date=body.applied_date or today,
            last_update=body.applied_date or today,
            status=body.status,
            notes=notes,
            apply_url=apply_url,
        )
        session.add(row)
        session.flush()
        session.add(
            ApplicationStatusHistory(
                app_num=row.app_num, old_status=None, new_status=row.status, source=body.source, note=None
            )
        )
        if queue_row is not None:
            queue_row.status = "applied"
        _shadow(session, "application", str(row.app_num), "put", _serialize_app(row))
        session.commit()
        session.refresh(row)
        return {"created": True, "warnings": warnings, **_serialize_app(row)}


@app.post("/api/applications", dependencies=[Depends(require_admin)])
def application_create(body: ApplicationCreate):
    """T8 — the ONLY way a new application (and its App#) comes into existence."""
    return _create_application(body)


def _set_status_core(app_num: int, status: str, source: str, note: Optional[str], replace_notes: Optional[str] = None) -> dict:
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Application, app_num)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        changed = _record_status(session, row, status, source, note)
        if replace_notes is not None:
            row.notes = replace_notes
        _shadow(session, "application", str(app_num), "patch", _serialize_app(row))
        session.commit()
        session.refresh(row)
        return {"changed": changed, **_serialize_app(row)}


@app.patch("/api/applications/{app_num}/status", dependencies=[Depends(require_admin)])
def application_set_status(app_num: int, body: ApplicationStatusIn):
    """T9 — status change + ONE history row, same transaction. Any client may call
    this (desktop / phone / website); `source` says which."""
    return _set_status_core(app_num, body.status, body.source, body.note)


@app.get("/api/applications/{app_num}/history", dependencies=[Depends(require_admin)])
def application_history(app_num: int):
    """The status timeline for one application, oldest first. "Last Update" =
    the last row's changedAt."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        rows = session.execute(
            select(ApplicationStatusHistory)
            .where(ApplicationStatusHistory.app_num == app_num)
            .order_by(ApplicationStatusHistory.changed_at, ApplicationStatusHistory.id)
        ).scalars().all()
        return [
            {
                "id": h.id,
                "appNum": h.app_num,
                "oldStatus": h.old_status,
                "newStatus": h.new_status,
                "changedAt": h.changed_at.isoformat() if h.changed_at else None,
                "source": h.source,
                "note": h.note,
            }
            for h in rows
        ]


# ----- T10: to_apply (today's On Deck queue) -----
class ToApplyRowIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    company: str
    domain: Optional[str] = None
    role: str
    location: Optional[str] = None
    apply_url: str = Field(alias="applyUrl")
    resume: Optional[str] = None
    note: Optional[str] = None
    reach: bool = False
    fresh: bool = False
    backup: bool = False


class ToApplyPut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    queue_date: date_type = Field(alias="queueDate")
    rows: list[ToApplyRowIn]


class ToApplyPatch(BaseModel):
    status: Optional[str] = None
    note: Optional[str] = None


def _serialize_to_apply(r: ToApply, company_name: Optional[str]) -> dict:
    return {
        "id": r.id,
        "queueDate": r.queue_date.isoformat() if r.queue_date else None,
        "company": company_name,
        "companyId": r.company_id,
        "role": r.role,
        "location": r.location,
        "applyUrl": r.apply_url,
        "resume": r.resume,
        "note": r.note,
        "reach": bool(r.reach),
        "fresh": bool(r.fresh),
        "backup": bool(r.backup),
        "status": r.status,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }


@app.get("/api/to_apply", dependencies=[Depends(require_daily_writer)])
def to_apply_get(date: Optional[str] = None):
    """Today's queue (or the newest queue day when `date` is omitted — if the
    sourcing run hasn't happened yet you get yesterday's, labelled by queueDate).
    Scoped-key readable so Bridge never needs the master secret."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        if date:
            try:
                qd = date_type.fromisoformat(date)
            except ValueError:
                raise HTTPException(status_code=422, detail="date must be YYYY-MM-DD")
        else:
            qd = session.execute(select(func.max(ToApply.queue_date))).scalar_one()
        if qd is None:
            return {"queueDate": None, "rows": []}
        rows = session.execute(
            select(ToApply, Company.name)
            .outerjoin(Company, ToApply.company_id == Company.id)
            .where(ToApply.queue_date == qd)
            .order_by(ToApply.id)
        ).all()
        return {"queueDate": qd.isoformat(), "rows": [_serialize_to_apply(r, name) for r, name in rows]}


@app.put("/api/to_apply", dependencies=[Depends(require_admin)])
def to_apply_put(body: ToApplyPut):
    """The sourcing run writes the day's queue. Upsert by (queueDate, applyUrl):
    existing rows keep their STATUS (a tick made in Bridge survives a re-run);
    queued rows absent from the payload are deleted (the job closed); rows already
    applied/skipped are never deleted."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        seen, inserted, updated = set(), 0, 0
        for r in body.rows:
            url = r.apply_url.strip()
            if not url or url in seen:
                continue
            seen.add(url)
            company = _find_or_create_company(session, r.company, r.domain)
            row = session.execute(
                select(ToApply).where(ToApply.queue_date == body.queue_date, ToApply.apply_url == url)
            ).scalar_one_or_none()
            if row is None:
                row = ToApply(queue_date=body.queue_date, apply_url=url, status="queued")
                session.add(row)
                inserted += 1
            else:
                updated += 1
            row.company_id = company.id if company else None
            row.role, row.location, row.resume = r.role, r.location, r.resume
            row.note, row.reach, row.fresh, row.backup = r.note, r.reach, r.fresh, r.backup
        stale = session.execute(
            select(ToApply).where(ToApply.queue_date == body.queue_date, ToApply.status == "queued")
        ).scalars().all()
        deleted = 0
        for row in stale:
            if row.apply_url not in seen:
                session.delete(row)
                deleted += 1
        session.commit()
        return {"queueDate": body.queue_date.isoformat(), "inserted": inserted, "updated": updated, "deleted": deleted}


@app.patch("/api/to_apply/{row_id}", dependencies=[Depends(require_daily_writer)])
def to_apply_patch(row_id: int, body: ToApplyPatch):
    """Bridge tick: queued → applied / skipped (or back). Does NOT mint an App# —
    only POST /api/applications does (single-writer rule); pass toApplyId there to
    promote the row. Scoped write → shadowed like every other scoped write."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(ToApply, row_id)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        if body.status is not None:
            if body.status not in VALID_TO_APPLY_STATUS:
                raise HTTPException(status_code=422, detail=f"status must be one of {sorted(VALID_TO_APPLY_STATUS)}")
            row.status = body.status
        if body.note is not None:
            row.note = body.note
        name = session.get(Company, row.company_id).name if row.company_id else None
        snap = _serialize_to_apply(row, name)
        _shadow(session, "to_apply", str(row_id), "patch", snap)
        session.commit()
        session.refresh(row)
        return _serialize_to_apply(row, name)


class ToApplyApplyIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    applied_date: Optional[date_type] = Field(default=None, alias="appliedDate")
    source: str = "bridge"


@app.post("/api/to_apply/{row_id}/apply", dependencies=[Depends(require_daily_writer)])
def to_apply_apply(row_id: int, body: Optional[ToApplyApplyIn] = None):
    """D10 — one click in Bridge: promote THIS queue row into an application. The
    API mints the App#, copies company/role/url/resume from the row, writes the
    first history row and marks the row applied, all in one transaction. Scoped
    key on purpose: it can only turn an existing queue row into an application,
    never create an arbitrary one. A second click is a 409 with existingAppNum
    (dedup on apply_url), so it is safe to retry."""
    body = body or ToApplyApplyIn()
    return _create_application(
        ApplicationCreate(toApplyId=row_id, appliedDate=body.applied_date, source=body.source)
    )


# ---------------------------------------------------------------------------
# One-shot Phase 2 backfill (migration day). Idempotent — safe to re-run; a
# dryRun reports what WOULD change and commits nothing. Remove after cutover.
# ---------------------------------------------------------------------------
class MigratePhase2In(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    dry_run: bool = Field(default=True, alias="dryRun")
    # legacy company string -> canonical company name (e.g. "Amazon (Annapurna Labs)" -> "Amazon")
    company_aliases: dict[str, str] = Field(default_factory=dict, alias="companyAliases")
    # app_num -> exact posting URL, only where it is known for certain
    apply_urls: dict[int, str] = Field(default_factory=dict, alias="applyUrls")


@app.post("/api/admin/migrate/phase2", dependencies=[Depends(require_admin)])
def migrate_phase2(body: MigratePhase2In):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")

    def _noon(d):  # midday UTC so the calendar date survives any timezone
        return datetime(d.year, d.month, d.day, 12, 0, tzinfo=timezone.utc) if d else None

    with SessionLocal() as session:
        apps = session.execute(select(Application).order_by(Application.app_num)).scalars().all()
        have_history = {
            n for (n,) in session.execute(select(ApplicationStatusHistory.app_num).distinct()).all()
        }
        companies_before = session.execute(select(func.count()).select_from(Company)).scalar_one()
        linked = urls = seeded_apps = history_rows = 0
        for a in apps:
            if a.company_id is None and (a.company or "").strip():
                canonical = body.company_aliases.get(a.company, a.company)
                c = _find_or_create_company(session, canonical, None)
                a.company_id = c.id
                linked += 1
            url = (body.apply_urls.get(a.app_num) or "").strip()
            if url and not a.apply_url:
                a.apply_url = url
                urls += 1
            if a.app_num not in have_history:
                session.add(ApplicationStatusHistory(
                    app_num=a.app_num, old_status=None, new_status="Applied",
                    changed_at=_noon(a.applied_date) or datetime.now(timezone.utc), source="migration"))
                history_rows += 1
                if (a.status or "Applied") != "Applied":
                    session.add(ApplicationStatusHistory(
                        app_num=a.app_num, old_status="Applied", new_status=a.status,
                        changed_at=_noon(a.last_update or a.applied_date) or datetime.now(timezone.utc),
                        source="migration"))
                    history_rows += 1
                seeded_apps += 1
        session.flush()
        companies_after = session.execute(select(func.count()).select_from(Company)).scalar_one()
        result = {
            "dryRun": body.dry_run,
            "applications": len(apps),
            "linkedToCompany": linked,
            "companiesCreated": companies_after - companies_before,
            "companiesTotal": companies_after,
            "applyUrlsSet": urls,
            "applicationsSeededWithHistory": seeded_apps,
            "historyRowsInserted": history_rows,
            "stillUnlinked": sum(1 for a in apps if a.company_id is None),
        }
        if body.dry_run:
            session.rollback()
        else:
            session.commit()
        return result


# ===========================================================================
# LeetCode CRUD (P2·S4). PK = id (int). `solutionUrl` <-> solution_url alias.
# ===========================================================================
class LeetcodeBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    seq: Optional[int] = None
    slug: Optional[str] = None
    title: Optional[str] = None
    topics: list[str] = Field(default_factory=list)
    ep: Optional[int] = None
    difficulty: Optional[str] = None
    status: Optional[str] = None
    date: Optional[str] = None
    solution_url: Optional[str] = Field(default=None, alias="solutionUrl")


class LeetcodePatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    seq: Optional[int] = None
    slug: Optional[str] = None
    title: Optional[str] = None
    topics: Optional[list[str]] = None
    ep: Optional[int] = None
    difficulty: Optional[str] = None
    status: Optional[str] = None
    date: Optional[str] = None
    solution_url: Optional[str] = Field(default=None, alias="solutionUrl")


class LeetcodeFull(LeetcodeBody):
    id: int


def _serialize_lc(r: LeetcodeProblem) -> dict:
    return {
        "id": r.id,
        "seq": r.seq,
        "slug": r.slug,
        "title": r.title,
        "topics": r.topics or [],
        "ep": r.ep,
        "difficulty": r.difficulty,
        "status": r.status,
        "date": r.date,
        "solutionUrl": r.solution_url,
    }


def _apply_lc(row: LeetcodeProblem, body) -> None:
    row.seq = body.seq
    row.slug = body.slug
    row.title = body.title
    row.topics = body.topics
    row.ep = body.ep
    row.difficulty = body.difficulty
    row.status = body.status
    row.date = body.date
    row.solution_url = body.solution_url


@app.get("/api/leetcode/{problem_id}", dependencies=[Depends(require_admin)])
def leetcode_get(problem_id: int):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(LeetcodeProblem, problem_id)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        return _serialize_lc(row)


@app.put("/api/leetcode/{problem_id}", dependencies=[Depends(require_admin)])
def leetcode_put(problem_id: int, body: LeetcodeBody):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(LeetcodeProblem, problem_id)
        created = row is None
        if created:
            row = LeetcodeProblem(id=problem_id)
            session.add(row)
        _apply_lc(row, body)
        session.commit()
        session.refresh(row)
        return {"created": created, **_serialize_lc(row)}


@app.patch("/api/leetcode/{problem_id}", dependencies=[Depends(require_admin)])
def leetcode_patch(problem_id: int, body: LeetcodePatch):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(LeetcodeProblem, problem_id)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        for key, value in body.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        session.commit()
        session.refresh(row)
        return _serialize_lc(row)


@app.delete("/api/leetcode/{problem_id}", dependencies=[Depends(require_admin)])
def leetcode_delete(problem_id: int):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(LeetcodeProblem, problem_id)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        session.delete(row)
        session.commit()
        return {"deleted": problem_id}


@app.post("/api/leetcode/bulk", dependencies=[Depends(require_admin)])
def leetcode_bulk(entries: list[LeetcodeFull]):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        for entry in entries:
            row = session.get(LeetcodeProblem, entry.id)
            if row is None:
                row = LeetcodeProblem(id=entry.id)
                session.add(row)
            _apply_lc(row, entry)
        session.commit()
        return {"upserted": len(entries)}


# ===========================================================================
# System Design deck CRUD (P2·S4). PK = slug (str). `lastReviewed` alias.
# ===========================================================================
class SDDeckBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    n: Optional[int] = None
    title: Optional[str] = None
    last_reviewed: Optional[str] = Field(default=None, alias="lastReviewed")
    slides: list = Field(default_factory=list)


class SDDeckPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    n: Optional[int] = None
    title: Optional[str] = None
    last_reviewed: Optional[str] = Field(default=None, alias="lastReviewed")
    slides: Optional[list] = None


class SDDeckFull(SDDeckBody):
    slug: str


def _serialize_sd(r: SDDeck) -> dict:
    return {
        "slug": r.slug,
        "n": r.n,
        "title": r.title,
        "lastReviewed": r.last_reviewed,
        "slides": r.slides or [],
    }


def _apply_sd(row: SDDeck, body) -> None:
    row.n = body.n
    row.title = body.title
    row.last_reviewed = body.last_reviewed
    row.slides = body.slides


@app.get("/api/system-design/{slug}", dependencies=[Depends(require_admin)])
def system_design_get(slug: str):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(SDDeck, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        return _serialize_sd(row)


@app.put("/api/system-design/{slug}", dependencies=[Depends(require_admin)])
def system_design_put(slug: str, body: SDDeckBody):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(SDDeck, slug)
        created = row is None
        if created:
            row = SDDeck(slug=slug)
            session.add(row)
        _apply_sd(row, body)
        session.commit()
        session.refresh(row)
        return {"created": created, **_serialize_sd(row)}


@app.patch("/api/system-design/{slug}", dependencies=[Depends(require_admin)])
def system_design_patch(slug: str, body: SDDeckPatch):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(SDDeck, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        for key, value in body.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        session.commit()
        session.refresh(row)
        return _serialize_sd(row)


@app.delete("/api/system-design/{slug}", dependencies=[Depends(require_admin)])
def system_design_delete(slug: str):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(SDDeck, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        session.delete(row)
        session.commit()
        return {"deleted": slug}


@app.post("/api/system-design/bulk", dependencies=[Depends(require_admin)])
def system_design_bulk(entries: list[SDDeckFull]):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        for entry in entries:
            row = session.get(SDDeck, entry.slug)
            if row is None:
                row = SDDeck(slug=entry.slug)
                session.add(row)
            _apply_sd(row, entry)
        session.commit()
        return {"upserted": len(entries)}


# ===========================================================================
# Résumés (P2·S6). PK = slug. TWO privacy tiers:
#   • kind='base'     — the single public master résumé (public /resume page).
#   • kind='tailored' — per-JD résumés, keyed by Resume # (the outputs/NNN). One
#                       résumé is reused across MANY applications, so it has NO
#                       app_num — the link is applications.resume → this slug.
#                       PRIVATE (company names) — only on the gated /full route.
# `GET /api/resume` (public) returns ONLY the base row, so tailored résumés can
# never leak. Bodies are text (markdown/tex); no PDF/binary here (object storage
# deferred). /full is declared before /{slug} so it wins the route match.
# ===========================================================================
class ResumeBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    kind: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    date: Optional[str] = None
    format: Optional[str] = None  # stored in column `fmt`
    body: Optional[str] = None


class ResumePatch(ResumeBody):
    pass


class ResumeFull(ResumeBody):
    slug: str


def _serialize_resume(r: Resume) -> dict:
    return {
        "slug": r.slug,
        "kind": r.kind,
        "company": r.company,
        "role": r.role,
        "date": r.date,
        "format": r.fmt,
        "body": r.body,
    }


def _apply_resume(row: Resume, body) -> None:
    row.kind = body.kind
    row.company = body.company
    row.role = body.role
    row.date = body.date
    row.fmt = body.format
    row.body = body.body


@app.get("/api/resume")
def resume_public():
    """PUBLIC — the base résumé only (kind='base'). Never returns tailored résumés
    (those carry company names). Returns null if no base résumé has been set."""
    if SessionLocal is None:
        return {"resume": None}
    with SessionLocal() as session:
        row = session.get(Resume, "base")
        if row is None or row.kind != "base":
            return {"resume": None}
        return {"resume": _serialize_resume(row)}


@app.get("/api/resume/full", dependencies=[Depends(require_admin)])
def resume_full():
    """PRIVATE — every résumé (base + all tailored), newest tailored first."""
    if SessionLocal is None:
        return {"resumes": []}
    with SessionLocal() as session:
        rows = session.execute(select(Resume)).scalars().all()
        # base first, then tailored by date desc (None dates last), then slug
        rows = sorted(
            rows,
            key=lambda r: (r.kind != "base", r.date is None, r.date or "", r.slug),
            reverse=False,
        )
        return {"resumes": [_serialize_resume(r) for r in rows]}


@app.get("/api/resume/{slug}", dependencies=[Depends(require_admin)])
def resume_get(slug: str):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Resume, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        return _serialize_resume(row)


@app.put("/api/resume/{slug}", dependencies=[Depends(require_admin)])
def resume_put(slug: str, body: ResumeBody):
    """PRIVATE — create-or-replace one résumé (upsert)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Resume, slug)
        created = row is None
        if created:
            row = Resume(slug=slug)
            session.add(row)
        _apply_resume(row, body)
        session.commit()
        session.refresh(row)
        return {"created": created, **_serialize_resume(row)}


@app.patch("/api/resume/{slug}", dependencies=[Depends(require_admin)])
def resume_patch(slug: str, body: ResumePatch):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Resume, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        data = body.model_dump(exclude_unset=True, by_alias=False)
        if "format" in data:
            row.fmt = data.pop("format")
        for key, value in data.items():
            setattr(row, key, value)
        session.commit()
        session.refresh(row)
        return _serialize_resume(row)


@app.delete("/api/resume/{slug}", dependencies=[Depends(require_admin)])
def resume_delete(slug: str):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Resume, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        session.delete(row)
        session.commit()
        return {"deleted": slug}


@app.post("/api/resume/bulk", dependencies=[Depends(require_admin)])
def resume_bulk(entries: list[ResumeFull]):
    """PRIVATE — upsert an array of résumés in one call."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        for entry in entries:
            row = session.get(Resume, entry.slug)
            if row is None:
                row = Resume(slug=entry.slug)
                session.add(row)
            _apply_resume(row, entry)
        session.commit()
        return {"upserted": len(entries)}


# ===========================================================================
# Study notes (P2·S5). PK = slug. Standalone, text-first notes (markdown / HTML
# / mermaid / inline SVG in `body`). PUBLIC educational content like SD decks:
# GET list is public; writes are X-Admin-Secret-gated. `tags` auto-nothing here
# (manual only). /bulk replaces the migration importer.
# ===========================================================================
class StudyNoteBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    title: Optional[str] = None
    topic: Optional[str] = None
    date: Optional[str] = None
    body: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class StudyNotePatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    title: Optional[str] = None
    topic: Optional[str] = None
    date: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[list[str]] = None


class StudyNoteFull(StudyNoteBody):
    slug: str


def _serialize_study_note(r: StudyNote) -> dict:
    return {
        "slug": r.slug,
        "title": r.title,
        "topic": r.topic,
        "date": r.date,
        "body": r.body,
        "tags": r.tags or [],
    }


def _apply_study_note(row: StudyNote, body) -> None:
    row.title = body.title
    row.topic = body.topic
    row.date = body.date
    row.body = body.body
    row.tags = body.tags


@app.get("/api/study-notes")
def study_notes():
    """PUBLIC — all study notes, newest first (by date, then slug)."""
    if SessionLocal is None:
        return {"notes": []}
    with SessionLocal() as session:
        rows = session.execute(select(StudyNote)).scalars().all()
        rows = sorted(rows, key=lambda r: (r.date or "", r.slug), reverse=True)
        return {"notes": [_serialize_study_note(r) for r in rows]}


@app.get("/api/study-notes/{slug}")
def study_note_get(slug: str):
    """PUBLIC — one study note."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(StudyNote, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        return _serialize_study_note(row)


@app.put("/api/study-notes/{slug}", dependencies=[Depends(require_admin)])
def study_note_put(slug: str, body: StudyNoteBody):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(StudyNote, slug)
        created = row is None
        if created:
            row = StudyNote(slug=slug)
            session.add(row)
        _apply_study_note(row, body)
        session.commit()
        session.refresh(row)
        return {"created": created, **_serialize_study_note(row)}


@app.patch("/api/study-notes/{slug}", dependencies=[Depends(require_admin)])
def study_note_patch(slug: str, body: StudyNotePatch):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(StudyNote, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        for key, value in body.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        session.commit()
        session.refresh(row)
        return _serialize_study_note(row)


@app.delete("/api/study-notes/{slug}", dependencies=[Depends(require_admin)])
def study_note_delete(slug: str):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(StudyNote, slug)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        session.delete(row)
        session.commit()
        return {"deleted": slug}


@app.post("/api/study-notes/bulk", dependencies=[Depends(require_admin)])
def study_notes_bulk(entries: list[StudyNoteFull]):
    """PRIVATE — upsert an array (replaces the migration importer)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        for entry in entries:
            row = session.get(StudyNote, entry.slug)
            if row is None:
                row = StudyNote(slug=entry.slug)
                session.add(row)
            _apply_study_note(row, entry)
        session.commit()
        return {"upserted": len(entries)}


# ===========================================================================
# Shadow backup / recovery (P2·S6+). Append-only history of every scoped-key-
# writable change (daily_logs + index), written server-side by _shadow(). Both
# routes are MASTER-ONLY (require_admin) — the scoped DAILYLOG_SECRET can trigger
# snapshots (by writing) but can never read the history or restore, so a leaked
# scoped key cannot erase its tracks or roll data back. Use /restore to recover
# after an accidental or malicious delete/overwrite done with the scoped key.
# ===========================================================================
@app.get("/api/shadow/history", dependencies=[Depends(require_admin)])
def shadow_history(kind: Optional[str] = None, key: Optional[str] = None, limit: int = 100):
    """MASTER — recent shadow snapshots, newest first. Filter by kind/key. Full
    snapshot bodies are included only when a specific `key` is requested (keeps the
    list light)."""
    if SessionLocal is None:
        return {"count": 0, "history": []}
    with SessionLocal() as session:
        q = select(ShadowHistory).order_by(ShadowHistory.id.desc())
        if kind:
            q = q.where(ShadowHistory.kind == kind)
        if key:
            q = q.where(ShadowHistory.key == key)
        q = q.limit(max(1, min(limit, 2000)))
        rows = session.execute(q).scalars().all()
        include_snap = key is not None
        out = []
        for r in rows:
            item = {"id": r.id, "kind": r.kind, "key": r.key, "op": r.op, "at": r.at}
            if include_snap:
                item["snapshot"] = r.snapshot
            out.append(item)
        return {"count": len(out), "history": out}


@app.post("/api/shadow/restore", dependencies=[Depends(require_admin)])
def shadow_restore(kind: Optional[str] = None, key: Optional[str] = None, before: Optional[str] = None):
    """MASTER — recover daily_logs / index from the shadow history. For each
    (kind, key) it takes the LATEST snapshot (optionally at-or-before `before`) and
    upserts that content back. Delete-snapshots carry the full pre-delete state, so
    a wiped day is fully recovered. No args = restore everything to its last-known
    content; `before=<ISO ts>` = roll back to a point in time; `kind`/`key` = restore
    just one thing. (A legitimately-deleted day is resurrected — use kind/key to scope.)"""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        q = select(ShadowHistory).order_by(ShadowHistory.id.asc())
        if kind:
            q = q.where(ShadowHistory.kind == kind)
        if key:
            q = q.where(ShadowHistory.key == key)
        if before:
            q = q.where(ShadowHistory.at <= before)
        rows = session.execute(q).scalars().all()
        latest: dict = {}
        for r in rows:  # ascending → last write per (kind,key) wins; delete carries pre-delete state
            latest[(r.kind, r.key)] = r
        restored_days, restored_index = [], []
        for (k_kind, k_key), r in latest.items():
            snap = r.snapshot or {}
            if k_kind == "daily_log":
                drow = session.get(DailyLog, k_key)
                if drow is None:
                    drow = DailyLog(date=k_key)
                    session.add(drow)
                drow.week = snap.get("week")
                drow.done = snap.get("done") or []
                drow.summary = snap.get("summary")
                drow.note = snap.get("note")
                drow.leetcode = snap.get("leetcode") or []
                drow.sections = snap.get("sections") or {}
                drow.tags = snap.get("tags") or []
                restored_days.append(k_key)
            elif k_kind == "index":
                srow = session.get(SiteMeta, INDEX_KEY)
                if srow is None:
                    srow = SiteMeta(key=INDEX_KEY)
                    session.add(srow)
                srow.value = snap.get("value")
                srow.updated_at = snap.get("updatedAt")
                restored_index.append(k_key)
        session.commit()
        return {
            "restored": {"daily_log": len(restored_days), "index": len(restored_index)},
            "dates": sorted(restored_days),
        }


# ===========================================================================
# MCP server (P2·S7) — exposes the daily-log + index CRUD as MCP tools so a
# phone / Cowork chat can manage the log through a claude.ai *custom connector*.
#
# WHY a connector (not plain bash): the Cowork cloud sandbox blocks bash egress
# to lia-til.onrender.com, but MCP connector traffic rides a different transport
# that reaches it — so this is the path to CRUD the log from the phone.
#
# AUTH (Option 1 / MVP): the whole MCP app is mounted under a secret, unguessable
# path — /mcp/<MCP_TOKEN>/. Knowing that URL is the credential; a wrong/absent
# token just 404s. host_origin_protection is off because the URL token is the
# auth and Render's proxy would otherwise trip DNS-rebinding checks.
#
# The tools call the SAME handlers as the HTTP API, so every write still flows
# through _shadow() append-only backup. Scope: daily-log + index full CRUD, PLUS
# application STATUS updates (list + set_application_status only — for logging a
# rejection/offer straight from email). Still NEVER exposed via MCP: application
# create/delete/bulk, résumé, leetcode, or any delete beyond daily-log.
# Upgrade path (Option 2): swap the URL token for OAuth / a header check; tools
# stay identical.
# ===========================================================================
try:
    from fastmcp import FastMCP  # v3+ (needs Python >= 3.10)
except Exception:  # not installed / old Python — run the plain HTTP API without MCP
    FastMCP = None


def _http_err(exc: HTTPException) -> dict:
    """Turn a handler's HTTPException into a plain tool result the model can read
    (e.g. a 404 'not found') instead of surfacing as an opaque tool crash."""
    return {"error": f"{exc.status_code}: {exc.detail}"}


if FastMCP is not None and MCP_TOKEN:
    mcp = FastMCP(
        name="lia-til-daily",
        instructions=(
            "Manage Lia's private daily learning log (lia-til): the daily-log "
            "entries, the INDEX/TL;DR navigator, and job-application STATUS. Dates "
            "are ISO 'YYYY-MM-DD'. To change part of an existing day, prefer "
            "get_daily_log then upsert_daily_log with the merged result — "
            "upsert/patch REPLACE each field you send (sections is replaced "
            "wholesale, never per-heading-merged). To add one section without "
            "disturbing the others, use append_section. For applications: these "
            "tools only READ the ledger and UPDATE an existing application's status "
            "(e.g. after a rejection email) — find the row with list_applications, "
            "then set_application_status(appNum, ...). They cannot create, delete, "
            "or bulk-edit applications."
        ),
    )

    _RO = {"readOnlyHint": True, "openWorldHint": False}
    _WR = {"readOnlyHint": False, "destructiveHint": False, "idempotentHint": True, "openWorldHint": False}
    _DEL = {"readOnlyHint": False, "destructiveHint": True, "idempotentHint": True, "openWorldHint": False}

    @mcp.tool(annotations=_RO)
    def list_daily_logs(limit: int = 30) -> list[dict]:
        """List recent daily-log days, newest first. Compact view: each item has
        date, week, summary, doneCount, leetcodeCount, tags, and the section
        HEADINGS (not their content). Call get_daily_log(date) for full content.
        `limit` caps how many days come back (default 30)."""
        if SessionLocal is None:
            return []
        with SessionLocal() as session:
            rows = (
                session.execute(
                    select(DailyLog).order_by(DailyLog.date.desc()).limit(max(1, limit))
                )
                .scalars()
                .all()
            )
            return [
                {
                    "date": r.date,
                    "week": r.week,
                    "summary": r.summary,
                    "doneCount": len(r.done or []),
                    "leetcodeCount": len(r.leetcode or []),
                    "tags": _tags_for(r),
                    "sectionHeadings": sorted((r.sections or {}).keys()),
                }
                for r in rows
            ]

    @mcp.tool(annotations=_RO)
    def get_daily_log(date: str) -> dict:
        """Get one day's FULL stored record, including the private `sections`.
        Returns {"error": "404: not found"} if that day doesn't exist yet."""
        try:
            return daily_log_get(date)
        except HTTPException as e:
            return _http_err(e)

    @mcp.tool(annotations=_WR)
    def upsert_daily_log(
        date: str,
        week: Optional[str] = None,
        done: Optional[list[str]] = None,
        summary: Optional[str] = None,
        note: Optional[str] = None,
        leetcode: Optional[list[dict]] = None,
        sections: Optional[dict] = None,
        tags: Optional[list[str]] = None,
    ) -> dict:
        """Create-or-replace a whole day (upsert). WARNING: any field you omit is
        stored empty/null — to keep existing content, read get_daily_log(date)
        first and pass the merged values back. Auto-backed up via shadow history.
        Returns the stored record plus {"created": true|false}."""
        body = DailyLogIn(
            week=week,
            done=done or [],
            summary=summary,
            note=note,
            leetcode=leetcode or [],
            sections=sections,
            tags=tags or [],
        )
        return daily_log_put(date, body)

    @mcp.tool(annotations=_WR)
    def patch_daily_log(
        date: str,
        week: Optional[str] = None,
        done: Optional[list[str]] = None,
        summary: Optional[str] = None,
        note: Optional[str] = None,
        leetcode: Optional[list[dict]] = None,
        sections: Optional[dict] = None,
        tags: Optional[list[str]] = None,
    ) -> dict:
        """Update ONLY the fields you pass, on an existing day (404 if it doesn't
        exist yet — use upsert_daily_log to create). Each field you pass REPLACES
        the stored one; `sections` is replaced wholesale (no per-heading merge —
        use append_section for that). Auto-backed up via shadow history."""
        provided = {
            k: v
            for k, v in dict(
                week=week, done=done, summary=summary, note=note,
                leetcode=leetcode, sections=sections, tags=tags,
            ).items()
            if v is not None
        }
        try:
            return daily_log_patch(date, DailyLogPatch(**provided))
        except HTTPException as e:
            return _http_err(e)

    @mcp.tool(annotations=_WR)
    def append_section(date: str, heading: str, content: str) -> dict:
        """Add or overwrite ONE section heading on a day WITHOUT touching the
        others (does the get→merge→save for you). Creates the day if it doesn't
        exist. Auto-backed up via shadow history."""
        try:
            existing = daily_log_get(date)
            sections = dict(existing.get("sections") or {})
            base = DailyLogIn(
                week=existing.get("week"),
                done=existing.get("done") or [],
                summary=existing.get("summary"),
                note=existing.get("note"),
                leetcode=existing.get("leetcode") or [],
                tags=existing.get("tags") or [],
                sections=sections,
            )
        except HTTPException:
            base = DailyLogIn()  # day doesn't exist yet → start fresh
            sections = {}
        sections[heading] = content
        base.sections = sections
        return daily_log_put(date, base)

    @mcp.tool(annotations=_DEL)
    def delete_daily_log(date: str) -> dict:
        """Delete an entire day. Recoverable via the master-only shadow restore.
        Returns {"error": "404: not found"} if the day doesn't exist."""
        try:
            return daily_log_delete(date)
        except HTTPException as e:
            return _http_err(e)

    @mcp.tool(annotations=_RO)
    def get_index() -> dict:
        """Get the private INDEX/TL;DR markdown navigator ({value, updatedAt})."""
        return index_get()

    @mcp.tool(annotations=_WR)
    def set_index(value: str) -> dict:
        """Replace the whole INDEX/TL;DR markdown document (upsert). Auto-backed up."""
        return index_put(IndexBody(value=value))

    @mcp.tool(annotations=_RO)
    def list_applications(
        company: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 30,
    ) -> list[dict]:
        """List job applications from the private ledger, newest app_num first, to
        find the one to update. Optional filters: `company` (case-insensitive
        substring) and `status` (case-insensitive exact match). Each item is the
        full row {appNum, company, role, resume, appliedDate, status, notes}. Pass
        the appNum to set_application_status to update it."""
        if SessionLocal is None:
            return []
        with SessionLocal() as session:
            stmt = select(Application).order_by(Application.app_num.desc())
            if company:
                stmt = stmt.where(Application.company.ilike(f"%{company}%"))
            if status:
                stmt = stmt.where(func.lower(Application.status) == status.lower())
            rows = session.execute(stmt.limit(max(1, limit))).scalars().all()
            return [_serialize_app(r) for r in rows]

    @mcp.tool(annotations=_WR)
    def set_application_status(
        app_num: int,
        status: str,
        notes: Optional[str] = None,
    ) -> dict:
        """Update ONE existing application's status (e.g. to 'Rejected' after a
        rejection email), found via list_applications. `status` is changed and
        `lastUpdate` is bumped to today (the status-signal date) and ONE row is
        appended to the status history with source="phone-mcp" — plus `notes`
        IF you pass it, which REPLACES the existing notes wholesale (omit it to
        keep them). Company/role/appliedDate/resume are left intact. Until the
        file→DB sync is retired, a later `sync_lia_til.py` push can still
        overwrite status/lastUpdate with the file's values (the history row
        survives). Auto-backed up via shadow history. Returns the updated row,
        or {"error": "404: not found"} if that app_num doesn't exist."""
        try:
            return _set_status_core(app_num, status, "phone-mcp", notes, replace_notes=notes)
        except HTTPException as e:
            return _http_err(e)

    # Stateless Streamable-HTTP app, mounted under the secret token prefix.
    # Final endpoint for the connector: https://<host>/mcp/<MCP_TOKEN>/
    _MCP_APP = mcp.http_app(
        path="/",
        stateless_http=True,
        host_origin_protection=False,
    )
    app.mount(f"/mcp/{MCP_TOKEN}", _MCP_APP)
