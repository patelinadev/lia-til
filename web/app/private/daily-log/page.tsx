import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getFullDailyLog } from "@/lib/private";
import DailyLogNav from "./DailyLogNav";

export const metadata = {
  title: "Private · Daily Log",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
// Allow the request to wait out a cold backend start (Render free tier ~40s).
export const maxDuration = 60;

export default async function PrivateDailyLogPage() {
  await requireAdmin();
  const entries = await getFullDailyLog();
  // Solution links come already enriched (by id) from GET /api/daily-log/full,
  // so nothing local is needed here.

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
        {entries && <p className="text-sm text-neutral-500">{entries.length} days</p>}
      </div>
      <p className="mb-8 max-w-2xl text-sm text-neutral-500">
        The full log, day by day. The public
        <Link href="/daily-log" className="mx-1 underline hover:text-neutral-800 dark:hover:text-neutral-300">
          /daily-log
        </Link>
        timeline shows only the curated items.
      </p>

      {entries === null ? (
        <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-6 text-sm text-neutral-600 dark:border-amber-800 dark:bg-amber-950/20 dark:text-neutral-300">
          Couldn&rsquo;t reach the backend just now — the free-tier instance may be waking up. Refresh in
          ~30s. If it keeps failing, check that <code>BACKEND_SECRET</code> matches between Vercel and Render.
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
          The log is empty — no entries have been imported yet.
        </p>
      ) : (
        <DailyLogNav entries={entries} />
      )}
    </main>
  );
}
