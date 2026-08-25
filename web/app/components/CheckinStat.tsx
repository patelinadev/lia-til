/** The streak total — days successfully checked in. Distinct from the day count:
 * a day can have a note without being a check-in, so this is usually smaller. */
export default function CheckinStat({ days }: { days: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-sm text-neutral-500"
      title="Days successfully checked in (streak total) — not every logged day is a check-in"
    >
      <span aria-hidden>🔥</span>
      <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-500">{days}</span>
      <span>checked in</span>
    </span>
  );
}
