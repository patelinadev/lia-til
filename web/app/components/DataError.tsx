/**
 * Shown when a page can't reach the backend. There is no offline snapshot
 * fallback anymore — the DB is the single source of truth, so an unreachable
 * backend is surfaced honestly instead of rendering stale numbers.
 */
export default function DataError({ label = "this data" }: { label?: string }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-8 text-center dark:border-amber-800/70 dark:bg-amber-950/20">
      <p className="font-medium text-neutral-800 dark:text-neutral-200">Couldn&rsquo;t load {label}</p>
      <p className="mt-1 text-sm text-neutral-500">
        The backend didn&rsquo;t respond — it may be waking up. Refresh in ~30&nbsp;seconds.
      </p>
    </div>
  );
}
