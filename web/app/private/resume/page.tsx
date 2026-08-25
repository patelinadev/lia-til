import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getFullResumes, type ResumeRow } from "@/lib/private";
import SectionBody from "@/app/components/SectionBody";
import DataError from "@/app/components/DataError";

export const metadata = {
  title: "Résumés · Private",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
// Allow the request to wait out a cold backend start (Render free tier ~40s).
export const maxDuration = 60;

function ResumeBody({ r }: { r: ResumeRow }) {
  if (!r.body) return <p className="text-sm text-neutral-400">No content.</p>;
  if (r.format === "tex") {
    return (
      <pre className="overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed dark:border-neutral-800 dark:bg-neutral-900">
        {r.body}
      </pre>
    );
  }
  return <SectionBody md={r.body} />;
}

export default async function PrivateResumePage() {
  await requireAdmin();
  const resumes = await getFullResumes();

  const back = (
    <Link
      href="/private"
      className="text-sm text-neutral-500 transition-colors hover:text-neutral-800 dark:hover:text-neutral-300"
    >
      &larr; Private
    </Link>
  );

  if (resumes === null) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        {back}
        <DataError label="the résumé archive" />
      </main>
    );
  }

  const base = resumes.find((r) => r.kind === "base");
  const tailored = resumes.filter((r) => r.kind !== "base");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      {back}

      <h1 className="mt-6 text-3xl font-bold sm:text-4xl">Résumés</h1>
      <p className="mt-2 text-sm text-neutral-500">
        The master résumé (public) and every tailored version (private). {tailored.length}{" "}
        tailored.
      </p>

      {/* base / master */}
      <section className="mt-8">
        <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
          Master · public
        </p>
        {base ? (
          <details open className="mt-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <summary className="cursor-pointer select-none font-semibold">
              base{base.date ? ` · ${base.date}` : ""}
            </summary>
            <div className="mt-3">
              <ResumeBody r={base} />
            </div>
          </details>
        ) : (
          <p className="mt-2 text-sm text-neutral-400">No master résumé published yet.</p>
        )}
      </section>

      {/* tailored */}
      <section className="mt-8">
        <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
          Tailored · private
        </p>
        {tailored.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">No tailored résumés yet.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-3">
            {tailored.map((r) => (
              <details key={r.slug} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <summary className="cursor-pointer select-none">
                  <span className="font-semibold">{r.company ?? r.slug}</span>
                  {r.role ? <span className="text-neutral-500"> · {r.role}</span> : null}
                  <span className="ml-2 font-mono text-xs text-neutral-400">
                    {r.appNum != null ? `app #${r.appNum}` : ""}
                    {r.date ? ` · ${r.date}` : ""}
                  </span>
                </summary>
                <div className="mt-3">
                  <ResumeBody r={r} />
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
