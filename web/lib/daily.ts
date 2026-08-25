// Client-safe helpers for daily-log vault sections + filtering (no fs).
import { fuzzyMatch } from "./content";

/**
 * True only if a section has *real* content — not just template scaffolding
 * (sub-headings + empty `-` bullets), like an untouched Success Diary:
 *   ### Today's wins
 *   -
 *   ### What I did
 *   -
 * Such a section is treated as empty (no toggle rendered).
 */
export function sectionHasContent(md?: string | null): boolean {
  if (!md) return false;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) continue; // sub-heading scaffold
    const stripped = line
      .replace(/^[-*]\s*\[[ xX]\]\s*/, "") // checkbox marker
      .replace(/^[-*]\s+/, "") // bullet marker
      .replace(/^[-*]$/, "") // bare bullet
      .trim();
    if (stripped) return true;
  }
  return false;
}

/** Non-empty, non-internal sections in display order: [heading, content][]. */
export function realSections(
  sections?: Record<string, string> | null,
): [string, string][] {
  if (!sections) return [];
  return Object.entries(sections).filter(
    ([k, v]) => k !== "_preamble" && sectionHasContent(v),
  );
}

// ---- shared daily-log filtering (used by the list AND the per-day pager) -----
export type FilterableEntry = {
  date: string;
  week: string | null;
  done: string[];
  summary: string | null;
  note: string | null;
  tags?: string[] | null;
  leetcode?: { id: number; title?: string }[] | null;
  sections?: Record<string, string> | null;
};

/** One active week/month/day at a time, plus fuzzy + tri-state tags. */
export type DailyFilter = {
  q: string;
  week: string;
  month: string; // "YYYY-MM"
  day: string; // "YYYY-MM-DD"
  tin: string[]; // tags that must be present
  tex: string[]; // tags that must be absent
};

export const EMPTY_FILTER: DailyFilter = { q: "", week: "", month: "", day: "", tin: [], tex: [] };

export function searchBlob(e: FilterableEntry): string {
  const parts: (string | null | undefined)[] = [e.date, e.week, e.summary, e.note, ...(e.done ?? [])];
  parts.push(...(e.tags ?? []));
  for (const p of e.leetcode ?? []) parts.push(`LC ${p.id} ${p.title ?? ""}`);
  for (const [k, v] of realSections(e.sections)) parts.push(`${k} ${v}`);
  return parts.filter(Boolean).join(" ");
}

export function matchesFilter(e: FilterableEntry, f: DailyFilter): boolean {
  if (f.week && e.week !== f.week) return false;
  if (f.month && e.date.slice(0, 7) !== f.month) return false;
  if (f.day && e.date !== f.day) return false;
  const tags = e.tags ?? [];
  for (const t of f.tin) if (!tags.includes(t)) return false;
  for (const t of f.tex) if (tags.includes(t)) return false;
  return fuzzyMatch(f.q, searchBlob(e));
}

export function filterEntries<T extends FilterableEntry>(entries: T[], f: DailyFilter): T[] {
  return entries.filter((e) => matchesFilter(e, f));
}

/** Parse a DailyFilter from URL search params (compact keys). */
export function parseFilter(sp: URLSearchParams): DailyFilter {
  const csv = (k: string) => (sp.get(k) ? sp.get(k)!.split(",").filter(Boolean) : []);
  return {
    q: sp.get("q") ?? "",
    week: sp.get("w") ?? "",
    month: sp.get("m") ?? "",
    day: sp.get("d") ?? "",
    tin: csv("tin"),
    tex: csv("tex"),
  };
}

/** Serialize a DailyFilter to a query string ("" when empty), incl. leading "?". */
export function filterToQuery(f: DailyFilter): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.week) p.set("w", f.week);
  if (f.month) p.set("m", f.month);
  if (f.day) p.set("d", f.day);
  if (f.tin.length) p.set("tin", f.tin.join(","));
  if (f.tex.length) p.set("tex", f.tex.join(","));
  const s = p.toString();
  return s ? `?${s}` : "";
}
