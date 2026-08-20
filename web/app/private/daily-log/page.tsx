import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getFullDailyLog } from "@/lib/private";

export const metadata = {
  title: "Private · Daily Log",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PrivateDailyLogPage() {
  await requireAdmin();
  const entries = await getFullDailyLog();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/private"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; Private
      </Link>

      <div className="mt-6 mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Daily Log</h1>
        <p className="text-sm text-neutral-500">{entries.length} days</p>
      </div>
      <p className="mb-8 max-w-2xl text-sm text-neutral-500">
        The full log, day by day. The public
        <Link href="/daily-log" className="mx-1 underline hover:text-neutral-800 dark:hover:text-neutral-300">
          /daily-log
        </Link>
        timeline shows only the curated items.
      </p>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
          No entries returned. Check that <code>BACKEND_SECRET</code> matches between Vercel and Render.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {entries.map((e) => (
            <article
              key={e.date}
              className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
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
                  {e.leetcode.map((p) =>
                    p.solutionUrl ? (
                      <a
                        key={p.id}
                        href={p.solutionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs hover:underline dark:bg-neutral-900"
                      >
                        LC {p.id} {p.title}
                      </a>
                    ) : (
                      <span
                        key={p.id}
                        className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-900"
                      >
                        LC {p.id} {p.title}
                      </span>
                    ),
                  )}
                </div>
              )}
              {e.note && (
                <p className="mt-3 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-500 dark:border-neutral-700">
                  📝 {e.note}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
