// Client-safe types and pure helpers (no fs). Safe to import from Client Components.
// Filesystem readers live in ./content.server.

export type Difficulty = "Easy" | "Medium" | "Hard";

export type Status =
  | "Second pass"
  | "First pass"
  | "Need review"
  | "Passed after read"
  | "Don't understand";

export type StatusCategory = "Complete" | "In Progress" | "To Do";

/** Which of the 3 buckets each status belongs to. */
export const STATUS_CATEGORY: Record<Status, StatusCategory> = {
  "Second pass": "Complete",
  "First pass": "In Progress",
  "Need review": "In Progress",
  "Passed after read": "To Do",
  "Don't understand": "To Do",
};

export type Problem = {
  id: number;
  slug: string;
  title: string;
  /** Multi-select topic tags — a problem can span several (e.g. Binary Search + Stack) */
  topics: string[];
  ep: number;
  difficulty: Difficulty;
  status: Status;
  /** Most recent completion date, YYYY-MM-DD; null if unknown */
  date: string | null;
  /** Link to Lia's own solution write-up; null if none yet */
  solutionUrl: string | null;
};

export type LeetcodeContent = {
  track: string;
  trackUrl: string;
  updatedAt: string;
  problems: Problem[];
};

/** A LeetCode problem solved on a given day, linked from the daily log. */
export type LogProblem = {
  id: number;
  slug: string;
  title: string;
  /** Optional link to Lia's own solution write-up */
  solutionUrl?: string;
};

export type LogEntry = {
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** ISO week label, e.g. "W34" */
  week: string;
  /** Checked-off items for the day */
  done: string[];
  /** One-line completion summary (may be 中英混杂 — daily-log notes are not forced to English); null if none */
  summary: string | null;
  /** One-line summary of a notes day (from Obsidian; language preserved as-is); null if none */
  note: string | null;
  /** LeetCode problems done this day — kept in the log, linked out to LeetCode */
  leetcode?: LogProblem[];
};

/** The public problem-page URL, derived from the solution URL's slug. */
export function problemUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}

/**
 * Canonical topic taxonomy (display form). Order defines each topic's color:
 * hues are spread by the golden angle off the list index, so neighbours in the
 * list still get well-separated colors. Match is case-insensitive.
 */
export const TOPIC_LIST = [
  "Set",
  "Array",
  "Hash Table",
  "Matrix",
  "Graph",
  "Stack",
  "Queue",
  "Monotonic Stack",
  "Trie",
  "Linked List",
  "Binary Tree",
  "Iterator",
  "Heap",
  "Binary Search",
  "Sorting",
  "Quick Select",
  "BFS",
  "DFS",
  "Topological Sort",
  "Backtrack",
  "Multiple Pointers",
  "Recursion",
  "Two Pointers",
  "Sliding Window",
  "Intervals",
  "String",
  "Prefix Sum",
  "Palindrome",
  "Design",
  "Dynamic Programming",
  "Greedy",
  "Knapsack",
  "Math",
  "Sums",
  "OOP",
  "Union Find",
  "Sweep Line",
  "Binary Indexed Tree & Segment Tree",
  "Data Structure",
  "Grammar",
  "Island",
] as const;

const TOPIC_INDEX = new Map(TOPIC_LIST.map((t, i) => [t.toLowerCase(), i]));

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** A stable, well-separated hue (0–359) for a topic tag's color. */
export function topicHue(topic: string): number {
  const key = topic.trim().toLowerCase();
  const known = TOPIC_INDEX.get(key);
  const n = known ?? TOPIC_LIST.length + (hashString(key) % 211);
  return Math.round((n * 137.508) % 360);
}
