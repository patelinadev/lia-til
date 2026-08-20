// Server-side fetch helper tuned for our free-tier backend (Render), which
// spins down after ~15 min idle and can take ~40s to cold-start. A single
// fetch would fail/return fast on a cold instance and make the page fall back
// to stale/empty data. This keeps trying until a deadline so a cold load waits
// the instance awake and renders correct data ("slow but right" beats "fast but
// wrong"). Pair it with a keep-warm ping so the cold path is rarely hit.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch JSON, retrying within a total time budget. Returns the parsed body, or
 * `null` if every attempt fails before the deadline. A 401/403 short-circuits
 * to `null` (a wrong/missing secret won't fix itself by retrying).
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit = {},
  opts: { deadlineMs?: number; gapMs?: number } = {},
): Promise<T | null> {
  const deadlineMs = opts.deadlineMs ?? 50_000;
  const gapMs = opts.gapMs ?? 2_000;
  const start = Date.now();

  while (Date.now() - start < deadlineMs) {
    const remaining = deadlineMs - (Date.now() - start);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      if (res.ok) return (await res.json()) as T;
      if (res.status === 401 || res.status === 403) return null;
    } catch {
      clearTimeout(timer);
      // network error / aborted — fall through to retry if budget remains
    }
    if (deadlineMs - (Date.now() - start) <= gapMs) break;
    await sleep(gapMs);
  }
  return null;
}
