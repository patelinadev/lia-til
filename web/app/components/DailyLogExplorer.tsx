"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { fuzzyMatch } from "@/lib/content";
import { realSections } from "@/lib/daily";

export type DailyEntry = {
  date: string;
  week: string | null;
  done: string[];
  summary: string | null;
  note: string | null;
  leetcode?: { id: number; slug?: string; title?: string; solutionUrl?: string | null }[];
  sections?: Record<string, string> | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function searchBlob(e: DailyEntry): string {
  const parts: (string | null | undefined)[] = [e.date, e.week, e.summary, e.note, ...e.done];
  for (const p of e.leetcode ?? []) parts.push(`LC ${p.id} ${p.title ?? ""}`);
  for (const [k, v] of realSections(e.sections)) parts.push(`${k} ${v}`);
  return parts.filter(Boolean).join(" ");
}

export default function DailyLogExplorer({
  entries,
  variant,
}: {
  entries: DailyEntry[];
  variant: "public" | "private";
}) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [week, setWeek] = useState<string>("");
  const [railOpen, setRailOpen] = useState(true);

  const years = useMemo(
    () => [...new Set(entries.map((e) => Number(e.date.slice(0, 4))))].sort((a, b) => b - a),
    [entries],
  );
  const monthsWithData = useMemo(() => {
    const s = new Set<number>();
    for (const e of entries) if (!year || Number(e.date.slice(0, 4)) === year) s.add(Number(e.date.slice(5, 7)));
    return s;
  }, [entries, year]);
  const weeks = useMemo(() => {
    const seen = new Set<string>();
    const out: { week: string; year: string }[] = [];
    for (const e of entries) if (e.week && !seen.has(e.week)) { seen.add(e.week); out.push({ week: e.week, year: e.date.slice(0, 4) }); }
    return out;
  }, [entries]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (year && Number(e.date.slice(0, 4)) !== year) return false;
        if (month && Number(e.date.slice(5, 7)) !== month) return false;
        if (week && e.week !== week) return false;
        return fuzzyMatch(q, searchBlob(e));
      }),
    [entries, q, year, month, week],
  );

  const anyFilter = year !== null || month !== null || week !== "";
  const clear = () => { setYear(null); setMonth(null); setWeek(""); };

  const chip = "rounded-full border px-2.5 py-1 font-mono text-xs transition-colors";
  const chipOn = "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900";
  const chipOff = "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400";

  return (
    <>
      {/* fuzzy search box (searches every field) */}
      <div className="relative mb-3">
        <svg aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={variant === "private" ? "Fuzzy search — every field, including sections" : "Fuzzy search the log…"}
          autoComplete="off"
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-800 dark:bg-neutral-900"
        />
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setRailOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-400"
        >
          {railOpen ? "⟨ Hide filters" : "Filters ⟩"}
        </button>
        <span className="font-mono text-xs text-neutral-400">
          {filtered.length}/{entries.length} days{anyFilter || q ? " (filtered)" : ""}
        </span>
      </div>

      <div className={railOpen ? "grid grid-cols-1 items-start gap-8 md:grid-cols-[210px_1fr]" : ""}>
        {/* filter rail */}
        {railOpen && (
          <aside className="md:sticky md:top-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Filter</h3>
              {anyFilter && (
                <button type="button" onClick={clear} className="text-[11px] text-blue-600 hover:underline dark:text-blue-400">clear</button>
              )}
            </div>

            <p className="mb-1.5 mt-3 text-[11px] uppercase tracking-wider text-neutral-400">Year</p>
            <div className="flex flex-wrap gap-1.5">
              {years.map((y) => (
                <button key={y} type="button" onClick={() => { setYear(year === y ? null : y); setMonth(null); }} className={`${chip} ${year === y ? chipOn : chipOff}`}>{y}</button>
              ))}
            </div>

            <p className="mb-1.5 mt-3 text-[11px] uppercase tracking-wider text-neutral-400">Month</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS.map((label, i) => {
                const m = i + 1;
                const has = monthsWithData.has(m);
                return (
                  <button key={label} type="button" disabled={!has} onClick={() => setMonth(month === m ? null : m)} className={`rounded-full border py-1 text-center font-mono text-xs transition-colors ${month === m ? chipOn : has ? "border-blue-500/35 text-blue-700 hover:border-blue-500 dark:text-blue-400" : "cursor-not-allowed border-neutral-200 text-neutral-300 opacity-40 dark:border-neutral-800 dark:text-neutral-600"}`}>{label}</button>
                );
              })}
            </div>

            <p className="mb-1.5 mt-3 text-[11px] uppercase tracking-wider text-neutral-400">Week</p>
            <select value={week} onChange={(e) => setWeek(e.target.value)} className="w-full cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 font-mono text-[13px] outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-900">
              <option value="">All weeks</option>
              {weeks.map((w) => (<option key={w.week} value={w.week}>{w.year} · {w.week}</option>))}
            </select>
          </aside>
        )}

        {/* day list */}
        <div className="flex flex-col gap-3">
          {filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400 dark:border-neutral-700">No days match.</p>
          )}
          {filtered.map((e) =>
            variant === "private" ? (
              <PrivateDayCard key={e.date} e={e} />
            ) : (
              <PublicDayCard key={e.date} e={e} />
            ),
          )}
        </div>
      </div>
    </>
  );
}

function DayHead({ e }: { e: DailyEntry }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-sm font-semibold">{e.date}</span>
      {e.week && <span className="font-mono text-xs text-neutral-400">{e.week}</span>}
    </div>
  );
}

/** Private: a compact card linking to the day's own page (the full record is long). */
function PrivateDayCard({ e }: { e: DailyEntry }) {
  const secN = realSections(e.sections).length;
  const lcN = e.leetcode?.length ?? 0;
  return (
    <Link
      href={`/private/daily-log/${e.date}`}
      className="group rounded-xl border border-neutral-200 p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm font-semibold">{e.date}</span>
        <span className="flex items-center gap-2 font-mono text-xs text-neutral-400">
          {e.week}
          <span className="text-neutral-400 transition-transform group-hover:translate-x-0.5">→</span>
        </span>
      </div>
      {e.summary ? (
        <p className="mt-1.5 text-sm text-neutral-700 dark:text-neutral-300">{e.summary}</p>
      ) : (
        <p className="mt-1.5 text-sm italic text-neutral-400">no summary yet</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[11px] text-neutral-500">
        {secN > 0 && <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">{secN} sections</span>}
        {e.done.length > 0 && <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">{e.done.length} done</span>}
        {lcN > 0 && <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">{lcN} LC</span>}
        {e.note && <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">📝 note</span>}
      </div>
    </Link>
  );
}

/** Public: the curated content inline (short — no per-day page needed). */
function PublicDayCard({ e }: { e: DailyEntry }) {
  return (
    <article className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <DayHead e={e} />
      {e.summary && <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{e.summary}</p>}
      {e.done.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {e.done.map((item) => (
            <li key={item} className="rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-900">&#10003; {item}</li>
          ))}
        </ul>
      )}
      {e.leetcode && e.leetcode.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {e.leetcode.map((p) =>
            p.solutionUrl ? (
              <a key={p.id} href={p.solutionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-neutral-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50 dark:bg-neutral-900 dark:text-blue-400 dark:hover:bg-blue-950/40">
                LC {p.id}{p.title ? ` ${p.title}` : ""} <span aria-hidden className="text-[10px] opacity-80">↗</span>
              </a>
            ) : (
              <span key={p.id} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-900">LC {p.id}{p.title ? ` ${p.title}` : ""}</span>
            ),
          )}
        </div>
      )}
      {e.note && (
        <p className="mt-3 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-500 dark:border-neutral-700">📝 {e.note}</p>
      )}
    </article>
  );
}
