import Link from "next/link";
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

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function ApplicationsPage() {
  const maxDay = Math.max(...data.byDate.map((d) => d.count), 1);
  const groups = GROUPS.filter((g) => g.label === "In review" || sum(g.statuses) > 0);

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

      {/* over time */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Applications over time</h2>
        <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="flex items-end justify-between gap-2" style={{ height: 160 }}>
            {data.byDate.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs tabular-nums text-neutral-500">{d.count}</span>
                <div
                  className="w-full rounded-t bg-blue-500/80 dark:bg-blue-400/70"
                  style={{ height: `${(d.count / maxDay) * 120}px` }}
                  title={`${d.date}: ${d.count}`}
                />
                <span className="text-xs tabular-nums text-neutral-400">{shortDate(d.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="mt-6 text-xs text-neutral-400">
        Aggregate counts only — no company names, roles, or other details.
      </p>
    </main>
  );
}
