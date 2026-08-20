import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getFullApplications } from "@/lib/private";
import ApplicationsExplorer from "./ApplicationsExplorer";

export const metadata = {
  title: "Private · Applications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

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
        <ApplicationsExplorer apps={apps} />
      )}
    </main>
  );
}
