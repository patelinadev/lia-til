import { getLeetcode, getLog, problemUrl, type Difficulty } from "@/lib/content";

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  Medium: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Hard: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export default function Home() {
  const { track, trackUrl, problems } = getLeetcode();
  const log = getLog();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
      <header className="mb-12">
        <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          Today I Learn
        </p>
        <h1 className="mt-2 text-4xl font-bold sm:text-5xl">
          Lia&rsquo;s Learning Progress
        </h1>
        <p className="mt-3 max-w-xl text-neutral-500">
          A daily log of what Lia is learning. Open to anyone &mdash; no login required.
        </p>
      </header>

      {/* ---------- LeetCode ---------- */}
      <section className="mb-14">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold">LeetCode</h2>
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
                <th className="px-4 py-3 font-medium">Pattern</th>
                <th className="px-4 py-3 font-medium">Difficulty</th>
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
                  <td className="px-4 py-3 text-neutral-500">{p.pattern}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_STYLES[p.difficulty]}`}
                    >
                      {p.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={p.solutionUrl}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Solution &#8599;
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Daily Log ---------- */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold">Daily Log</h2>
        <ol className="space-y-4">
          {log.map((entry) => (
            <li
              key={entry.date}
              className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
            >
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

              {entry.summary && (
                <p className="mt-3 text-neutral-600 dark:text-neutral-400">{entry.summary}</p>
              )}

              {entry.note && (
                <p className="mt-3 text-neutral-600 dark:text-neutral-400">
                  &#128221; {entry.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
