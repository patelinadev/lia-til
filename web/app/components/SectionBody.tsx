import type { ReactNode } from "react";

/** Minimal inline markdown: **bold** only (everything else stays literal). */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-neutral-800 dark:text-neutral-200">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSep = (l: string) => /^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/.test(l);
const cells = (l: string) =>
  l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/**
 * Render a vault section's markdown-ish content:
 *  - `- [ ]` / `- [x]`  -> checkbox items (todo visualization)
 *  - `| a | b |` blocks -> real tables (e.g. Timeline)
 *  - `### x`            -> sub-heading
 *  - `- x`              -> bullets ; else paragraphs. Inline **bold**.
 */
export default function SectionBody({ md }: { md: string }) {
  const lines = md.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }

    // ---- table ----
    if (isRow(lines[i])) {
      const raw: string[] = [];
      while (i < lines.length && isRow(lines[i])) { raw.push(lines[i]); i++; }
      const rows = raw.filter((r) => !isSep(r)).map(cells);
      if (rows.length === 0) continue;
      const [header, ...body] = rows;
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((c, j) => (
                  <th key={j} className="border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-left font-medium dark:border-neutral-800 dark:bg-neutral-900">
                    <Inline text={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, j) => (
                    <td key={j} className="border border-neutral-200 px-2.5 py-1 align-top text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                      <Inline text={c} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // ---- sub-heading ----
    const h = t.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      blocks.push(
        <p key={key++} className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {h[1]}
        </p>,
      );
      i++;
      continue;
    }

    // ---- bullet / checkbox list ----
    if (/^[-*]\s/.test(t)) {
      const items: { checked: boolean | null; text: string }[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        const lt = lines[i].trim();
        const cb = lt.match(/^[-*]\s*\[([ xX])\]\s*(.*)$/);
        if (cb) items.push({ checked: cb[1].toLowerCase() === "x", text: cb[2] });
        else items.push({ checked: null, text: lt.replace(/^[-*]\s+/, "") });
        i++;
      }
      const real = items.filter((it) => it.text.trim());
      if (real.length === 0) continue;
      blocks.push(
        <ul key={key++} className="my-1.5 flex flex-col gap-1.5">
          {real.map((it, j) => (
            <li key={j} className="flex gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              {it.checked === null ? (
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
              ) : (
                <span aria-hidden className={`shrink-0 ${it.checked ? "text-emerald-500" : "text-neutral-400 dark:text-neutral-500"}`}>
                  {it.checked ? "☑" : "☐"}
                </span>
              )}
              <span className={it.checked ? "text-neutral-500 dark:text-neutral-400" : ""}>
                <Inline text={it.text} />
              </span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // ---- paragraph ----
    blocks.push(
      <p key={key++} className="my-1.5 text-sm text-neutral-600 dark:text-neutral-400">
        <Inline text={t} />
      </p>,
    );
    i++;
  }

  return <div>{blocks}</div>;
}
