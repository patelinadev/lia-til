import Link from "next/link";
import { PHASES, reviewedMap, deckSlug } from "./decks";
import { getDecks } from "./data";
import DataError from "@/app/components/DataError";

export const metadata = {
  title: "System Design · Lia's Learning Progress",
};

// Render at request time so newly-imported decks show up without a rebuild.
export const dynamic = "force-dynamic";
// Allow the request to wait out a cold backend start (Render free tier ~40s).
export const maxDuration = 60;

export default async function SystemDesignPage() {
  const decks = await getDecks();

  if (!decks) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
        <Link
          href="/"
          className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
        >
          &larr; Learning Progress
        </Link>
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">System Design</h1>
        <DataError label="the System Design decks" />
      </main>
    );
  }

  const REVIEWED = reviewedMap(decks);
  const doneCount = Object.keys(REVIEWED).length;
  const total = PHASES.reduce((n, p) => n + p.decks.length, 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
      <Link
        href="/"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; Learning Progress
      </Link>

      <div className="mt-6 mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">System Design</h1>
        <p className="text-sm text-neutral-500">
          {doneCount} / {total} decks
        </p>
      </div>
      <p className="mb-8 text-sm text-neutral-500">
        Source: <b className="text-neutral-700 dark:text-neutral-300">System Design Basics</b> — notes
        &amp; diagrams re-drawn from what Lia studied. Click a completed deck to open its notes.
      </p>

      {/* chapter tree */}
      <div className="flex flex-col gap-6">
        {PHASES.map((phase) => (
          <div key={phase.key}>
            <p className="mb-2 text-sm font-semibold">
              <span className="font-mono text-neutral-400">{phase.key}</span> · {phase.label}
            </p>
            <ul className="flex flex-col">
              {phase.decks.map(([n, name]) => {
                const done = n in REVIEWED;
                const slug = deckSlug(decks, n);
                return (
                  <li key={n}>
                    {done && slug ? (
                      <Link
                        href={`/system-design/${slug}`}
                        className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      >
                        <span className="w-6 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                          ✓
                        </span>
                        <span className="font-medium group-hover:underline">{name}</span>
                        <span className="ml-auto font-mono text-xs text-neutral-400">
                          {REVIEWED[n]}
                        </span>
                        <span className="text-neutral-400 transition-transform group-hover:translate-x-0.5">
                          &rarr;
                        </span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-2 py-2 text-sm">
                        <span className="w-6 text-right font-mono text-xs text-neutral-400">{n}</span>
                        <span className="text-neutral-400 dark:text-neutral-600">{name}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
