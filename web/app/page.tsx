export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
        Today I Learn
      </p>
      <h1 className="text-4xl font-bold sm:text-5xl">Lia&rsquo;s Learning Progress</h1>
      <p className="max-w-md text-neutral-500">
        A daily log of what Lia is learning. Open to anyone &mdash; no login required.
      </p>
      <p className="mt-2 rounded-full border border-neutral-300 px-4 py-1 text-xs text-neutral-400 dark:border-neutral-700">
        Phase 1 · walking skeleton
      </p>
    </main>
  );
}
