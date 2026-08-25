import type { ReactNode } from "react";

/**
 * Dedicated renderer for the private INDEX / TL;DR navigator. Unlike the generic
 * SectionBody, it understands the INDEX's fixed line grammar and lays it out as a
 * scannable "book" — a jump-to TOC, per-track headers with counts, date-aligned
 * entry rows (whole row links to the day), and a dot-progress streak.
 *
 * Grammar it parses:
 *   lead paragraph(s)                         (before the first "## ")
 *   ## Section                                → a track
 *   **规则:** …                                → a muted note under the track
 *   - 2026-W35 (08-24 → 08-30): 1/7           → a streak week (dot progress)
 *   - 2026-08-25 — [Title](/link) — desc      → an entry row
 */

type Entry = { date: string; title: string; href: string; desc: string };
type Week = { wk: string; range: string; done: number; total: number };
type Section = {
  id: string;
  title: string;
  icon: string;
  dot: string;
  notes: string[];
  weeks: Week[];
  entries: Entry[];
  bullets: string[];
};

const META: { test: RegExp; icon: string; dot: string }[] = [
  { test: /streak/i, icon: "🔥", dot: "bg-amber-500" },
  { test: /tech/i, icon: "🧠", dot: "bg-violet-500" },
  { test: /interview|domain/i, icon: "🎯", dot: "bg-emerald-500" },
  { test: /oral|english/i, icon: "🗣️", dot: "bg-sky-500" },
  { test: /diary/i, icon: "✨", dot: "bg-rose-500" },
];
const metaFor = (t: string) =>
  META.find((m) => m.test.test(t)) ?? { icon: "📌", dot: "bg-neutral-400" };

const slug = (t: string) =>
  "idx-" + t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const shortTitle = (t: string) => t.split(/[—(]/)[0].trim();

const ENTRY = /^-\s*(\d{4}-\d{2}-\d{2})\s+—\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:—\s*(.*))?$/;
const WEEK = /^-\s*\d{4}-W(\d{2})\s*\(([^)]*)\)\s*:\s*(\d+)\s*\/\s*(\d+)\s*$/;

/** Minimal inline: **bold** only (INDEX notes use it for labels). */
function Inline({ text }: { text: string }): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-neutral-700 dark:text-neutral-300">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function parse(md: string): { lead: string[]; sections: Section[] } {
  const lead: string[] = [];
  const sections: Section[] = [];
  let cur: Section | null = null;

  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const h = line.match(/^#{2,6}\s+(.*)$/);
    if (h) {
      const title = h[1].trim();
      const m = metaFor(title);
      cur = { id: slug(title), title, icon: m.icon, dot: m.dot, notes: [], weeks: [], entries: [], bullets: [] };
      sections.push(cur);
      continue;
    }
    // a lone top-level "# heading" before any section → treat as lead text
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1 && !cur) {
      lead.push(h1[1]);
      continue;
    }

    if (!cur) {
      lead.push(line);
      continue;
    }

    const wk = line.match(WEEK);
    if (wk) {
      cur.weeks.push({ wk: `W${wk[1]}`, range: wk[2].trim(), done: +wk[3], total: +wk[4] });
      continue;
    }
    const en = line.match(ENTRY);
    if (en) {
      cur.entries.push({ date: en[1], title: en[2], href: en[3], desc: (en[4] ?? "").trim() });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      cur.bullets.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    cur.notes.push(line);
  }
  return { lead, sections };
}

function EntryRow({ e }: { e: Entry }) {
  return (
    <a
      href={e.href}
      className="group -mx-2 flex gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
    >
      <time className="w-[52px] shrink-0 pt-0.5 font-mono text-[10px] leading-4 text-neutral-400 transition-colors group-hover:text-neutral-500">
        {e.date}
      </time>
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium text-neutral-800 transition-colors group-hover:text-blue-600 dark:text-neutral-200 dark:group-hover:text-blue-400">
          {e.title}
        </span>
        <span aria-hidden className="ml-1 text-[10px] text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">
          ↗
        </span>
        {e.desc && (
          <span className="mt-0.5 block text-xs leading-snug text-neutral-500 dark:text-neutral-400">
            {e.desc}
          </span>
        )}
      </span>
    </a>
  );
}

export default function IndexBody({ md }: { md: string }) {
  const { lead, sections } = parse(md);

  return (
    <div>
      {lead.length > 0 && (
        <p className="mb-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {lead.join(" ")}
        </p>
      )}

      {sections.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:text-neutral-100"
            >
              <span aria-hidden>{s.icon}</span>
              {shortTitle(s.title)}
            </a>
          ))}
        </div>
      )}

      {sections.map((s) => {
        // The streak's weekly counts now live on the page header (the check-in
        // stat), so the drawer keeps only the rule note — no weeks, no count.
        const count = s.entries.length;
        return (
          <section key={s.id} id={s.id} className="scroll-mt-4">
            <div className="mb-1.5 mt-5 flex items-center gap-2 border-b border-neutral-200 pb-1 dark:border-neutral-800">
              <span aria-hidden className="text-sm">{s.icon}</span>
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{s.title}</h3>
              {count > 0 && (
                <span className="ml-auto font-mono text-[10px] text-neutral-400">{count}</span>
              )}
            </div>

            {s.notes.map((n, i) => (
              <p key={i} className="my-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                <Inline text={n} />
              </p>
            ))}

            {s.entries.length > 0 && (
              <div className="mt-0.5 flex flex-col">
                {s.entries.map((e, i) => (
                  <EntryRow key={i} e={e} />
                ))}
              </div>
            )}

            {s.bullets.length > 0 && (
              <ul className="my-1.5 flex flex-col gap-1 pl-1">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-400" />
                    <span><Inline text={b} /></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
