import Link from "next/link";
import Reveal from "@/app/components/Reveal";
import { getLog, problemUrl } from "@/lib/content";

export const metadata = {
  title: "Daily Log · Lia's Learning Progress",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export default function DailyLogPage() {
  const log = getLog();

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
                <ul className="mt-3 flex flex-col gap-1.5">
                  {entry.leetcode.map((p) => (
                    <li key={p.slug} className="text-sm">
                      <a
                        href={problemUrl(p.slug)}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        LC {p.id} · {p.title}
                      </a>
                      {p.solutionUrl && (
                        <a
                          href={p.solutionUrl}
                          className="ml-2 text-neutral-500 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          solution &#8599;
                        </a>
                      )}
                    </li>
                  ))}
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
