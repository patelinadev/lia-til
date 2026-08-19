export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
        Today I Learn
      </p>
      <h1 className="text-4xl font-bold sm:text-5xl">Lia 的学习进度</h1>
      <p className="max-w-md text-neutral-500">
        这里会展示每天的学习进度。任何人都能打开查看，无需登录。
      </p>
      <p className="mt-2 rounded-full border border-neutral-300 px-4 py-1 text-xs text-neutral-400 dark:border-neutral-700">
        Phase 1 · walking skeleton
      </p>
    </main>
  );
}
