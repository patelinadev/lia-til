import type { Deck } from "./decks";
import { fetchJsonWithRetry } from "@/lib/net";

/** Fetch the completed decks from the backend at request time. Returns null if
 * the API is unset/unreachable — callers then show an error state; an empty
 * array means the backend has no decks yet (not an error). */
export async function getDecks(): Promise<Deck[] | null> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  if (!base) return null;
  const data = await fetchJsonWithRetry<{ decks: Deck[] }>(`${base}/api/system-design`);
  return data ? data.decks ?? [] : null;
}
