import Link from "next/link";
import {
  getLeetcode,
  problemUrl,
  STATUS_CATEGORY,
  type Difficulty,
  type StatusCategory,
} from "@/lib/content";

export const metadata = {
  title: "LeetCode · Lia's Learning Progress",
};

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  Medium: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Hard: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
};

const STATUS_STYLES: Record<StatusCategory, string> = {
  Complete: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  "In Progress": "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  "To Do": "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export default function LeetCodePage() {
  const { track, trackUrl, problems } = getLeetcode();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
      <Link
        href="/"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; Learning Progress
      </Link>

      <div className="mt-6 mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">LeetCode</h1>
        <p className="text-sm text-neutral-500">
          <a href={trackUrl} className="hover:underline" target="_blank" rel="noopener noreferrer">
            {track}
          </a>{" "}
          &middot; {problems.length} solved
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Problem</th>
              <th className="px-4 py-3 font-medium">Topic</th>
              <th className="px-4 py-3 font-medium">Difficulty</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Solution</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p) => (
              <tr
                key={p.id}
                className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
              >
                <td className="px-4 py-3 tabular-nums text-neutral-500">{p.id}</td>
                <td className="px-4 py-3 font-medium">
                  <a
                    href={problemUrl(p.slug)}
                    className="hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.title}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {p.topics.map((t) => (
                      <span
                        key={t}
                        className="whitespace-nowrap rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_STYLES[p.difficulty]}`}
                  >
                    {p.difficulty}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[STATUS_CATEGORY[p.status]]}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-neutral-500">
                  {formatDate(p.date)}
                </td>
                <td className="px-4 py-3">
                  {p.solutionUrl ? (
                    <a
                      href={p.solutionUrl}
                      className="whitespace-nowrap text-blue-600 hover:underline dark:text-blue-400"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Solution &#8599;
                    </a>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        Topics are multi-select tags &middot; Status: Complete (Second pass) / In Progress (First
        pass, Need review) / To&nbsp;Do (Passed after read, Don&rsquo;t understand)
      </p>
    </main>
  );
}
