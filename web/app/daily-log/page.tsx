import Link from "next/link";
import Reveal from "@/app/components/Reveal";
import { getLog, getLeetcode } from "@/lib/content.server";
import type { LogEntry } from "@/lib/content";

export const metadata = {
  title: "Daily Log · Lia's Learning Progress",
};

// Always render at request time so the timeline shows the latest data from the API.
export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/** Fetch curated daily-log entries from the backend at request time; fall back
 * to the committed files if API_URL is unset or the API is unreachable. */
async function getDailyLog(): Promise<LogEntry[]> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  if (base) {
    try {
      const res = await fetch(`${base}/api/daily-log`, { cache: "no-store" });
      if (res.ok) return (await res.json()) as LogEntry[];
    } catch {
      // fall through to the committed snapshot
    }
  }
  return getLog();
}

export default async function DailyLogPage() {
  const log = await getDailyLog();
  // Single source for solution links: look them up from leetcode.json by id,
  // so adding a solution there auto-fills the daily log too.
  const solutionById = new Map(
    getLeetcode().problems.map((p) => [p.id, p.solutionUrl] as const),
  );

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12 sm:py-16">
      <Link
        href="/"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; Learning Progress
      </Link>

      <h1 className="mt-6 mb-10 text-3xl font-bold sm:text-4xl">Daily Log</h1>

      {/* tree-trunk timeline */}
      <ol className="relative">
        {/* the trunk */}
        <span
          aria-hidden
          className="absolute bottom-2 left-2 top-2 w-px bg-neutral-200 dark:bg-neutral-800"
        />

        {log.map((entry, i) => (
          <li key={entry.date} className="relative pb-10 pl-10 last:pb-0">
            {/* node dot on the trunk */}
            <span
              aria-hidden
              className="absolute left-2 top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-neutral-400 bg-white ring-4 ring-white dark:border-neutral-500 dark:bg-neutral-950 dark:ring-neutral-950"
            />

            <Reveal delay={Math.min(i, 6) * 60}>
              <p className="font-mono text-sm text-neutral-500">
                {entry.week} &middot; {formatDate(entry.date)}
              </p>

              {entry.done.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {entry.done.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-900"
                    >
                      &#10003; {item}
                    </li>
                  ))}
                </ul>
              )}

              {entry.leetcode && entry.leetcode.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {entry.leetcode.map((p) => {
                    const solution = solutionById.get(p.id) ?? p.solutionUrl ?? null;
                    return (
                      <li
                        key={p.slug}
                        className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-900"
                      >
                        <span aria-hidden>&#10003;</span>
                        {solution ? (
                          <a
                            href={solution}
                            className="font-medium hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            LC {p.id} · {p.title} &#8599;
                          </a>
                        ) : (
                          <span className="font-medium">
                            LC {p.id} · {p.title}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {entry.summary && (
                <p className="mt-3 text-neutral-600 dark:text-neutral-400">{entry.summary}</p>
              )}

              {entry.note && (
                <p className="mt-3 text-neutral-600 dark:text-neutral-400">
                  &#128221; {entry.note}
                </p>
              )}
            </Reveal>
          </li>
        ))}
      </ol>
    </main>
  );
}
