"""ORM models. The applications table holds the FULL private ledger; the public
API only ever returns aggregate counts derived from it."""

from sqlalchemy import JSON, Column, Date, Integer, String, Text

from db import Base


class Application(Base):
    __tablename__ = "applications"

    app_num = Column(Integer, primary_key=True)  # gapless running counter from the ledger
    company = Column(String(200))
    role = Column(Text)
    resume = Column(String(50))
    applied_date = Column(Date)
    status = Column(String(50))
    notes = Column(Text)


class LeetcodeProblem(Base):
    __tablename__ = "leetcode_problems"

    id = Column(Integer, primary_key=True)  # LeetCode problem number
    seq = Column(Integer)  # preserves the 0x3f plan order within an episode
    slug = Column(String(120))
    title = Column(Text)
    topics = Column(JSON)  # list[str]
    ep = Column(Integer)
    difficulty = Column(String(10))
    status = Column(String(30))
    date = Column(String(10))  # last completion, nullable
    solution_url = Column(Text)  # nullable


class SDDeck(Base):
    """One completed System Design deck. `slides` holds the full ordered slide
    array (eyebrow/title/intro/bullets/notes/quote + a diagram KEY); the diagram
    components themselves stay in the frontend (web/app/system-design/diagrams.tsx).
    The 30-deck curriculum route (PHASES) stays static in the frontend — only the
    decks that actually have content live here."""

    __tablename__ = "sd_decks"

    slug = Column(String(120), primary_key=True)
    n = Column(Integer)  # position in the 30-deck curriculum
    title = Column(Text)
    last_reviewed = Column(String(10))  # "YYYY-MM-DD"
    slides = Column(JSON)  # list[Slide]


class StudyNote(Base):
    """A standalone study note — text-first (markdown / HTML / mermaid / SVG stored
    inline in `body`); no binary/`pic` column, no object storage (a rare screenshot
    goes in as a base64 data-URI). Separate from daily_logs (whose `note` is only a
    one-line summary). Public educational content — like the SD decks."""

    __tablename__ = "study_notes"

    slug = Column(String(160), primary_key=True)
    title = Column(Text)
    topic = Column(String(80))  # optional grouping, e.g. "system-design", "postgres"
    date = Column(String(10))  # "YYYY-MM-DD" (authored / last updated)
    body = Column(Text)  # markdown / HTML / mermaid / inline SVG — text, not binary
    tags = Column(JSON)  # list[str]


class DailyLog(Base):
    """One curated public entry per day (checked items + one-line summary/note).
    Private sections (Success Diary / PhD / etc.) are NOT stored here yet — they
    arrive with the login/private views in S3."""

    __tablename__ = "daily_logs"

    date = Column(String(10), primary_key=True)  # "YYYY-MM-DD"
    week = Column(String(8))  # ISO week label, e.g. "W34"
    done = Column(JSON)  # list[str] — curated, public
    summary = Column(Text)  # one-line, public (generated during integration)
    note = Column(Text)
    leetcode = Column(JSON)  # list[{id, slug, title}]
    # Full faithful record from the Obsidian vault: {heading -> content}. Holds
    # the private sections too (Success Diary / interview / advisor / companies).
    # PRIVATE — served only on the gated /full endpoint, never on the public one.
    sections = Column(JSON)
    # Topic / type labels for categorization + search, e.g. ["code", "system-design"].
    tags = Column(JSON)  # list[str]


class Resume(Base):
    """Résumés. `kind='base'` is the single public master résumé (rendered on the
    public /resume page). `kind='tailored'` rows are the per-JD tailored résumés
    (one per application, linked by `app_num`) — PRIVATE (they carry company
    names), served only on the gated /full endpoint. `body` is text
    (markdown/tex); no binary/PDF is stored here — object storage is deferred."""

    __tablename__ = "resumes"

    slug = Column(String(120), primary_key=True)  # 'base' | the Resume # e.g. '001'
    kind = Column(String(20))  # 'base' | 'tailored'
    # NOTE: no app_num — one résumé is reused across MANY applications. The link
    # lives on the application side: applications.resume (a Resume #) → this slug.
    company = Column(String(200))  # nullable — what it was tailored for (metadata)
    role = Column(Text)  # nullable (tailored only)
    date = Column(String(10))  # "YYYY-MM-DD"
    fmt = Column(String(20))  # 'markdown' | 'tex' (API field name: "format")
    body = Column(Text)  # the résumé text


class SiteMeta(Base):
    """Small key-value store for singleton documents that aren't per-day. Currently
    holds the private INDEX / TL;DR navigator (key='index'); `value` is markdown.
    PRIVATE — served only behind the admin secret, never on any public endpoint."""

    __tablename__ = "site_meta"

    key = Column(String(64), primary_key=True)
    value = Column(Text)  # markdown
    updated_at = Column(String(10))  # "YYYY-MM-DD", set server-side on write


class ShadowHistory(Base):
    """Append-only shadow/audit backup for the tables a scoped/connector write can
    touch — daily_logs, site_meta (index), and applications (status updates via the
    MCP connector). The backend appends a snapshot on every such write
    (put/patch/delete). The scoped keys have NO endpoint that can read, modify, or
    delete this table — so even if such a key (or the MCP URL token) is leaked and
    abused to overwrite a row, the full history survives here and the master key can
    restore from it. Grows over time (text-only); prune old rows later if needed."""

    __tablename__ = "shadow_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kind = Column(String(20))  # "daily_log" | "index" | "application"
    key = Column(String(120), index=True)  # the day's date, "index", or the app_num
    op = Column(String(10))  # "put" | "patch" | "delete"
    snapshot = Column(JSON)  # full state captured for this op (pre-delete state for a delete)
    at = Column(String(40))  # ISO-8601 UTC timestamp
