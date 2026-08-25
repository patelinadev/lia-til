import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getFullDailyLog } from "@/lib/private";
import { realSections } from "@/lib/daily";
import SectionBody from "@/app/components/SectionBody";
import DataError from "@/app/components/DataError";

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

      <DayNav older={older} newer={newer} className="mt-4" />

      <div className="mt-4 mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold sm:text-3xl">{e.date}</h1>
        {e.week && <span className="font-mono text-sm text-neutral-400">{e.week}</span>}
      </div>
      {e.summary && <p className="mb-6 text-neutral-700 dark:text-neutral-300">{e.summary}</p>}

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

      <DayNav older={older} newer={newer} className="mt-8 border-t border-neutral-200 pt-5 dark:border-neutral-800" />
    </main>
  );
}

/** Prev (older) / next (newer) day links — moves between logged days only. */
function DayNav({ older, newer, className = "" }: { older?: string; newer?: string; className?: string }) {
  const link =
    "inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-400";
  return (
    <nav className={`flex items-center justify-between gap-3 ${className}`}>
      {older ? (
        <Link href={`/private/daily-log/${older}`} className={link}>
          <span aria-hidden>&larr;</span>
          <span className="font-mono text-xs">{older}</span>
          <span className="text-neutral-400">prev day</span>
        </Link>
      ) : (
        <span className="text-xs text-neutral-300 dark:text-neutral-600">&larr; earliest</span>
      )}
      {newer ? (
        <Link href={`/private/daily-log/${newer}`} className={link}>
          <span className="text-neutral-400">next day</span>
          <span className="font-mono text-xs">{newer}</span>
          <span aria-hidden>&rarr;</span>
        </Link>
      ) : (
        <span className="text-xs text-neutral-300 dark:text-neutral-600">latest &rarr;</span>
      )}
    </nav>
  );
}
