import { fetchJsonWithRetry } from "./net";

/** Days successfully checked in (the streak total), from the public /api/checkins.
 * Public-safe: the endpoint returns only the aggregate integer, never the private
 * INDEX text. Returns null if the backend is unset/unreachable. */
export async function getCheckins(): Promise<number | null> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  if (!base) return null;
  const d = await fetchJsonWithRetry<{ days: number }>(`${base}/api/checkins`);
  return d ? (d.days ?? 0) : null;
}
