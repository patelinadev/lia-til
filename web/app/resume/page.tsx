import Link from "next/link";
import { fetchJsonWithRetry } from "@/lib/net";
import DataError from "@/app/components/DataError";
import SectionBody from "@/app/components/SectionBody";
import type { ResumeRow } from "@/lib/private";

export const metadata = {
  title: "Résumé · Lia's Learning Progress",
};

// Render at request time so the page always shows the latest published résumé.
export const dynamic = "force-dynamic";
// Allow the request to wait out a cold backend start (Render free tier ~40s).
export const maxDuration = 60;

/** Fetch the PUBLIC base résumé. Distinguishes three states:
 *  - undefined  → backend unset/unreachable (show an error state)
 *  - null       → reachable, but no résumé published yet (show empty state)
 *  - ResumeRow  → the base résumé */
async function getBaseResume(): Promise<ResumeRow | null | undefined> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  if (!base) return undefined;
  const data = await fetchJsonWithRetry<{ resume: ResumeRow | null }>(`${base}/api/resume`);
  if (!data) return undefined;
  return data.resume ?? null;
}

export default async function ResumePage() {
  const resume = await getBaseResume();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 sm:py-16">
      <Link
        href="/"
        className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        &larr; Learning Progress
      </Link>

      <div className="mt-6 mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-bold sm:text-4xl">Résumé</h1>
        {resume?.date && (
          <span className="font-mono text-sm text-neutral-400">updated {resume.date}</span>
        )}
      </div>

      {resume === undefined ? (
        <DataError label="the résumé" />
      ) : resume === null ? (
        <p className="mt-6 text-neutral-500">No résumé has been published yet.</p>
      ) : resume.format === "tex" ? (
        // No LaTeX renderer on the web — show the source in a scrollable block.
        <pre className="mt-6 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs leading-relaxed dark:border-neutral-800 dark:bg-neutral-900">
          {resume.body}
        </pre>
      ) : (
        <div className="mt-6">
          <SectionBody md={resume.body ?? ""} />
        </div>
      )}
    </main>
  );
}
