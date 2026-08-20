import { DECKS, type Deck } from "./decks";

/** Fetch the completed decks from the backend at request time; fall back to the
 * committed system-design.json snapshot if API_URL is unset or unreachable. */
export async function getDecks(): Promise<Deck[]> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  if (base) {
    try {
      const res = await fetch(`${base}/api/system-design`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { decks: Deck[] };
        if (data.decks?.length) return data.decks;
      }
    } catch {
      // fall through to the committed snapshot
    }
  }
  return DECKS;
}
