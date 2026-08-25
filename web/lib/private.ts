import "server-only";
import { fetchJsonWithRetry } from "./net";

export type FullApplication = {
  appNum: number;
  company: string | null;
  role: string | null;
  resume: string | null;
  appliedDate: string | null;
  status: string | null;
  notes: string | null;
};

/** Fetch the full ledger from the backend's private endpoint. The shared secret
 * lives only on the server; this is called only after the session is verified.
 * Returns `null` if the backend can't be reached through the retry budget (so
 * the page can tell a transient cold start apart from a genuinely empty ledger);
 * an empty array means the ledger really has no rows. */
export async function getFullApplications(): Promise<FullApplication[] | null> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  const secret = process.env.BACKEND_SECRET;
  if (!base || !secret) return null;
  const data = await fetchJsonWithRetry<{ applications: FullApplication[] }>(
    `${base}/api/applications/full`,
    { headers: { "x-admin-secret": secret } },
  );
  if (!data) return null;
  return data.applications ?? [];
}

export type FullDailyLogEntry = {
  date: string;
  week: string | null;
  done: string[];
  summary: string | null;
  note: string | null;
  leetcode: { id: number; slug?: string; title?: string; solutionUrl?: string | null }[];
  /** The full faithful record from the vault ({heading -> content}), including
   * the private sections. Served ONLY by the gated /full endpoint. */
  sections?: Record<string, string> | null;
  /** Topic / type labels for categorization + search. */
  tags?: string[] | null;
};

/** Fetch the full daily log from the backend's private endpoint (secret-gated).
 * Called only after the admin session is verified. Returns `null` when the
 * backend can't be reached (transient cold start) vs `[]` for a truly empty log. */
export async function getFullDailyLog(): Promise<FullDailyLogEntry[] | null> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  const secret = process.env.BACKEND_SECRET;
  if (!base || !secret) return null;
  const data = await fetchJsonWithRetry<{ entries: FullDailyLogEntry[] }>(
    `${base}/api/daily-log/full`,
    { headers: { "x-admin-secret": secret } },
  );
  if (!data) return null;
  return data.entries ?? [];
}
