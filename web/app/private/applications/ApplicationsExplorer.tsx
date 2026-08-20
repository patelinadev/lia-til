"use client";

import { useMemo, useState } from "react";
import { fuzzyMatch } from "@/lib/content";
import type { FullApplication } from "@/lib/private";

// Pill colors for the real ledger statuses. Unknown statuses fall back to neutral.
const STATUS_COLOR: Record<string, string> = {
  Applied: "text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/60",
  Rejected: "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/60",
  Ghosted: "text-neutral-500 bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800",
  OA: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/60",
  Phone: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/60",
  "HR call": "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/60",
  Onsite: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/60",
  Offer: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/60",
};
// The proportion bar's fill color per status (order defines the bar's segment order).
const BAR_COLOR: Record<string, string> = {
  Applied: "bg-blue-500",
  OA: "bg-emerald-500",
  Phone: "bg-amber-500",
  "HR call": "bg-amber-500",
  Onsite: "bg-emerald-600",
  Offer: "bg-emerald-600",
  Rejected: "bg-rose-500",
  Ghosted: "bg-neutral-400",
};

function pillClass(status: string | null): string {
  return STATUS_COLOR[status ?? ""] ?? "text-neutral-500 bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800";
}

/** Split `text` on the query's tokens and wrap the matches in <mark>. Substring
 * highlight only (subsequence hits still filter the row, they just aren't marked). */
function Highlight({ text, query }: { text: string | null; query: string }) {
  const value = text ?? "";
  const tokens = [...new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean))];
  if (tokens.length === 0) return <>{value}</>;
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = value.split(new RegExp(`(${escaped.join("|")})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        tokens.includes(part.toLowerCase()) ? (
          <mark key={i} className="rounded-sm bg-blue-100 font-medium text-inherit dark:bg-blue-500/25">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function ApplicationsExplorer({ apps }: { apps: FullApplication[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("All");

  // Statuses present in the data, with counts — for the filter chips.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of apps) counts[a.status ?? "—"] = (counts[a.status ?? "—"] ?? 0) + 1;
    return counts;
  }, [apps]);

  // Applied / Rejected first (the two Lia filters on most), then the rest by count.
  const statusOrder = useMemo(() => {
    const priority = ["Applied", "Rejected"];
    const rest = Object.keys(statusCounts)
      .filter((s) => !priority.includes(s))
      .sort((a, b) => statusCounts[b] - statusCounts[a]);
    return [...priority.filter((s) => s in statusCounts), ...rest];
  }, [statusCounts]);

  const rows = useMemo(() => {
    return apps.filter((a) => {
      if (status !== "All" && (a.status ?? "—") !== status) return false;
      const blob = [a.company, a.role, a.notes].filter(Boolean).join(" ");
      if (!fuzzyMatch(q, blob)) return false;
      return true;
    });
  }, [apps, q, status]);

  // Stats over the currently shown rows.
  const shownByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of rows) counts[a.status ?? "—"] = (counts[a.status ?? "—"] ?? 0) + 1;
    return counts;
  }, [rows]);
  const barOrder = Object.keys(BAR_COLOR).filter((s) => shownByStatus[s]);

  return (
    <>
      {/* fuzzy search */}
      <div className="relative mb-3">
        <svg
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Fuzzy search — company · role · notes (e.g. backend engineer, AI)"
          autoComplete="off"
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-800 dark:bg-neutral-900"
        />
      </div>

      {/* status filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["All", ...statusOrder].map((s) => {
          const active = status === s;
          const n = s === "All" ? apps.length : statusCounts[s];
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(s)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                  : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500"
              }`}
            >
              {s !== "All" && (
                <span className={`h-1.5 w-1.5 rounded-full ${BAR_COLOR[s] ?? "bg-neutral-400"}`} />
              )}
              {s}
              <span className="font-mono text-[11px] opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900/50">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Résumé</th>
              <th className="px-3 py-2 font-medium">Applied</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.appNum} className="border-t border-neutral-100 align-top dark:border-neutral-800/60">
                <td className="px-3 py-2 font-mono text-xs text-neutral-400">{a.appNum}</td>
                <td className="px-3 py-2 font-medium">
                  <Highlight text={a.company} query={q} />
                </td>
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                  <Highlight text={a.role} query={q} />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-500">{a.resume}</td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-500">{a.appliedDate}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${pillClass(a.status)}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                  <div className="max-h-20 max-w-[260px] overflow-y-auto whitespace-pre-wrap pr-1 text-[13px] leading-snug">
                    <Highlight text={a.notes} query={q} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-neutral-400">No applications match these filters.</p>
        )}
      </div>

      {/* spacer so the fixed stats bar never covers the last rows */}
      <div className="h-24" />

      {/* sticky stats bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-7 gap-y-2 px-6 py-3">
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-xl font-bold tabular-nums">{rows.length}</span>
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">Showing</span>
          </div>
          <div className="h-8 w-px self-center bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              {barOrder.map((s) => (
                <span
                  key={s}
                  className={BAR_COLOR[s]}
                  style={{ width: `${(shownByStatus[s] / rows.length) * 100}%` }}
                  title={`${s} ${shownByStatus[s]}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-0.5 font-mono text-[11px] text-neutral-500">
              {barOrder.map((s) => {
                const pct = Math.round((shownByStatus[s] / rows.length) * 100);
                return (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-[2px] ${BAR_COLOR[s]}`} />
                    {s} <b className={s === "Rejected" ? "text-rose-600 dark:text-rose-400" : "text-neutral-700 dark:text-neutral-300"}>{shownByStatus[s]}</b>
                    <span className="text-neutral-400">· {pct}%</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
