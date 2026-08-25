import Link from "next/link";
import type { LeetcodeContent } from "@/lib/content";
import { fetchJsonWithRetry } from "@/lib/net";
import DataError from "@/app/components/DataError";
import LeetCodeExplorer from "./LeetCodeExplorer";

export const metadata = {
  title: "LeetCode · Lia's Learning Progress",
};

// Always render at request time so the table shows the latest data from the API.
export const dynamic = "force-dynamic";
// Allow the request to wait out a cold backend start (Render free tier ~40s).
export const maxDuration = 60;

/** Fetch the problem set from the backend at request time. Returns null if the
 * API is unset/unreachable — the page then shows an error state. */
async function getLeetcodeData(): Promise<LeetcodeContent | null> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  if (!base) return null;
  return fetchJsonWithRetry<LeetcodeContent>(`${base}/api/leetcode`);
}

export default async function LeetCodePage() {
  const data = await getLeetcodeData();

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
        <Link
          href="/"
          className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
        >
          &larr; Learning Progress
        </Link>
        <h1 className="mt-6 text-3xl font-bold sm:text-4xl">LeetCode</h1>
        <DataError label="the LeetCode problems" />
      </main>
    );
  }

  const { track, trackUrl, problems } = data;

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

      <LeetCodeExplorer problems={problems} />
    </main>
  );
}
