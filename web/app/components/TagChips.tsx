/** Topic/type tag chips. Auto-derived tags (e.g. "code") render muted; manual
 * tags render in the accent color. Works in server and client components. */
export default function TagChips({
  tags,
  auto = [],
  className = "",
}: {
  tags: string[];
  auto?: string[];
  className?: string;
}) {
  if (tags.length === 0) return null;
  const autoSet = new Set(auto);
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((t) => (
        <span
          key={t}
          title={autoSet.has(t) ? "auto-derived tag" : undefined}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            autoSet.has(t)
              ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
          }`}
        >
          #{t}
        </span>
      ))}
    </div>
  );
}
