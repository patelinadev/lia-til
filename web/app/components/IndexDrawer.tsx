"use client";

import { useCallback, useEffect, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

const SEEN_KEY = "idx_seen_v1";

/**
 * The private INDEX / TL;DR navigator, shown as a right-side slide-over drawer.
 *
 *  - A "📖 Index" pill (rendered inline where mounted) opens it on demand.
 *  - `autoOpen` (the list page) greets the FIRST visit of a session with the
 *    drawer as a book-like cover; closing it remembers that for the session, so
 *    it never nags again — the pill still reopens it anytime.
 *  - A click on any link inside jumps you there (full navigation) and closes the
 *    drawer on the way out; Esc or a tap on the backdrop also closes it.
 *
 * The markdown itself is rendered server-side (SectionBody) and passed in as
 * `children`, so this stays a thin client shell.
 */
export default function IndexDrawer({
  updatedAt,
  autoOpen = false,
  children,
}: {
  updatedAt?: string | null;
  autoOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode / storage disabled — just don't persist */
    }
  }, []);

  // First visit of the session → auto-open as a cover (list page only).
  // sessionStorage is readable only after mount, so this genuinely synchronizes
  // React state with an external system; starting closed (vs open-then-close)
  // avoids a drawer flash for returning visitors on every list load.
  useEffect(() => {
    if (!autoOpen) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!sessionStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, [autoOpen]);

  // Esc closes while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // A click on a link that navigates away closes the drawer as it goes; in-page
  // TOC anchors (href="#…", which just scroll within the drawer) must NOT close it.
  const onContentClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (a && !a.getAttribute("href")?.startsWith("#")) close();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-sm text-neutral-600 transition-colors hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-500 dark:hover:text-neutral-100"
      >
        <span aria-hidden>📖</span> Index
      </button>

      {/* backdrop */}
      <div
        aria-hidden
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* slide-over panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Index"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl transition-transform duration-200 dark:border-neutral-800 dark:bg-neutral-950 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">📖 Index</h2>
            {updatedAt && (
              <span className="font-mono text-[11px] text-neutral-400">updated {updatedAt}</span>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close index"
            className="rounded-md px-2 py-1 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            Close ✕
          </button>
        </header>

        <div onClick={onContentClick} className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        <footer className="border-t border-neutral-200 px-5 py-2 text-center text-[11px] text-neutral-400 dark:border-neutral-800">
          Esc or tap outside to close · a link jumps you there
        </footer>
      </aside>
    </>
  );
}
