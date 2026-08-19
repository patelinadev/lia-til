# lia-til

A public **learning-progress** site — anyone can open the URL and see what Lia is
currently learning. No login required. It tracks LeetCode progress (the [0x3f
基础算法精讲](https://space.bilibili.com/206214/channel/collectiondetail?sid=842776)
track) and a day-by-day learning log.

**How it updates:** content lives as JSON files in this repo. Lia tells Claude what
she learned → Claude edits the content files → `git push` → Vercel auto-deploys →
the page is live in ~1 minute. "Write access" is just Git access — no app-level auth.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 + React 19 + TypeScript | Static-rendered pages, App Router |
| Styling | Tailwind CSS v4 | — |
| Content | Markdown/JSON files in `web/content/` | Read at build time; no database |
| Hosting | Vercel | Zero-config Next.js deploys; push → auto-deploy |

No backend or database yet — that arrives in Phase 2 (FastAPI + PostgreSQL).

## Structure

```
web/                     # the Next.js app (Vercel root directory)
├── app/
│   ├── page.tsx         # minimal home hub
│   ├── leetcode/        # LeetCode table — filter / sort / status / colored topics
│   └── daily-log/       # tree-trunk day-by-day timeline
├── content/
│   ├── leetcode.json    # solved problems
│   └── log/*.json        # one file per day
└── lib/
    ├── content.ts        # client-safe types + helpers
    └── content.server.ts # filesystem readers (build-time)
docs/
└── walkthrough.html      # living dev + deploy walkthrough (one section per Phase/Stage)
```

## Roadmap

- **Phase 1 — frontend + deployment** ✅
  - S1 (`v0.1.0`): Next.js skeleton on Vercel with a Git-push auto-deploy pipeline
  - S2 (`v0.2.0`): section routes, LeetCode table (filter/sort/status/colored topics), curated daily log
- **Phase 2 — backend**: FastAPI + PostgreSQL (Railway) for runtime, persisted interaction
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

The repo is public, so nothing sensitive goes in it. The daily log is **curated** from
private notes — study content ships; personal, application, and other sensitive material
is excluded by default.
