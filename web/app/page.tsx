import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          Lia&rsquo;s Learning Progress
        </p>
        <h1 className="text-4xl font-bold sm:text-5xl">Today I Learned</h1>
        <p className="max-w-md text-neutral-500">A public record of what Lia is learning.</p>
        <a
          href="https://github.com/patelinadev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-800 hover:underline dark:hover:text-neutral-300"
        >
          github.com/patelinadev &#8599;
        </a>
      </div>

      <nav className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
        <Link
          href="/daily-log"
          className="group flex items-center justify-between rounded-xl border border-neutral-200 px-5 py-4 text-left transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
        >
          <span>
            <span className="block font-semibold">Daily Log</span>
            <span className="block text-sm text-neutral-500">Day-by-day timeline</span>
          </span>
          <span className="text-neutral-400 transition-transform group-hover:translate-x-0.5">
            &rarr;
          </span>
        </Link>

        <Link
          href="/leetcode"
          className="group flex items-center justify-between rounded-xl border border-neutral-200 px-5 py-4 text-left transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
        >
          <span>
            <span className="block font-semibold">LeetCode</span>
            <span className="block text-sm text-neutral-500">Solved problems by pattern</span>
          </span>
          <span className="text-neutral-400 transition-transform group-hover:translate-x-0.5">
            &rarr;
          </span>
        </Link>

        <Link
          href="/applications"
          className="group flex items-center justify-between rounded-xl border border-neutral-200 px-5 py-4 text-left transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
        >
          <span>
            <span className="block font-semibold">Applications</span>
            <span className="block text-sm text-neutral-500">Job-search progress</span>
          </span>
          <span className="text-neutral-400 transition-transform group-hover:translate-x-0.5">
            &rarr;
          </span>
        </Link>

        <Link
          href="/system-design"
          className="group flex items-center justify-between rounded-xl border border-neutral-200 px-5 py-4 text-left transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
        >
          <span>
            <span className="block font-semibold">System Design</span>
            <span className="block text-sm text-neutral-500">Notes by deck</span>
          </span>
          <span className="text-neutral-400 transition-transform group-hover:translate-x-0.5">
            &rarr;
          </span>
        </Link>
      </nav>
    </main>
  );
}
