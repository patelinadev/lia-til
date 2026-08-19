import Link from "next/link";
import applicationsData from "@/content/applications.json";
import type { ApplicationsData } from "@/lib/content";

export const metadata = {
  title: "Applications · Lia's Learning Progress",
};

const data = applicationsData as ApplicationsData;

// Group the known statuses into a funnel. We deliberately do NOT show an
// "in review" count — an application's real state is unknown until it becomes
// an OA/response or a rejection. "Heard back" = early responses (they reacted);
// "Interviewing" = actual interview rounds; "Closed" = rejections.
const GROUPS: { label: string; hint: string; statuses: string[]; className: string }[] = [
  {
    label: "Heard back",
    hint: "OA / recruiter call",
    statuses: ["OA", "HR call"],
    className: "text-amber-700 dark:text-amber-400",
  },
  {
    label: "Interviewing",
    hint: "phone / onsite rounds",
    statuses: ["Phone", "Onsite"],
    className: "text-emerald-700 dark:text-emerald-400",
  },
  {
    label: "Offers",
    hint: "",
    statuses: ["Offer"],
    className: "text-emerald-700 dark:text-emerald-400",
  },
  {
    label: "Closed",
    hint: "rejected / ghosted",
    statuses: ["Rejected", "Ghosted"],
    className: "text-neutral-500 dark:text-neutral-400",
  },
];

function sum(statuses: string[]): number {
  return statuses.reduce((n, s) => n + (data.byStatus[s] ?? 0), 0);
}

function breakdown(statuses: string[]): string {
  const parts = statuses
    .filter((s) => (data.byStatus[s] ?? 0) > 0)
    .map((s) => `${s} ${data.byStatus[s]}`);
  return parts.join(" · ");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Cell = { day: number; count: number } | null;

/** Build one Monday-start calendar grid per month that has data. */
function buildMonths(byDate: { date: string; count: number }[]) {
  const counts = new Map(byDate.map((d) => [d.date, d.count]));
  const monthKeys = [...new Set(byDate.map((d) => d.date.slice(0, 7)))].sort();
  return monthKeys.map((key) => {
    const [y, m] = key.split("-").map(Number);
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first offset
    const daysInMonth = new Date(y, m, 0).getDate();
    const cells: Cell[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${key}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, count: counts.get(iso) ?? 0 });
    }
    return { label: `${MONTHS[m - 1]} ${y}`, cells };
  });
}

export default function ApplicationsPage() {
  // always show Heard back / Interviewing / Closed; show Offers only once there are any
  const groups = GROUPS.filter((g) => g.label !== "Offers" || sum(g.statuses) > 0);
  const months = buildMonths(data.byDate);
  const maxDay = Math.max(...data.byDate.map((d) => d.count), 1);

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
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {groups.map((g) => (
          <div
            key={g.label}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <p className="text-sm text-neutral-500">{g.label}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${g.className}`}>
              {sum(g.statuses)}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {breakdown(g.statuses) || (g.hint ? g.hint : "none yet")}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-neutral-400">
        No &ldquo;in review&rdquo; count — an application&rsquo;s state is unknown until it becomes a
        response or a rejection. <b className="text-neutral-500">Heard back</b> = they responded
        (OA / recruiter call); <b className="text-neutral-500">Interviewing</b> = actual phone/onsite
        rounds.
      </p>

      {/* over time — calendar, one grid per month; each cell shows that day's count */}
      <section className="mt-10">
        <h2 className="mb-6 text-lg font-semibold">Applications over time</h2>
        <div className="flex flex-col gap-8">
          {months.map((month) => (
            <div key={month.label}>
              <p className="mb-3 text-sm font-medium">{month.label}</p>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className="pb-1 text-center text-xs font-medium text-neutral-400"
                  >
                    {w}
                  </div>
                ))}
                {month.cells.map((cell, i) =>
                  cell === null ? (
                    <div key={i} />
                  ) : (
                    <div
                      key={i}
                      className="flex aspect-square flex-col rounded-md border border-neutral-200 p-1.5 dark:border-neutral-800"
                      style={
                        cell.count > 0
                          ? { backgroundColor: `rgba(59, 130, 246, ${0.14 + 0.5 * (cell.count / maxDay)})` }
                          : undefined
                      }
                      title={cell.count > 0 ? `${cell.count} applications` : undefined}
                    >
                      <span className="text-[10px] leading-none text-neutral-400">{cell.day}</span>
                      {cell.count > 0 && (
                        <span className="mt-auto self-end text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
                          {cell.count}
                        </span>
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs text-neutral-400">
        Aggregate counts only — no company names, roles, or other details.
      </p>
    </main>
  );
}
