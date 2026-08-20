import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getFullApplications } from "@/lib/private";

export const metadata = {
  title: "Private · Applications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  Interviewing: "text-emerald-700 dark:text-emerald-400",
  "Heard back": "text-blue-700 dark:text-blue-400",
  Closed: "text-neutral-400 dark:text-neutral-500",
};

export default async function PrivateApplicationsPage() {
  await requireAdmin();
  const apps = await getFullApplications();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link
        href="/private"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; Private
      </Link>

      <div className="mt-6 mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Applications</h1>
        <p className="text-sm text-neutral-500">{apps.length} applications (full detail)</p>
      </div>
      <p className="mb-8 max-w-2xl text-sm text-neutral-500">
        The full ledger — every company, role, and note. The public
        <Link href="/applications" className="mx-1 underline hover:text-neutral-800 dark:hover:text-neutral-300">
          /applications
        </Link>
        page shows anonymized aggregates only.
      </p>

      {apps.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
          No rows returned. Check that <code>BACKEND_SECRET</code> matches between Vercel and Render, and
          that the ledger has been imported.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900/50">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Résumé</th>
                <th className="px-3 py-2 font-medium">Applied</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.appNum} className="border-t border-neutral-100 dark:border-neutral-800/60">
                  <td className="px-3 py-2 font-mono text-xs text-neutral-400">{a.appNum}</td>
                  <td className="px-3 py-2 font-medium">{a.company}</td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{a.role}</td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">{a.resume}</td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">{a.appliedDate}</td>
                  <td className={`px-3 py-2 ${STATUS_STYLES[a.status ?? ""] ?? "text-neutral-500"}`}>{a.status}</td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{a.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
