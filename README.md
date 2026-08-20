# lia-til

A public **learning-progress** site — anyone can open the URL and see what Lia is
working on. No login required. A minimal home hub links to four sections:

- **Daily Log** — a day-by-day timeline of what she studied
- **LeetCode** — solved problems (the [0x3f 基础算法精讲](https://space.bilibili.com/206214/channel/collectiondetail?sid=842776) track), filterable/sortable, with colored topic tags and a 5-tag status
- **Applications** — an anonymized job-search dashboard (counts only) + a submissions calendar
- **System Design** — study notes, one page per deck, with re-drawn diagrams

**How it updates:** content lives as JSON files in this repo. Lia tells Claude what she
learned → Claude edits the content files → `git push` → Vercel auto-deploys → live in
~1 minute. "Write access" is just Git access — no app-level auth.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 + React 19 + TypeScript | Statically-rendered pages, App Router |
| Styling | Tailwind CSS v4 | Theme-aware (light/dark) |
| Content | JSON files in `web/content/` | Read at build time; no database |
| Hosting | Vercel | Zero-config Next.js deploys; push → auto-deploy |

No backend or database yet — that arrives in Phase 2 (FastAPI + PostgreSQL).

## Structure

```
web/                        # the Next.js app (Vercel root directory)
├── app/
│   ├── page.tsx            # minimal home hub (4 cards)
│   ├── layout.tsx          # global shell + subtle footer
│   ├── leetcode/           # problem table — header-dropdown filters, sort, colored topics
│   ├── daily-log/          # tree-trunk day-by-day timeline
│   ├── applications/       # anonymized dashboard + submissions calendar
│   ├── system-design/      # source→chapter tree
│   │   ├── [slug]/         #   per-deck detail page with a sticky outline nav
│   │   ├── decks.ts        #   deck/slide data
│   │   └── diagrams.tsx    #   re-drawn, theme-aware diagrams
│   └── components/Reveal.tsx  # scroll-reveal helper
├── content/
│   ├── leetcode.json       # solved problems (id, topics, status, date, solution)
│   ├── log/*.json          # one file per day
│   └── applications.json   # AGGREGATE counts only (generated — see Privacy)
└── lib/
    ├── content.ts          # client-safe types + helpers
    └── content.server.ts   # filesystem readers (build-time)
docs/
└── walkthrough.html        # living dev + deploy walkthrough (one section per Phase/Stage)
```

## Roadmap

- **Phase 1 — frontend + deployment** ✅
  - S1 (`v0.1.0`): Next.js skeleton on Vercel with a Git-push auto-deploy pipeline
  - S2 (`v0.2.x`): four section routes — LeetCode (filter/sort/status/colored topics),
    Daily Log timeline, anonymized Applications dashboard + calendar, System Design notes
    with per-deck detail pages
- **Phase 2 — backend**: FastAPI (Render) + PostgreSQL (Neon), both free — a data source that ingests Lia's
  scattered application / LeetCode data and lets the site sync from it on a schedule
- **Phase 3 — DevOps**: Docker + GitHub Actions CI/CD + AWS

The full step-by-step development & deployment history lives in
[`docs/walkthrough.html`](docs/walkthrough.html).

## Local development

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Privacy

The repo is public, so nothing sensitive goes in it.

- The **Daily Log** is curated from private notes — study content ships; personal,
  application, and other sensitive material is excluded by default.
- The **Applications** dashboard is built from a **local, git-ignored ledger**. A generator
  reads it and writes only anonymized aggregates (totals, status counts, per-day counts) to
  `content/applications.json`. Company names, roles, salaries, and visa details never enter
  the repo.
