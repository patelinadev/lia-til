import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getFullDailyLog, getIndex } from "@/lib/private";
import { getCheckins } from "@/lib/stats";
import DailyLogExplorer from "@/app/components/DailyLogExplorer";
import IndexDrawer from "@/app/components/IndexDrawer";
import IndexBody from "@/app/components/IndexBody";
import CheckinStat from "@/app/components/CheckinStat";

export const metadata = {
  title: "Private · Daily Log",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
// Allow the request to wait out a cold backend start (Render free tier ~40s).
export const maxDuration = 60;

export default async function PrivateDailyLogPage() {
  await requireAdmin();
  // Solution links come already enriched (by id) from GET /api/daily-log/full,
  // so nothing local is needed here. The INDEX is a small private singleton doc.
  const [entries, index, checkins] = await Promise.all([
    getFullDailyLog(),
    getIndex(),
    getCheckins(),
  ]);
  const hasIndex = !!index?.value?.trim();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/private"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; Private
      </Link>

      <div className="mt-6 mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Daily Log</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {hasIndex && (
            <IndexDrawer updatedAt={index!.updatedAt} autoOpen>
              <IndexBody md={index!.value} />
            </IndexDrawer>
          )}
          {checkins !== null && <CheckinStat days={checkins} />}
          {entries && (
            <p className="text-sm text-neutral-500">
              <span className="text-neutral-300 dark:text-neutral-600">·</span> {entries.length} days
            </p>
          )}
        </div>
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
        <DailyLogExplorer entries={entries} variant="private" />
      )}
    </main>
  );
}
