"""lia-til API — FastAPI backend (Phase 2 · S1).

Public endpoints only. The applications table holds full private data, but this
service exposes ONLY aggregate counts (no company names, roles, salaries).
Private full views come later behind auth (S2).
"""

import os
import re
from contextlib import asynccontextmanager
from datetime import date as date_type
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, text

from db import Base, SessionLocal, engine
from models import Application, DailyLog, LeetcodeProblem, SDDeck, SiteMeta

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
    public and private (tags are topic labels, never the private content)."""
    return sorted(set((row.tags or []) + _auto_tags(row.sections)))


# Section policy. Headings are matched with any trailing "#tag" stripped (the
# vault stored both "Tech" and "Tech  #tech"). PRIVATE headings never appear on
# the public endpoint; everything else is public-safe learning content
# (Tech / Interview / Oral English / Timeline / 今日快报 / one-off tech notes).
_TAG_SUFFIX = re.compile(r"\s+#[\w-]+\s*$")


def _clean_heading(k: str) -> str:
    return _TAG_SUFFIX.sub("", k).strip()


def _is_private_heading(h: str) -> bool:
    """h must already be cleaned. Private = Success Diary + daily SOP + To-Do."""
    return (
        h in ("Success Diary", "_preamble")
        or h.startswith("今日 SOP")
        or h.startswith("今日 To-Do")
        or h.startswith("今日 To-do")
    )


def _sections_out(sections, public: bool) -> dict:
    """Normalize headings (strip #tag). For the public endpoint, drop the private
    ones so only public-safe sections are ever serialized outside the secret."""
    out = {}
    for k, v in (sections or {}).items():
        h = _clean_heading(k)
        if public and _is_private_heading(h):
            continue
        out[h] = v
    return out


def _daily_log_entries(include_sections: bool = False):
    """Daily-log entries newest-first, LeetCode items enriched with their solution
    URL from the leetcode table (single source). `include_sections` (the gated
    /full endpoint) returns EVERY section; the public endpoint returns only the
    public-safe sections (private headings filtered out), so Success Diary / SOP /
    To-Do can't leak."""
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
                # private: every day, with its full sections (headings normalized)
                entry["sections"] = _sections_out(r.sections, public=False)
                out.append(entry)
            else:
                # public: curated fields + public-safe sections. A day surfaces if
                # it has ANY public content; a day with only private sections
                # (e.g. pure Success Diary) stays hidden.
                pub = _sections_out(r.sections, public=True)
                if r.done or r.summary or r.note or r.leetcode or pub:
                    entry["sections"] = pub
                    out.append(entry)
        return out


@app.get("/api/daily-log")
def daily_log():
    """Public — curated fields only (checked items + one-line summary + LeetCode).
    Never returns `sections`, so the private per-day content can't leak."""
    return _daily_log_entries()


@app.get("/api/daily-log/full", dependencies=[Depends(require_admin)])
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


# ===========================================================================
# INDEX / TL;DR navigator (P2·S5). A single private markdown document — the
# rolling "table of contents" for fast recall. Stored in site_meta under
# key='index'. PRIVATE — both read and write are X-Admin-Secret-gated; it is
# never exposed on any public endpoint.
# ===========================================================================
INDEX_KEY = "index"


class IndexBody(BaseModel):
    value: str  # markdown


@app.get("/api/index", dependencies=[Depends(require_admin)])
def index_get():
    """PRIVATE — the INDEX/TL;DR markdown (empty string if never written)."""
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(SiteMeta, INDEX_KEY)
        if row is None:
            return {"value": "", "updatedAt": None}
        return {"value": row.value or "", "updatedAt": row.updated_at}


@app.put("/api/index", dependencies=[Depends(require_admin)])
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
    status: Optional[str] = None
    notes: Optional[str] = None


class ApplicationPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    company: Optional[str] = None
    role: Optional[str] = None
    resume: Optional[str] = None
    applied_date: Optional[date_type] = Field(default=None, alias="appliedDate")
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
        "status": r.status,
        "notes": r.notes,
    }


def _apply_app(row: Application, body) -> None:
    row.company = body.company
    row.role = body.role
    row.resume = body.resume
    row.applied_date = body.applied_date
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
        created = row is None
        if created:
            row = Application(app_num=app_num)
            session.add(row)
        _apply_app(row, body)
        session.commit()
        session.refresh(row)
        return {"created": created, **_serialize_app(row)}


@app.patch("/api/applications/{app_num}", dependencies=[Depends(require_admin)])
def application_patch(app_num: int, body: ApplicationPatch):
    if SessionLocal is None:
        raise HTTPException(status_code=503, detail="db unavailable")
    with SessionLocal() as session:
        row = session.get(Application, app_num)
        if row is None:
            raise HTTPException(status_code=404, detail="not found")
        for key, value in body.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
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
        session.commit()
        return {"upserted": len(entries)}


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
