import fs from "node:fs";
import path from "node:path";
import leetcodeData from "@/content/leetcode.json";
import type { LeetcodeContent, LogEntry } from "./content";

/**
 * LeetCode problems, ordered by episode. Array.sort is stable, so problems
 * within the same episode keep their file order (which follows the 0x3f plan:
 * examples before homework).
 */
export function getLeetcode(): LeetcodeContent {
  const data = leetcodeData as LeetcodeContent;
  const problems = [...data.problems].sort((a, b) => a.ep - b.ep);
  return { ...data, problems };
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
