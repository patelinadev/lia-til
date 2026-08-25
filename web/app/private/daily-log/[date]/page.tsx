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

  const e = entries.find((x) => x.date === date);
  if (!e) notFound();

  const secs = realSections(e.sections);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      {back}

      <div className="mt-6 mb-2 flex flex-wrap items-baseline justify-between gap-3">
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
    </main>
  );
}
