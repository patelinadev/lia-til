"""ORM models. The applications table holds the FULL private ledger; the public
API only ever returns aggregate counts derived from it."""

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)

from db import Base


class Application(Base):
    __tablename__ = "applications"

    app_num = Column(Integer, primary_key=True)  # gapless running counter from the ledger
    company = Column(String(200))
    role = Column(Text)
    resume = Column(String(50))
    applied_date = Column(Date)  # the submit date; never changes after it's set
    last_update = Column(Date)  # date of the row's most recent status signal (OA/call/onsite/offer/reject); = applied_date on submission
    status = Column(String(50))
    notes = Column(Text)
    # D8 — the company's IDENTITY (FK → companies.id). The legacy free-text
    # `company` column above stays until the backfill is verified, then is
    # dropped (Phase 5). Added to prod via the lifespan ALTER in main.py, since
    # create_all never ALTERs an existing table.
    company_id = Column(
        Integer,
        ForeignKey("companies.id", name="applications_company_id_fkey"),
        nullable=True,
    )
    # R8 hard identifier — the posting / ATS URL actually applied to. The ONLY
    # evidence that two applications are the same req (company+title is not).
    # Set by the create endpoint; deliberately NOT part of the legacy PUT/bulk
    # full-overwrite path, so a file sync can never null it.
    apply_url = Column(Text)


class Company(Base):
    """One row per company — the company's IDENTITY (D8). `name` is only a display
    label; `domain` (website host or ATS board slug, e.g. jobs.ashbyhq.com/clark)
    is the stable unique matching key, so two different "Clark"s never collide
    and one Amazon spelled two ways never splits. Optional per-company
    application cap (e.g. Ramp = 2 per 60 days) so the create endpoint can warn
    before the quota is burned."""

    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    domain = Column(String(200), unique=True)  # nullable: may be unresolved at first
    application_cap = Column(Integer)  # nullable — e.g. 2
    cap_window_days = Column(Integer)  # nullable — e.g. 60


class ApplicationStatusHistory(Base):
    """Append-only status TIMELINE for one application (D6): one row per status
    change, stamped by the database (`changed_at DEFAULT now()`). "Last Update"
    is DERIVED as the newest changed_at for the app — never stored on
    applications. Distinct from shadow_history, which is the whole-row security
    BACKUP (restore), not a queryable timeline. Status changes only — not every
    field edit."""

    __tablename__ = "application_status_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    app_num = Column(
        Integer,
        ForeignKey("applications.app_num", name="app_status_history_app_num_fkey"),
        index=True,
        nullable=False,
    )
    old_status = Column(String(50))  # NULL on the initial / seeded row
    new_status = Column(String(50), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    source = Column(String(40))  # desktop-claude | phone-mcp | website-admin | migration
    note = Column(Text)  # rejection text, OA link, ...


class ToApply(Base):
    """Today's On Deck queue (D9 / T4) — replaces to_apply.md and the daily git
    branches. Rewritten every sourcing run; Bridge reads it and ticks rows
    (queued → applied / skipped) through the API. company_id is the identity
    (D8); the API find-or-creates the company on write. One URL may appear at
    most once per queue day (carried rows re-appear on later days)."""

    __tablename__ = "to_apply"
    __table_args__ = (UniqueConstraint("queue_date", "apply_url", name="to_apply_day_url_uq"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    queue_date = Column(Date, nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id", name="to_apply_company_id_fkey"))
    role = Column(Text, nullable=False)
    location = Column(Text)
    apply_url = Column(Text, nullable=False)
    resume = Column(String(50))  # archetype, e.g. Fullstack_NYC
    note = Column(Text)
    reach = Column(Boolean, server_default=text("false"), nullable=False)
    fresh = Column(Boolean, server_default=text("false"), nullable=False)
    # Reserve row ("needs manual verify before applying") — shown apart from the
    # primary queue and never counted in it.
    backup = Column(Boolean, server_default=text("false"), nullable=False)
    status = Column(String(20), server_default="queued", nullable=False)  # queued | applied | skipped
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


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
