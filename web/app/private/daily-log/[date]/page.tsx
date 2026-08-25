import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getFullDailyLog } from "@/lib/private";
import { realSections, allTags, autoTags } from "@/lib/daily";
import SectionBody from "@/app/components/SectionBody";
import DataError from "@/app/components/DataError";
import TagChips from "@/app/components/TagChips";

export const dynamic = "force-dynamic";
// Allow the request to wait out a cold backend start (Render free tier ~40s).
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return { title: `${date} · Daily Log`, robots: { index: false, follow: false } };
}

export default async function PrivateDayPage({ params }: { params: Promise<{ date: string }> }) {
  await requireAdmin();
  const { date } = await params;
  const entries = await getFullDailyLog();

  const back = (
    <Link
      href="/private/daily-log"
      className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
    >
      &larr; Daily Log
    </Link>
  );

  if (entries === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        {back}
        <DataError label={`the log for ${date}`} />
      </main>
    );
  }

  // entries are newest-first; find this day and its logged neighbours (skipping
  // any calendar gaps) so we can page prev/next without returning to the list.
  const idx = entries.findIndex((x) => x.date === date);
  if (idx === -1) notFound();
  const e = entries[idx];
  const newer = idx > 0 ? entries[idx - 1].date : undefined; // the day after
  const older = idx < entries.length - 1 ? entries[idx + 1].date : undefined; // the day before

  const secs = realSections(e.sections);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      {back}

      <DaySideNav older={older} newer={newer} />

      <div className="mt-6 mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold sm:text-3xl">{e.date}</h1>
        {e.week && <span className="font-mono text-sm text-neutral-400">{e.week}</span>}
      </div>
      {e.summary && <p className="mt-1 text-neutral-700 dark:text-neutral-300">{e.summary}</p>}

      <TagChips tags={allTags(e.tags, e.sections)} auto={autoTags(e.sections)} className="mb-6 mt-3" />

      {/* curated fields */}
      {e.done.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1.5">
          {e.done.map((d, i) => (
            <li key={i} className="flex gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <span aria-hidden className="text-emerald-500">✓</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
      {e.leetcode.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {e.leetcode.map((p) =>
            p.solutionUrl ? (
              <a key={p.id} href={p.solutionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-neutral-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50 dark:bg-neutral-900 dark:text-blue-400 dark:hover:bg-blue-950/40">
                LC {p.id}{p.title ? ` ${p.title}` : ""} <span aria-hidden className="text-[10px] opacity-80">↗</span>
              </a>
            ) : (
              <span key={p.id} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-900">
                LC {p.id}{p.title ? ` ${p.title}` : ""}
              </span>
            ),
          )}
        </div>
      )}
      {e.note && (
        <p className="mb-4 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-500 dark:border-neutral-700">📝 {e.note}</p>
      )}

      {/* full private record — one card per non-empty section */}
      {secs.length > 0 ? (
        <div className="mt-6 flex flex-col gap-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">Full record · private</p>
          {secs.map(([heading, content]) => (
            <details key={heading} open className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <summary className="cursor-pointer select-none font-semibold">{heading}</summary>
              <div className="mt-2">
                <SectionBody md={content} />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-neutral-400">No sections recorded for this day.</p>
      )}
    </main>
  );
}

/**
 * Fixed vertical day-pager pinned to the right edge:
 *   ↑ = next day (newer) · ↓ = previous day (older).
 * Moves between logged days only; ends are shown disabled.
 */
function DaySideNav({ older, newer }: { older?: string; newer?: string }) {
  const btn =
    "flex h-11 w-11 items-center justify-center text-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";
  const off = "flex h-11 w-11 items-center justify-center text-xl text-neutral-300 dark:text-neutral-700";
  return (
    <nav
      aria-label="Adjacent days"
      className="fixed right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white/90 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90"
    >
      {newer ? (
        <Link href={`/private/daily-log/${newer}`} className={btn} title={`Next day · ${newer}`} aria-label={`Next day ${newer}`}>
          &uarr;
        </Link>
      ) : (
        <span className={off} title="Latest — no newer day" aria-hidden>&uarr;</span>
      )}
      <span className="mx-2 h-px bg-neutral-200 dark:bg-neutral-800" />
      {older ? (
        <Link href={`/private/daily-log/${older}`} className={btn} title={`Previous day · ${older}`} aria-label={`Previous day ${older}`}>
          &darr;
        </Link>
      ) : (
        <span className={off} title="Earliest — no older day" aria-hidden>&darr;</span>
      )}
    </nav>
  );
}
