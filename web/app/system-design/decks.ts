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

export const DECKS: Deck[] = [
  {
    n: 1,
    slug: "client-server-model",
    title: "Client / Server Model",
    lastReviewed: "2026-07-15",
    slides: [
      {
        eyebrow: "What it is",
        title: "The basic shape of every web app",
        diagram: "loadBalanced",
        notes: [
          "Clients make requests, servers handle them. A load balancer in front spreads traffic across many identical servers, so one box failing doesn't take the whole app down.",
          "Almost every design question — a chat app, a streaming platform — starts from some version of this skeleton; you layer specifics on top.",
          "The client talks to a single address and trusts the load balancer to route; it doesn't care how many servers exist.",
        ],
      },
      {
        eyebrow: "Core concepts",
        title: "The pieces you need to know",
        diagram: "requestResponse",
        bullets: [
          { term: "Client", text: "What the user runs (browser, iOS app, CLI). Knows where to send requests and how to render the response." },
          { term: "Load balancer", text: "Spreads traffic across a pool of servers (AWS ALB, GCP LB); health-checks so dead boxes stop receiving traffic." },
          { term: "Server", text: "Stateless compute running your business logic. Adding or removing a server should be invisible to clients." },
          { term: "Backend services", text: "Databases, caches, queues, 3rd-party APIs — behind the servers, holding the data and side effects." },
        ],
        notes: [
          "This layout drives where logic lives (client vs server), what to cache, how to scale, and what happens when any one piece fails.",
        ],
      },
      {
        eyebrow: "Variants",
        title: "Stateless vs stateful servers",
        diagram: "statefulStateless",
        bullets: [
          { term: "Stateless", text: "No memory between requests — each request carries everything (auth token, IDs, params). Any server handles any request, so you scale horizontally, redeploy safely, and survive crashes without losing sessions." },
          { term: "Stateful", text: "Keeps session / in-memory data between requests — low latency, less sent per request, but the client is locked to one server and a crash loses whatever was in memory." },
        ],
        notes: [
          "Default to stateless in interviews and cloud systems unless there's a specific reason (multiplayer games, persistent WebSockets, real-time collaboration).",
          "Nuance: a stateless server can still use a database to track users — the server holds nothing between requests, the database holds the truth.",
        ],
      },
      {
        eyebrow: "Trade-offs",
        title: "What you give up",
        intro: "Scale and resilience aren't free.",
        bullets: [
          { text: "Stateless servers reach an external store on almost every request — an extra hop that can fail or slow down." },
          { text: "The load balancer is another hop, another dependency to monitor, and another thing to pay for." },
          { text: "Servers must stay interchangeable: no local files, no in-memory state, no assumptions about who you talked to last." },
          { text: "Sticky sessions are a workaround, but they bring back most of the stateful pain and make scaling lopsided." },
        ],
        notes: ["Past a handful of users the trade is obvious: eat the hops to grow without rewriting everything."],
        quote: "I hate stateful services, and so do most interviewers.",
      },
      {
        eyebrow: "In an interview",
        title: "What this looks like in a question",
        intro: "This is the starting skeleton for almost every design question — draw it first, then layer specifics. Don't spend over a minute on the base.",
        bullets: [
          { term: "Trigger", text: "“Design the backend for…” → draw client, LB, server, DB." },
          { term: "Trigger", text: "“What if a server crashes?” → stateless + horizontal scaling + health checks." },
          { term: "Trigger", text: "“Session data” / “multiplayer” → stateful may be justified for that one service." },
        ],
        notes: ["State your assumption (“stateless servers behind an ALB”) and move on — the interviewer cares about what you build on top of the skeleton, not the skeleton itself."],
      },
    ],
  },
  {
    n: 2,
    slug: "api-design",
    title: "API Design",
    lastReviewed: "2026-08-10",
    slides: [
      {
        eyebrow: "What it is",
        title: "The contract you ship outlives your code",
        notes: [
          "An API is the contract between client and server — how the outside world asks your service to do work. Once v1 ships it's far harder to change than the implementation behind it; your API decisions outlive most of your code.",
          "Three protocols dominate: REST, GraphQL, gRPC — each trades developer experience, network efficiency, and tooling. Picking matters, but a good API is mostly predictability, idempotency, and clear errors, not the protocol.",
        ],
      },
      {
        eyebrow: "Core concepts",
        title: "Things every API has to handle",
        bullets: [
          { term: "Resource modeling", text: "Name entities and identifiers up front. /users/{id}/orders/{id} is boring and unambiguous — exactly what you want." },
          { term: "Versioning", text: "URL prefix (/v1/), header, or schema-version field. Pick one and stick to it — v1 lives forever, plan for it." },
          { term: "Idempotency keys", text: "Any retryable non-GET needs an Idempotency-Key header so retries don't double-charge or double-create." },
          { term: "Pagination", text: "Cursor-based for anything that grows or changes (feeds, search); offset-based only for static, bounded lists." },
          { term: "Errors", text: "Structured: an error code (clients switch on it), a human message (for the log), and a request id." },
          { term: "Auth", text: "Authorization header, never a query param — query strings leak into CDN logs, browser history, and screenshots." },
        ],
      },
      {
        eyebrow: "Variants",
        title: "REST vs GraphQL vs gRPC",
        diagram: "apiProtocols",
        bullets: [
          { term: "REST", text: "HTTP verbs over resources. CDN-cacheable, curl-debuggable, universally supported. Boring is good — the right default for almost any external API." },
          { term: "GraphQL", text: "One endpoint, the client picks its fields. Great when one backend feeds many frontends (web/iOS/Android/partners). Cost: complex caching, N+1 risk, custom tooling." },
          { term: "gRPC", text: "Protobuf over HTTP/2 with bidirectional streaming. Fastest on the wire, strict schema, generated clients in every language. Great internal service-to-service; browsers need a gRPC-Web shim." },
        ],
        notes: ["BFF (backend-for-frontend) is a useful middle ground: a thin REST/GraphQL service per client calling internal gRPC — the client gets exactly what it needs, internal services stay strict."],
      },
      {
        eyebrow: "Trade-offs",
        title: "What you give up",
        bullets: [
          { text: "REST is easy to onboard but over-fetches (too much data) or under-fetches (many round-trips for related resources)." },
          { text: "GraphQL is flexible but the server must defend against expensive queries (depth limits, complexity scoring, persisted queries)." },
          { text: "gRPC wins on performance but loses the HTTP ecosystem: no easy CDN caching, no browser DevTools tab, no curl one-liners." },
          { text: "Versioning is painful regardless — teams promise a clean v2 migration and rarely actually deprecate v1." },
          { text: "Idempotency is the difference between a retry and a duplicate charge; skip it and you'll eventually corrupt customer data." },
        ],
      },
      {
        eyebrow: "In an interview",
        title: "What to listen for",
        bullets: [
          { term: "“Mobile & web, different needs”", text: "GraphQL or BFF — don't make mobile do 5 round-trips to render one screen." },
          { term: "“Internal microservices”", text: "gRPC for hot paths, REST for management and admin endpoints." },
          { term: "“Public API for third parties”", text: "REST + an OpenAPI spec — stable URLs, documented error codes, generous rate limits." },
          { term: "“Webhooks” / “outbound POST”", text: "Signed bodies (HMAC), idempotency keys, retries with exponential backoff, a replayable delivery log." },
        ],
        notes: ["Always say what happens on retry: “POST /payments takes an Idempotency-Key, so a duplicate returns the original response without a second charge.” That sentence beats naming any protocol."],
      },
    ],
  },
];

export const REVIEWED: Record<number, string> = Object.fromEntries(
  DECKS.map((d) => [d.n, d.lastReviewed]),
);

export function deckSlug(n: number): string | undefined {
  return DECKS.find((d) => d.n === n)?.slug;
}

export function deckBySlug(slug: string): Deck | undefined {
  return DECKS.find((d) => d.slug === slug);
}
