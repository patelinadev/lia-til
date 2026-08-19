import fs from "node:fs";
import path from "node:path";
import leetcodeData from "@/content/leetcode.json";

export type Difficulty = "Easy" | "Medium" | "Hard";

export type Problem = {
  id: number;
  slug: string;
  title: string;
  pattern: string;
  ep: number;
  difficulty: Difficulty;
  solutionUrl: string;
};

export type LeetcodeContent = {
  track: string;
  trackUrl: string;
  updatedAt: string;
  problems: Problem[];
};

export type LogEntry = {
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** ISO week label, e.g. "W34" */
  week: string;
  /** Checked-off items for the day */
  done: string[];
  /** One-line completion summary (Lia writes this); null if none */
  summary: string | null;
  /** One-line summary of a notes day (from Obsidian); null if none */
  note: string | null;
};

/** LeetCode problems, sorted by episode order then problem number. */
export function getLeetcode(): LeetcodeContent {
  const data = leetcodeData as LeetcodeContent;
  const problems = [...data.problems].sort((a, b) => a.ep - b.ep || a.id - b.id);
  return { ...data, problems };
}

/** The public problem-page URL, derived from the solution URL's slug. */
export function problemUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}

const LOG_DIR = path.join(process.cwd(), "content", "log");

/** Daily log entries, newest first. Read from content/log/*.json at build time. */
export function getLog(): LogEntry[] {
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".json"));
  const entries = files.map(
    (f) => JSON.parse(fs.readFileSync(path.join(LOG_DIR, f), "utf8")) as LogEntry,
  );
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
