import Link from "next/link";
import { getLeetcode } from "@/lib/content.server";
import type { LeetcodeContent } from "@/lib/content";
import LeetCodeExplorer from "./LeetCodeExplorer";

export const metadata = {
  title: "LeetCode · Lia's Learning Progress",
};

// Always render at request time so the table shows the latest data from the API.
export const dynamic = "force-dynamic";

/** Fetch the problem set from the backend at request time; fall back to the
 * committed leetcode.json if API_URL is unset or the API is unreachable. */
async function getLeetcodeData(): Promise<LeetcodeContent> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  if (base) {
    try {
      const res = await fetch(`${base}/api/leetcode`, { cache: "no-store" });
      if (res.ok) return (await res.json()) as LeetcodeContent;
    } catch {
      // fall through to the committed snapshot
    }
  }
  return getLeetcode();
}

export default async function LeetCodePage() {
  const { track, trackUrl, problems } = await getLeetcodeData();

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
