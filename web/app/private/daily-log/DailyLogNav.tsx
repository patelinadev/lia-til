"use client";

import { useMemo, useState } from "react";
import type { FullDailyLogEntry } from "@/lib/private";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const dayId = (iso: string) => `day-${iso}`;
const weekId = (week: string) => `wk-${week}`;

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function DailyLogNav({ entries }: { entries: FullDailyLogEntry[] }) {
  // days-with-entries per "YYYY-MM", the set of years, and default selection.
  const { daysByMonth, years } = useMemo(() => {
    const dbm: Record<string, Set<number>> = {};
    for (const e of entries) {
      const mk = e.date.slice(0, 7);
      (dbm[mk] ??= new Set()).add(Number(e.date.slice(8, 10)));
    }
    const yrs = [...new Set(entries.map((e) => Number(e.date.slice(0, 4))))].sort((a, b) => b - a);
    return { daysByMonth: dbm, years: yrs };
  }, [entries]);

  const [selYear, setSelYear] = useState(() => Number(entries[0]?.date.slice(0, 4)) || years[0]);
  const [selMonth, setSelMonth] = useState(() => Number(entries[0]?.date.slice(5, 7)) || 1);
  const [flashDate, setFlashDate] = useState<string | null>(null);

  const monthsWithData = (year: number) =>
    new Set(
      Object.keys(daysByMonth)
        .filter((mk) => Number(mk.slice(0, 4)) === year)
        .map((mk) => Number(mk.slice(5, 7))),
    );

  function pickYear(year: number) {
    setSelYear(year);
    const has = monthsWithData(year);
    if (!has.has(selMonth) && has.size > 0) setSelMonth(Math.max(...has));
  }

  function jumpToDay(iso: string) {
    scrollToId(dayId(iso));
    setFlashDate(iso);
    window.setTimeout(() => setFlashDate((cur) => (cur === iso ? null : cur)), 1400);
  }

  // dates that begin a new week block (first entry of each week, top-down)
  const weekMarkerDates = useMemo(() => {
    const marks = new Set<string>();
    let prev: string | null = null;
    for (const e of entries) {
      if (e.week && e.week !== prev) marks.add(e.date);
      if (e.week) prev = e.week;
    }
    return marks;
  }, [entries]);

  // week dropdown options (in the entries' newest-first order, de-duped)
  const weeks = useMemo(() => {
    const seen = new Set<string>();
    const out: { week: string; year: string; count: number }[] = [];
    for (const e of entries) {
      if (!e.week) continue;
      if (!seen.has(e.week)) {
        seen.add(e.week);
        out.push({ week: e.week, year: e.date.slice(0, 4), count: 0 });
      }
      out[out.findIndex((w) => w.week === e.week)].count += 1;
    }
    return out;
  }, [entries]);

  // mini calendar cells for the selected year+month
  const monthKey = `${selYear}-${String(selMonth).padStart(2, "0")}`;
  const hasDays = daysByMonth[monthKey] ?? new Set<number>();
  const lead = (new Date(selYear, selMonth - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const yearMonths = monthsWithData(selYear);

  return (
    <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[220px_1fr]">
      {/* left rail */}
      <aside className="sticky top-6 hidden max-h-[calc(100vh-3rem)] overflow-y-auto pr-1 md:block">
        {/* jump to week */}
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Jump to week</h3>
        <select
          defaultValue=""
          onChange={(e) => e.target.value && scrollToId(weekId(e.target.value))}
          className="mb-6 w-full cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2 font-mono text-[13px] outline-none focus:border-blue-500 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <option value="">Select a week…</option>
          {weeks.map((w) => (
            <option key={w.week} value={w.week}>
              {w.year} · {w.week} ({w.count} {w.count > 1 ? "days" : "day"})
            </option>
          ))}
        </select>

        {/* year → month → day */}
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Pick a day</h3>
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => pickYear(y)}
              aria-pressed={y === selYear}
              className={`rounded-full border px-2.5 py-1 font-mono text-xs transition-colors ${
                y === selYear
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        <div className="mb-3.5 grid grid-cols-4 gap-1.5">
          {MONTHS.map((label, i) => {
            const m = i + 1;
            const has = yearMonths.has(m);
            const active = m === selMonth;
            return (
              <button
                key={label}
                type="button"
                disabled={!has}
                onClick={() => setSelMonth(m)}
                className={`rounded-full border py-1 text-center font-mono text-xs transition-colors ${
                  active
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : has
                      ? "border-blue-500/35 text-blue-700 hover:border-blue-500 dark:text-blue-400"
                      : "cursor-not-allowed border-neutral-200 text-neutral-300 opacity-40 dark:border-neutral-800 dark:text-neutral-600"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* mini calendar */}
        <p className="mb-1.5 text-xs font-semibold">
          {MONTHS[selMonth - 1]} {selYear}
        </p>
        <div className="grid grid-cols-7 gap-1">
          {DOW.map((d, i) => (
            <div key={i} className="flex aspect-square items-center justify-center font-mono text-[9px] text-neutral-400">
              {d}
            </div>
          ))}
          {Array.from({ length: lead }).map((_, i) => (
            <div key={`lead-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const iso = `${monthKey}-${String(d).padStart(2, "0")}`;
            const has = hasDays.has(d);
            return (
              <button
                key={iso}
                type="button"
                disabled={!has}
                onClick={() => jumpToDay(iso)}
                title={has ? iso : undefined}
                className={`flex aspect-square items-center justify-center rounded-md font-mono text-[10px] ${
                  has
                    ? "cursor-pointer bg-blue-100 font-semibold text-blue-700 hover:ring-1 hover:ring-blue-500 dark:bg-blue-500/20 dark:text-blue-300"
                    : "text-neutral-300 dark:text-neutral-600"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </aside>

      {/* day cards */}
      <div className="flex flex-col gap-3.5">
        {entries.map((e) => {
          const marker = weekMarkerDates.has(e.date) ? e.week : null;
          return (
            <div key={e.date}>
              {marker && (
                <div
                  id={weekId(marker)}
                  className="mb-1.5 scroll-mt-20 px-0.5 font-mono text-xs tracking-wide text-neutral-400"
                >
                  {e.date.slice(0, 4)} · {marker}
                </div>
              )}
              <article
                id={dayId(e.date)}
                className={`scroll-mt-20 rounded-xl border p-5 transition-all ${
                  flashDate === e.date
                    ? "border-blue-500 ring-2 ring-blue-500/20"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-mono text-sm font-semibold">{e.date}</h2>
                  {e.week && <span className="font-mono text-xs text-neutral-400">{e.week}</span>}
                </div>
                {e.summary && <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{e.summary}</p>}
                {e.done.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {e.done.map((d, i) => (
                      <li key={i} className="flex gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                        <span aria-hidden className="text-emerald-500">
                          ✓
                        </span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {e.leetcode.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.leetcode.map((p) => {
                      const url = p.solutionUrl ?? null;
                      const label = `LC ${p.id}${p.title ? ` ${p.title}` : ""}`;
                      return url ? (
                        <a
                          key={p.id}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-neutral-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50 dark:bg-neutral-900 dark:text-blue-400 dark:hover:bg-blue-950/40"
                        >
                          {label} <span aria-hidden className="text-[10px] opacity-80">↗</span>
                        </a>
                      ) : (
                        <span
                          key={p.id}
                          className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-900"
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
                {e.note && (
                  <p className="mt-3 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-500 dark:border-neutral-700">
                    📝 {e.note}
                  </p>
                )}
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}
