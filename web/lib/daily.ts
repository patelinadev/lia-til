// Client-safe helpers for daily-log vault sections (no fs).

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
