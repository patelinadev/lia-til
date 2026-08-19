"use client";

import { useMemo, useState } from "react";
import {
  problemUrl,
  topicHue,
  STATUS_CATEGORY,
  type Problem,
  type Difficulty,
  type Status,
  type StatusCategory,
} from "@/lib/content";

function hueStyle(topic: string): React.CSSProperties {
  return { ["--topic-h" as string]: topicHue(topic) } as React.CSSProperties;
}

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

const STATUS_GROUPS: { category: StatusCategory; statuses: Status[] }[] = [
  { category: "Complete", statuses: ["Second pass"] },
  { category: "In Progress", statuses: ["First pass", "Need review"] },
  { category: "To Do", statuses: ["Passed after read", "Don't understand"] },
];

const STATUS_DESCRIPTIONS: Record<Status, string> = {
  "Second pass": "Solved independently a second time",
  "First pass": "Solved once independently — needs a second pass",
  "Need review": "Needs another look / redo",
  "Passed after read": "Only passed after reading the solution",
  "Don't understand": "Not understood yet",
};

type SortKey = "id" | "difficulty" | "date";

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

export default function LeetCodeExplorer({ problems }: { problems: Problem[] }) {
  const [topics, setTopics] = useState<Set<string>>(new Set());
  const [diffs, setDiffs] = useState<Set<Difficulty>>(new Set());
  const [statuses, setStatuses] = useState<Set<Status>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const allTopics = useMemo(
    () => Array.from(new Set(problems.flatMap((p) => p.topics))).sort(),
    [problems],
  );

  const anyFilter = topics.size > 0 || diffs.size > 0 || statuses.size > 0;

  function clickSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null); // third click → back to default (episode order)
    }
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
      // date — always push unknown dates to the bottom
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date) * dir;
    });
  }, [problems, topics, diffs, statuses, sortKey, sortDir]);

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const sortableHeader = "cursor-pointer select-none font-medium hover:text-neutral-800 dark:hover:text-neutral-200";

  return (
    <div>
      {/* filters */}
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <FilterRow label="Topic">
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
        </FilterRow>
        <FilterRow label="Difficulty">
          {ALL_DIFFICULTIES.map((d) => (
            <Chip key={d} active={diffs.has(d)} onClick={() => setDiffs(toggle(diffs, d))}>
              {d}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Status">
          {STATUS_GROUPS.flatMap((g) => g.statuses).map((s) => (
            <Chip key={s} active={statuses.has(s)} onClick={() => setStatuses(toggle(statuses, s))}>
              {s}
            </Chip>
          ))}
        </FilterRow>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
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
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
              <th className="px-4 py-3">
                <button type="button" onClick={() => clickSort("id")} className={sortableHeader}>
                  #{sortArrow("id")}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Problem</th>
              <th className="px-4 py-3 font-medium">Topic</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => clickSort("difficulty")}
                  className={sortableHeader}
                >
                  Difficulty{sortArrow("difficulty")}
                </button>
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="whitespace-nowrap px-4 py-3">
                <button type="button" onClick={() => clickSort("date")} className={sortableHeader}>
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

      {/* status legend */}
      <div className="mt-5 rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          What the statuses mean
        </p>
        <div className="flex flex-col gap-3">
          {STATUS_GROUPS.map((g) => (
            <div key={g.category} className="flex flex-col gap-1.5">
              <span
                className={`inline-block w-fit rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[g.category]}`}
              >
                {g.category}
              </span>
              <ul className="ml-1 flex flex-col gap-0.5">
                {g.statuses.map((s) => (
                  <li key={s} className="text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{s}</span>{" "}
                    — {STATUS_DESCRIPTIONS[s]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      {children}
    </div>
  );
}
