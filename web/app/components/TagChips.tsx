/** Topic/type tag chips. Tags (manual + rule-derived) are merged by the backend
 * and served on both public and private, so this just renders the list. */
export default function TagChips({ tags, className = "" }: { tags?: string[] | null; className?: string }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
        >
          #{t}
        </span>
      ))}
    </div>
  );
}
