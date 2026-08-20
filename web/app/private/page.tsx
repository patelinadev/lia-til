import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata = {
  title: "Private · Lia's Learning Progress",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const AREAS = [
  {
    href: "/private/applications",
    title: "Applications",
    blurb: "The full ledger — every company, role, status, and note.",
  },
  {
    href: "/private/daily-log",
    title: "Daily Log",
    blurb: "The full log, day by day — beyond the curated public timeline.",
  },
];

export default async function PrivateHubPage() {
  const session = await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Private area</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
        Welcome back, {session.name ?? session.login}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Only you can see these. Use the bar at the top to jump between the public site and here anytime.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {AREAS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group rounded-xl border border-neutral-200 p-5 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold group-hover:underline">{a.title}</h2>
              <span className="text-neutral-400 transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </div>
            <p className="mt-1.5 text-sm text-neutral-500">{a.blurb}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
