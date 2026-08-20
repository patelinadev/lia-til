export type DiagramKey = "loadBalanced" | "requestResponse" | "statefulStateless" | "apiProtocols";

export type Slide = {
  eyebrow: string;
  title: string;
  diagram?: DiagramKey;
  intro?: string;
  bullets?: { term?: string; text: string }[];
  notes?: string[];
  quote?: string;
};

export type Deck = { n: number; slug: string; title: string; lastReviewed: string; slides: Slide[] };

// The single source's chapter list (30 decks), grouped by phase.
export const PHASES: { key: string; label: string; decks: [number, string][] }[] = [
  {
    key: "A",
    label: "A request's journey — core components",
    decks: [
      [1, "Client / Server Model"],
      [2, "API Design"],
      [3, "DNS & Routing"],
      [4, "Load Balancing"],
      [5, "Databases"],
      [6, "Caching"],
      [7, "Object & Blob Storage"],
      [8, "CDNs & Edge"],
      [9, "Queues"],
      [10, "Search"],
    ],
  },
  {
    key: "B",
    label: "Correctness & safety",
    decks: [
      [11, "Authentication & Authorization"],
      [12, "Concurrency Control"],
      [13, "Idempotency & Retries"],
      [14, "ID Generation at Scale"],
    ],
  },
  {
    key: "C",
    label: "Scale & distributed systems",
    decks: [
      [15, "Scaling"],
      [16, "Consistency vs Availability"],
      [17, "Replication & Sharding"],
      [18, "Distributed Consensus"],
      [19, "Rate Limiting"],
      [20, "Real-time"],
      [21, "Stream Processing"],
      [22, "Probabilistic Data Structures"],
      [23, "Multi-region & DR"],
    ],
  },
  {
    key: "D",
    label: "Architecture & operations",
    decks: [
      [24, "Microservices vs Monolith"],
      [25, "Deployment Strategies"],
      [26, "Observability"],
      [27, "Resilience Patterns"],
    ],
  },
  {
    key: "E",
    label: "Putting it together",
    decks: [
      [28, "News Feed / Timeline"],
      [29, "Notification Systems"],
      [30, "Geospatial Search"],
    ],
  },
];

// Deck CONTENT is the single source at web/content/system-design.json (also read
// by the backend importer backend/import_system_design.py). This static import is
// only the offline fallback — at request time the pages fetch /api/system-design.
import sdData from "@/content/system-design.json";

export const DECKS: Deck[] = sdData.decks as Deck[];

/** slug -> last-reviewed date, for whichever deck set the page is rendering. */
export function reviewedMap(decks: Deck[]): Record<number, string> {
  return Object.fromEntries(decks.map((d) => [d.n, d.lastReviewed]));
}

export function deckSlug(decks: Deck[], n: number): string | undefined {
  return decks.find((d) => d.n === n)?.slug;
}

export function deckBySlug(decks: Deck[], slug: string): Deck | undefined {
  return decks.find((d) => d.slug === slug);
}
