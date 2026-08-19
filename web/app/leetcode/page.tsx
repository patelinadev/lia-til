import Link from "next/link";
import { getLeetcode } from "@/lib/content.server";
import LeetCodeExplorer from "./LeetCodeExplorer";

export const metadata = {
  title: "LeetCode · Lia's Learning Progress",
};

export default function LeetCodePage() {
  const { track, trackUrl, problems } = getLeetcode();

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
