"use client";

import { useEffect, useMemo, useState } from "react";
import {
  problemUrl,
  topicHue,
  STATUS_CATEGORY,
  type Problem,
  type Difficulty,
  type Status,
  type StatusCategory,
} from "@/lib/content";

const DIFFICULTY_ORDER: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 };
const ALL_DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  Medium: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Hard: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
};

const STATUS_STYLES: Record<StatusCategory, string> = {
  Complete: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  "In Progress": "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  "To Do": "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

// The 5 real status tags, grouped into 3 categories by how independently the
// problem can be solved. You pick one of the 5 tags; the categories are just labels.
const STATUS_GROUPS: { category: StatusCategory; statuses: Status[] }[] = [
  { category: "To Do", statuses: ["Don't understand", "Passed after read"] },
  { category: "In Progress", statuses: ["Need review", "First pass"] },
  { category: "Complete", statuses: ["Second pass"] },
];

type SortKey = "id" | "difficulty" | "date";
type Col = "topic" | "difficulty" | "status";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function hueStyle(topic: string): React.CSSProperties {
  return { ["--topic-h" as string]: topicHue(topic) } as React.CSSProperties;
}

function Chip({
  active,
  onClick,
  hue,
  children,
}: {
  active: boolean;
  onClick: () => void;
  hue?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
          : "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-500"
      }`}
    >
      {hue !== undefined && (
        <span
          className="topic-dot h-2 w-2 rounded-full"
          style={{ ["--topic-h" as string]: hue } as React.CSSProperties}
        />
      )}
      {children}
    </button>
  );
}

/** A small count badge shown on a column header when that column has an active filter. */
function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-semibold text-white dark:bg-white dark:text-neutral-900">
      {n}
    </span>
  );
}

export default function LeetCodeExplorer({ problems }: { problems: Problem[] }) {
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [diffs, setDiffs] = useState<Set<Difficulty>>(new Set());
  const [statuses, setStatuses] = useState<Set<Status>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [openCol, setOpenCol] = useState<Col | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const allTopics = useMemo(
    () => Array.from(new Set(problems.flatMap((p) => p.topics))).sort(),
    [problems],
  );

  const anyFilter = topics.size > 0 || diffs.size > 0 || statuses.size > 0;

  // close menu on scroll / resize so the fixed popover never drifts from its header
  useEffect(() => {
    if (!openCol) return;
    const close = () => setOpenCol(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [openCol]);

  function openMenu(col: Col, e: React.MouseEvent<HTMLElement>) {
    if (openCol === col) {
      setOpenCol(null);
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left });
    setOpenCol(col);
  }

  function clickSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const view = useMemo(() => {
    const rows = problems.filter(
      (p) =>
        (topics.size === 0 || p.topics.some((t) => topics.has(t))) &&
        (diffs.size === 0 || diffs.has(p.difficulty)) &&
        (statuses.size === 0 || statuses.has(p.status)),
    );
    if (!sortKey) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "id") return (a.id - b.id) * dir;
      if (sortKey === "difficulty")
        return (DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]) * dir;
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date) * dir;
    });
  }, [problems, topics, diffs, statuses, sortKey, sortDir]);

  const thSort =
    "cursor-pointer select-none font-medium hover:text-neutral-800 dark:hover:text-neutral-200";
  const thFilter =
    "inline-flex items-center gap-0.5 font-medium hover:text-neutral-800 dark:hover:text-neutral-200";

  return (
    <div>
      {(anyFilter || sortKey) && (
        <div className="mb-3 flex items-center gap-3 text-xs text-neutral-500">
          <span>
            Showing {view.length} of {problems.length}
          </span>
          {anyFilter && (
            <button
              type="button"
              onClick={() => {
                setTopics(new Set());
                setDiffs(new Set());
                setStatuses(new Set());
              }}
              className="underline hover:text-neutral-800 dark:hover:text-neutral-300"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              <th className="px-4 py-3">
                <button type="button" onClick={() => clickSort("id")} className={thSort}>
                  #{sortArrow("id")}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Problem</th>
              <th className="px-4 py-3">
                <button type="button" onClick={(e) => openMenu("topic", e)} className={thFilter}>
                  Topic
                  <Count n={topics.size} />
                  <span aria-hidden className="text-[10px]">
                    ▾
                  </span>
                </button>
              </th>
              <th className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => clickSort("difficulty")}
                    className={thSort}
                  >
                    Difficulty{sortArrow("difficulty")}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openMenu("difficulty", e)}
                    className={thFilter}
                    aria-label="Filter by difficulty"
                  >
                    <Count n={diffs.size} />
                    <span aria-hidden className="text-[10px]">
                      ▾
                    </span>
                  </button>
                </span>
              </th>
              <th className="px-4 py-3">
                <button type="button" onClick={(e) => openMenu("status", e)} className={thFilter}>
                  Status
                  <Count n={statuses.size} />
                  <span aria-hidden className="text-[10px]">
                    ▾
                  </span>
                </button>
              </th>
              <th className="whitespace-nowrap px-4 py-3">
                <button type="button" onClick={() => clickSort("date")} className={thSort}>
                  Date{sortArrow("date")}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Solution</th>
            </tr>
          </thead>
          <tbody>
            {view.map((p) => (
              <tr
                key={p.id}
                className="border-b border-neutral-100 last:border-0 dark:border-neutral-900"
              >
                <td className="px-4 py-3 tabular-nums text-neutral-500">{p.id}</td>
                <td className="px-4 py-3 font-medium">
                  <a
                    href={problemUrl(p.slug)}
                    className="hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.title}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {p.topics.map((t) => (
                      <span
                        key={t}
                        className="topic-tag whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium"
                        style={hueStyle(t)}
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${DIFFICULTY_STYLES[p.difficulty]}`}
                  >
                    {p.difficulty}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[STATUS_CATEGORY[p.status]]}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-neutral-500">
                  {formatDate(p.date)}
                </td>
                <td className="px-4 py-3">
                  {p.solutionUrl ? (
                    <a
                      href={p.solutionUrl}
                      className="whitespace-nowrap text-blue-600 hover:underline dark:text-blue-400"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Solution &#8599;
                    </a>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">
                  No problems match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* column filter menus (fixed-positioned so the table's overflow can't clip them) */}
      {openCol && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenCol(null)} />
          <div
            className="fixed z-50 min-w-52 max-w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            style={{ top: pos.top, left: pos.left }}
          >
            {openCol === "topic" && (
              <Menu
                title="Filter by topic"
                onClear={topics.size ? () => setTopics(new Set()) : undefined}
              >
                {allTopics.map((t) => (
                  <Chip
                    key={t}
                    active={topics.has(t)}
                    hue={topicHue(t)}
                    onClick={() => setTopics(toggle(topics, t))}
                  >
                    {t}
                  </Chip>
                ))}
              </Menu>
            )}
            {openCol === "difficulty" && (
              <Menu
                title="Filter by difficulty"
                onClear={diffs.size ? () => setDiffs(new Set()) : undefined}
              >
                {ALL_DIFFICULTIES.map((d) => (
                  <Chip key={d} active={diffs.has(d)} onClick={() => setDiffs(toggle(diffs, d))}>
                    {d}
                  </Chip>
                ))}
              </Menu>
            )}
            {openCol === "status" && (
              <Menu
                title="Filter by status"
                onClear={statuses.size ? () => setStatuses(new Set()) : undefined}
              >
                <div className="flex w-full flex-col gap-3">
                  {STATUS_GROUPS.map((g) => (
                    <div key={g.category} className="flex flex-col gap-1.5">
                      <span
                        className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[g.category]}`}
                      >
                        {g.category}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {g.statuses.map((s) => (
                          <Chip
                            key={s}
                            active={statuses.has(s)}
                            onClick={() => setStatuses(toggle(statuses, s))}
                          >
                            {s}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-neutral-200 pt-2 text-xs leading-relaxed text-neutral-500 dark:border-neutral-700">
                    <p>
                      Every problem carries{" "}
                      <b className="text-neutral-700 dark:text-neutral-300">one</b> of these 5 tags,
                      grouped by how independently you can solve it:
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      <li>
                        <b className="text-neutral-700 dark:text-neutral-300">To Do</b> — not on your
                        own yet (don&rsquo;t understand it, or only passed after reading the solution)
                      </li>
                      <li>
                        <b className="text-neutral-700 dark:text-neutral-300">In Progress</b> — solved
                        once independently but not locked in (first pass, or needs another review)
                      </li>
                      <li>
                        <b className="text-neutral-700 dark:text-neutral-300">Complete</b> — solved
                        independently a second time
                      </li>
                    </ul>
                  </div>
                </div>
              </Menu>
            )}
          </div>
        </>
      )}

    </div>
  );
}

function Menu({
  title,
  onClear,
  children,
}: {
  title: string;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {title}
        </span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-300"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
