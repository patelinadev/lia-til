import Link from "next/link";
import { currentAdmin } from "@/lib/auth";

const PUBLIC = [
  { href: "/", label: "Home" },
  { href: "/leetcode", label: "LeetCode" },
  { href: "/daily-log", label: "Daily Log" },
  { href: "/applications", label: "Applications" },
  { href: "/system-design", label: "System Design" },
];

const PRIVATE = [
  { href: "/private/applications", label: "Applications" },
  { href: "/private/daily-log", label: "Daily Log" },
];

/** A slim bar shown only to the signed-in owner, on every page — the single
 * place to hop between the public site and the private views. Renders nothing
 * for public visitors. */
export default async function AdminNav() {
  const session = await currentAdmin();
  if (!session) return null;

  return (
    <div className="sticky top-0 z-50 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-xs">
        <Link href="/private" className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
          🔒 {session.login}
        </Link>

        <span className="text-neutral-300 dark:text-neutral-700">Public</span>
        {PUBLIC.map((l) => (
          <Link key={l.href} href={l.href} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            {l.label}
          </Link>
        ))}

        <span className="ml-1 text-neutral-300 dark:text-neutral-700">Private</span>
        {PRIVATE.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="font-medium text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
          >
            {l.label}
          </Link>
        ))}

        <form action="/api/auth/logout" method="post" className="ml-auto">
          <button type="submit" className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300">
            Sign out
          </button>
        </form>
      </nav>
    </div>
  );
}
