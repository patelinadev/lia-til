import type { ReactNode } from "react";

// ---- lightweight syntax highlighter (no dependency) --------------------------
const KEYWORDS = new Set([
  "def", "return", "for", "while", "if", "elif", "else", "in", "not", "and", "or", "is",
  "class", "import", "from", "as", "with", "try", "except", "finally", "raise", "lambda",
  "yield", "pass", "break", "continue", "global", "nonlocal", "del", "assert", "self",
  "const", "let", "var", "function", "new", "this", "typeof", "instanceof", "export",
  "default", "extends", "interface", "type", "enum", "implements", "public", "private",
  "protected", "static", "readonly", "void", "super", "of", "case", "switch", "do", "throw",
  "catch", "async", "await", "True", "False", "None", "null", "undefined", "true", "false",
]);
const SQL = new Set([
  "select", "from", "where", "join", "left", "right", "inner", "outer", "on", "group", "by",
  "order", "having", "limit", "offset", "insert", "into", "values", "update", "set", "delete",
  "create", "table", "drop", "alter", "primary", "key", "foreign", "references", "distinct",
  "count", "sum", "avg", "min", "max", "like", "between", "union", "index", "as", "and", "or",
]);
const isKeyword = (t: string) => KEYWORDS.has(t) || SQL.has(t.toLowerCase());

const TOKEN =
  /(#[^\n]*|\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d[\w.]*)|([A-Za-z_$][\w$]*)|(\s+|[\s\S])/g;

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let m: RegExpExecArray | null;
  let k = 0;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code)) !== null) {
    const [full, comment, str, num, ident] = m;
    if (comment) out.push(<span key={k++} className="italic text-neutral-400 dark:text-neutral-500">{comment}</span>);
    else if (str) out.push(<span key={k++} className="text-emerald-600 dark:text-emerald-400">{str}</span>);
    else if (num) out.push(<span key={k++} className="text-amber-600 dark:text-amber-500">{num}</span>);
    else if (ident) {
      if (isKeyword(ident)) out.push(<span key={k++} className="text-violet-600 dark:text-violet-400">{ident}</span>);
      else if (code[TOKEN.lastIndex] === "(") out.push(<span key={k++} className="text-blue-600 dark:text-blue-400">{ident}</span>);
      else out.push(<span key={k++}>{ident}</span>);
    } else out.push(<span key={k++}>{full}</span>);
  }
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      {lang && (
        <div className="border-b border-neutral-200 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-400 dark:border-neutral-800">
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-[12.5px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          {highlight(code)}
        </code>
      </pre>
    </div>
  );
}

/** Minimal inline markdown: [text](url) links, **bold**, and `code` (everything
 * else stays literal). Internal links (starting with "/") render as a normal
 * `<a>` — a full navigation, which is exactly what we want when a link inside the
 * Index drawer jumps you to a day page (the drawer closes as the page changes). */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const [, label, href] = link;
          const external = /^https?:\/\//.test(href);
          return (
            <a
              key={i}
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-blue-600 underline decoration-blue-600/30 underline-offset-2 transition-colors hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:decoration-blue-400"
            >
              {label}
              {external && <span aria-hidden className="ml-0.5 text-[0.85em] opacity-70">↗</span>}
            </a>
          );
        }
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-neutral-800 dark:text-neutral-200">
              {p.slice(2, -2)}
            </strong>
          );
        }
        if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
          return (
            <code key={i} className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[0.85em] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {p.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{p}</span>;
      })}
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

    // ---- fenced code block ----
    if (t.startsWith("```")) {
      const lang = t.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { code.push(lines[i]); i++; }
      i++; // skip the closing fence
      blocks.push(<CodeBlock key={key++} code={code.join("\n")} lang={lang} />);
      continue;
    }

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
