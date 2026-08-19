import Link from "next/link";
import Reveal from "@/app/components/Reveal";
import applicationsData from "@/content/applications.json";
import type { ApplicationsData } from "@/lib/content";

export const metadata = {
  title: "Applications · Lia's Learning Progress",
};

const data = applicationsData as ApplicationsData;

// group the raw statuses into a simple funnel
const GROUPS: { label: string; statuses: string[]; className: string }[] = [
  { label: "In review", statuses: ["Applied"], className: "text-blue-700 dark:text-blue-400" },
  {
    label: "Interview stage",
    statuses: ["OA", "Phone", "Onsite"],
    className: "text-amber-700 dark:text-amber-400",
  },
  { label: "Offers", statuses: ["Offer"], className: "text-emerald-700 dark:text-emerald-400" },
  {
    label: "Closed",
    statuses: ["Rejected", "Ghosted"],
    className: "text-neutral-600 dark:text-neutral-400",
  },
];

function sum(statuses: string[]): number {
  return statuses.reduce((n, s) => n + (data.byStatus[s] ?? 0), 0);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export default function ApplicationsPage() {
  const groups = GROUPS.filter((g) => g.label === "In review" || sum(g.statuses) > 0);
  const days = [...data.byDate].reverse(); // newest first

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
      <Link
        href="/"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; Learning Progress
      </Link>

      <div className="mt-6 mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Applications</h1>
        {data.updatedAt && (
          <p className="text-sm text-neutral-500">Updated {data.updatedAt}</p>
        )}
      </div>

      {/* hero total */}
      <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          Applications submitted
        </p>
        <p className="mt-1 text-5xl font-bold tabular-nums sm:text-6xl">{data.totalSubmitted}</p>
      </div>

      {/* status funnel */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {groups.map((g) => (
          <div
            key={g.label}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <p className={`text-2xl font-semibold tabular-nums ${g.className}`}>{sum(g.statuses)}</p>
            <p className="mt-1 text-sm text-neutral-500">{g.label}</p>
          </div>
        ))}
      </div>

      {/* over time — vertical timeline, newest first, scroll for the full history */}
      <section className="mt-10">
        <h2 className="mb-6 text-lg font-semibold">Applications over time</h2>
        <ol className="relative">
          {/* the trunk */}
          <span
            aria-hidden
            className="absolute bottom-2 left-2 top-2 w-px bg-neutral-200 dark:bg-neutral-800"
          />

          {days.map((d, i) => (
            <li key={d.date} className="relative pb-8 pl-10 last:pb-0">
              {/* node dot on the trunk */}
              <span
                aria-hidden
                className="absolute left-2 top-1.5 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-neutral-400 bg-white ring-4 ring-white dark:border-neutral-500 dark:bg-neutral-950 dark:ring-neutral-950"
              />
              <Reveal delay={Math.min(i, 8) * 50}>
                <p className="font-mono text-sm text-neutral-500">{formatDate(d.date)}</p>
                <p className="mt-1">
                  <span className="text-2xl font-semibold tabular-nums">{d.count}</span>{" "}
                  <span className="text-sm text-neutral-500">
                    application{d.count === 1 ? "" : "s"}
                  </span>
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-8 text-xs text-neutral-400">
        Aggregate counts only — no company names, roles, or other details.
      </p>
    </main>
  );
}
