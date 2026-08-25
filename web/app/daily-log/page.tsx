import Link from "next/link";
import type { LogEntry } from "@/lib/content";
import { fetchJsonWithRetry } from "@/lib/net";
import DataError from "@/app/components/DataError";
import DailyLogExplorer from "@/app/components/DailyLogExplorer";

export const metadata = {
  title: "Daily Log · Lia's Learning Progress",
};

// Always render at request time so the timeline shows the latest data from the API.
export const dynamic = "force-dynamic";
// Allow the request to wait out a cold backend start (Render free tier ~40s).
export const maxDuration = 60;

/** Fetch curated daily-log entries from the backend. Returns null if the API is
 * unset/unreachable — the page then shows an error state. LeetCode solution
 * links come already enriched (by id) from the endpoint. */
async function getDailyLog(): Promise<LogEntry[] | null> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  if (!base) return null;
  return fetchJsonWithRetry<LogEntry[]>(`${base}/api/daily-log`);
}

export default async function DailyLogPage() {
  const log = await getDailyLog();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
      <Link
        href="/"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; Learning Progress
      </Link>

      <h1 className="mt-6 mb-8 text-3xl font-bold sm:text-4xl">Daily Log</h1>

      {log === null ? (
        <DataError label="the daily log" />
      ) : (
        <DailyLogExplorer entries={log} variant="public" />
      )}
    </main>
  );
}
