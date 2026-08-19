import type { ReactNode } from "react";

/* Theme-aware box-and-arrow diagrams, recreated from the System Design Basics
   app slides. Monospace labels; colors adapt to light/dark. */

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/40">
      {children}
    </div>
  );
}

function Box({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "orange" | "green" | "orangeFill";
}) {
  const tones: Record<string, string> = {
    neutral: "border-neutral-300 text-neutral-700 dark:border-neutral-600 dark:text-neutral-200",
    blue: "border-blue-400 text-blue-700 dark:border-blue-500 dark:text-blue-300",
    orange: "border-orange-400 text-orange-700 dark:border-orange-500 dark:text-orange-300",
    green: "border-emerald-500 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300",
    orangeFill: "border-orange-500 bg-orange-500 text-white dark:bg-orange-600 dark:border-orange-600",
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg border px-3 py-1.5 font-mono text-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Down() {
  return <span className="my-1 block text-center text-neutral-400 dark:text-neutral-500">↓</span>;
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-center font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
      {children}
    </p>
  );
}

/* Deck 1 · slide 1 — Client → Load Balancer → Servers → DB */
export function DiagramLoadBalanced() {
  return (
    <Panel>
      <div className="flex flex-col items-center">
        <Box>Client</Box>
        <Down />
        <Box tone="blue">Load Bal.</Box>
        <Down />
        <div className="flex gap-3">
          <Box tone="blue">Server A</Box>
          <Box tone="blue">Server B</Box>
        </div>
        <Down />
        <Box tone="blue">DB</Box>
      </div>
    </Panel>
  );
}

/* Deck 1 · slide 2 — Client → Server → DB */
export function DiagramRequestResponse() {
  return (
    <Panel>
      <div className="flex flex-col items-center">
        <Box tone="blue">Client</Box>
        <Down />
        <Box tone="blue">Server</Box>
        <Down />
        <Box tone="blue">DB</Box>
      </div>
      <Caption>request / response</Caption>
    </Panel>
  );
}

/* Deck 1 · slide 3 — Stateful vs Stateless */
export function DiagramStatefulStateless() {
  return (
    <Panel>
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col items-center">
          <p className="mb-3 font-mono text-xs text-neutral-500">Stateful</p>
          <Box tone="orange">Client A</Box>
          <Down />
          <Box tone="orangeFill">Server A</Box>
          <p className="mt-3 font-mono text-[11px] text-neutral-400">must stick</p>
        </div>
        <div className="flex flex-col items-center">
          <p className="mb-3 font-mono text-xs text-neutral-500">Stateless</p>
          <Box tone="blue">Client A</Box>
          <Down />
          <div className="flex gap-2">
            <Box tone="blue">Srv 1</Box>
            <Box tone="blue">Srv 2</Box>
          </div>
          <p className="mt-3 font-mono text-[11px] text-neutral-400">any will do</p>
        </div>
      </div>
    </Panel>
  );
}

/* Deck 2 · slide 3 — REST vs GraphQL vs gRPC */
export function DiagramApiProtocols() {
  const items: { label: string; sub: string[]; tone: "blue" | "orange" | "green" }[] = [
    { label: "REST", sub: ["request/response", "GET /users"], tone: "blue" },
    { label: "GraphQL", sub: ["single endpoint", "{ user(id) }"], tone: "orange" },
    { label: "gRPC", sub: ["binary RPC", ".proto"], tone: "green" },
  ];
  const toneText: Record<string, string> = {
    blue: "border-blue-400 text-blue-700 dark:border-blue-500 dark:text-blue-300",
    orange: "border-orange-400 text-orange-700 dark:border-orange-500 dark:text-orange-300",
    green: "border-emerald-500 text-emerald-700 dark:border-emerald-500 dark:text-emerald-300",
  };
  return (
    <Panel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.label}
            className={`rounded-lg border px-3 py-3 text-center ${toneText[it.tone]}`}
          >
            <p className="font-mono text-sm font-semibold">{it.label}</p>
            {it.sub.map((s) => (
              <p key={s} className="mt-1 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                {s}
              </p>
            ))}
          </div>
        ))}
      </div>
    </Panel>
  );
}
