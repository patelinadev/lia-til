"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

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
  const router = useRouter();
  const [q, setQ] = useState("");
  const [railOpen, setRailOpen] = useState(true);

  // one active filter at a time — week OR month OR day — so they can't conflict
  const [week, setWeek] = useState("");
  const [monthKey, setMonthKey] = useState(""); // "YYYY-MM"
  const [day, setDay] = useState(""); // "YYYY-MM-DD" (public only)

  // calendar popover state
  const [calOpen, setCalOpen] = useState(false);
  const latestYear = entries.length ? Number(entries[0].date.slice(0, 4)) : new Date().getFullYear();
  const [calYear, setCalYear] = useState(latestYear);
  const [calMonth, setCalMonth] = useState<number | null>(null);

  const years = useMemo(
    () => [...new Set(entries.map((e) => Number(e.date.slice(0, 4))))].sort((a, b) => b - a),
    [entries],
  );
  const monthsByYear = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const e of entries) {
      const y = Number(e.date.slice(0, 4));
      (m.get(y) ?? m.set(y, new Set()).get(y)!).add(Number(e.date.slice(5, 7)));
    }
    return m;
  }, [entries]);
  const daysByMonth = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const e of entries) {
      const k = e.date.slice(0, 7);
      (m.get(k) ?? m.set(k, new Set()).get(k)!).add(Number(e.date.slice(8, 10)));
    }
    return m;
  }, [entries]);
  const weeks = useMemo(() => {
    const seen = new Set<string>();
    const out: { week: string; year: string }[] = [];
    for (const e of entries) if (e.week && !seen.has(e.week)) { seen.add(e.week); out.push({ week: e.week, year: e.date.slice(0, 4) }); }
    return out;
  }, [entries]);

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (week && e.week !== week) return false;
        if (monthKey && e.date.slice(0, 7) !== monthKey) return false;
        if (day && e.date !== day) return false;
        return fuzzyMatch(q, searchBlob(e));
      }),
    [entries, q, week, monthKey, day],
  );

  // week-marker dates (first entry of each week, top-down) — the vertical timeline
  const weekMarks = useMemo(() => {
    const s = new Set<string>();
    let prev: string | null = null;
    for (const e of filtered) { if (e.week && e.week !== prev) s.add(e.date); if (e.week) prev = e.week; }
    return s;
  }, [filtered]);

  const activeLabel = week || (monthKey ? `${MONTHS[Number(monthKey.slice(5)) - 1]} ${monthKey.slice(0, 4)}` : day);
  const clearAll = () => { setWeek(""); setMonthKey(""); setDay(""); };
  const pickWeek = (w: string) => { setWeek(w); setMonthKey(""); setDay(""); };
  const pickMonth = (y: number, m: number) => { setMonthKey(`${y}-${String(m).padStart(2, "0")}`); setWeek(""); setDay(""); setCalMonth(m); };
  const pickDay = (iso: string) => {
    setCalOpen(false);
    if (variant === "private") router.push(`/private/daily-log/${iso}`);
    else { setDay(iso); setWeek(""); setMonthKey(""); }
  };

  return (
    <>
      {/* fuzzy search box (searches every field) */}
      <div className="relative mb-3">
        <svg aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={variant === "private" ? "Fuzzy search — every field, including sections" : "Fuzzy search the log…"}
          autoComplete="off"
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-800 dark:bg-neutral-900"
        />
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setRailOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-400">
          {railOpen ? "⟨ Hide filters" : "Filters ⟩"}
        </button>
        <span className="font-mono text-xs text-neutral-400">
          {filtered.length}/{entries.length} days{activeLabel || q ? " · filtered" : ""}
        </span>
      </div>

      <div className={railOpen ? "grid grid-cols-1 items-start gap-8 md:grid-cols-[220px_1fr]" : ""}>
        {railOpen && (
          <aside className="md:sticky md:top-6">
            {/* active filter chip */}
            {activeLabel && (
              <button type="button" onClick={clearAll} className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 font-mono text-xs text-blue-700 hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-300">
                {activeLabel} <span aria-hidden>✕</span>
              </button>
            )}

            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Filter by week</p>
            <select value={week} onChange={(e) => pickWeek(e.target.value)} className="w-full cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 font-mono text-[13px] outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-900">
              <option value="">All weeks</option>
              {weeks.map((w) => (<option key={w.week} value={w.week}>{w.year} · {w.week}</option>))}
            </select>

            <p className="mb-1.5 mt-4 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Browse by month</p>
            <div className="relative">
              <button type="button" onClick={() => setCalOpen((v) => !v)} className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 font-mono text-[13px] transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                <span>📅 {monthKey ? `${MONTHS[Number(monthKey.slice(5)) - 1]} ${monthKey.slice(0, 4)}` : "Pick a month / day"}</span>
                <span aria-hidden className="text-neutral-400">▾</span>
              </button>

              {calOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCalOpen(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                    {/* year header */}
                    <div className="mb-2 flex flex-wrap gap-1">
                      {years.map((y) => (
                        <button key={y} type="button" onClick={() => { setCalYear(y); setCalMonth(null); }} className={`rounded-md px-2 py-0.5 font-mono text-xs ${y === calYear ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>{y}</button>
                      ))}
                    </div>

                    {calMonth === null ? (
                      <div className="grid grid-cols-3 gap-1.5">
                        {MONTHS.map((label, i) => {
                          const m = i + 1;
                          const has = monthsByYear.get(calYear)?.has(m);
                          return (
                            <button key={label} type="button" disabled={!has} onClick={() => pickMonth(calYear, m)} className={`rounded-md py-1.5 font-mono text-xs transition-colors ${has ? "border border-blue-500/30 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40" : "cursor-not-allowed text-neutral-300 opacity-40 dark:text-neutral-600"}`}>{label}</button>
                          );
                        })}
                      </div>
                    ) : (
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <button type="button" onClick={() => setCalMonth(null)} className="font-mono text-xs text-neutral-500 hover:underline">‹ months</button>
                          <span className="font-mono text-xs font-semibold">{MONTHS[calMonth - 1]} {calYear}</span>
                          <span className="w-12" />
                        </div>
                        <MiniCal year={calYear} month={calMonth} days={daysByMonth.get(`${calYear}-${String(calMonth).padStart(2, "0")}`) ?? new Set()} onPick={pickDay} />
                        <p className="mt-2 text-center text-[11px] text-neutral-400">click a highlighted day to {variant === "private" ? "open it" : "filter to it"}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        )}

        {/* vertical timeline of days — persists when filters are hidden */}
        <div className="flex flex-col gap-3">
          {filtered.length === 0 && (
            <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400 dark:border-neutral-700">No days match.</p>
          )}
          {filtered.map((e) => (
            <div key={e.date}>
              {weekMarks.has(e.date) && e.week && (
                <p className="mb-1.5 mt-1 px-0.5 font-mono text-xs tracking-wide text-neutral-400">{e.date.slice(0, 4)} · {e.week}</p>
              )}
              {variant === "private" ? <PrivateDayCard e={e} /> : <PublicDayCard e={e} />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function MiniCal({ year, month, days, onPick }: { year: number; month: number; days: Set<number>; onPick: (iso: string) => void }) {
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const dim = new Date(year, month, 0).getDate();
  const mk = `${year}-${String(month).padStart(2, "0")}`;
  return (
    <div className="grid grid-cols-7 gap-1">
      {DOW.map((d, i) => (<div key={i} className="flex aspect-square items-center justify-center font-mono text-[9px] text-neutral-400">{d}</div>))}
      {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
      {Array.from({ length: dim }).map((_, i) => {
        const d = i + 1;
        const has = days.has(d);
        const iso = `${mk}-${String(d).padStart(2, "0")}`;
        return (
          <button key={iso} type="button" disabled={!has} onClick={() => onPick(iso)} className={`flex aspect-square items-center justify-center rounded-md font-mono text-[10px] ${has ? "cursor-pointer bg-blue-100 font-semibold text-blue-700 hover:ring-1 hover:ring-blue-500 dark:bg-blue-500/20 dark:text-blue-300" : "text-neutral-300 dark:text-neutral-600"}`}>{d}</button>
        );
      })}
    </div>
  );
}

/** Private: a compact card linking to the day's own page (the full record is long). */
function PrivateDayCard({ e }: { e: DailyEntry }) {
  const secN = realSections(e.sections).length;
  const lcN = e.leetcode?.length ?? 0;
  return (
    <Link href={`/private/daily-log/${e.date}`} className="group block rounded-xl border border-neutral-200 p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm font-semibold">{e.date}</span>
        <span className="flex items-center gap-2 font-mono text-xs text-neutral-400">{e.week}<span className="transition-transform group-hover:translate-x-0.5">→</span></span>
      </div>
      {e.summary ? <p className="mt-1.5 text-sm text-neutral-700 dark:text-neutral-300">{e.summary}</p> : <p className="mt-1.5 text-sm italic text-neutral-400">no summary yet</p>}
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
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-sm font-semibold">{e.date}</span>
        {e.week && <span className="font-mono text-xs text-neutral-400">{e.week}</span>}
      </div>
      {e.summary && <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{e.summary}</p>}
      {e.done.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {e.done.map((item) => (<li key={item} className="rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-900">&#10003; {item}</li>))}
        </ul>
      )}
      {e.leetcode && e.leetcode.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {e.leetcode.map((p) =>
            p.solutionUrl ? (
              <a key={p.id} href={p.solutionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-neutral-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50 dark:bg-neutral-900 dark:text-blue-400 dark:hover:bg-blue-950/40">LC {p.id}{p.title ? ` ${p.title}` : ""} <span aria-hidden className="text-[10px] opacity-80">↗</span></a>
            ) : (
              <span key={p.id} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-900">LC {p.id}{p.title ? ` ${p.title}` : ""}</span>
            ),
          )}
        </div>
      )}
      {e.note && <p className="mt-3 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-500 dark:border-neutral-700">📝 {e.note}</p>}
    </article>
  );
}
