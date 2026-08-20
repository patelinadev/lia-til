import Link from "next/link";

export const metadata = {
  title: "Access denied · Lia's Learning Progress",
  robots: { index: false, follow: false },
};

const REASONS: Record<string, string> = {
  not_allowed: "That GitHub account isn't the owner of this site, so the private view stays locked.",
  state: "The sign-in request expired or didn't match. Please try again.",
  token: "GitHub didn't return a valid token. Please try again.",
  config: "Sign-in isn't fully configured yet.",
};

export default async function DeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = REASONS[reason ?? ""] ?? "You don't have access to the private view.";

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">Access denied</p>
      <h1 className="mt-2 text-2xl font-bold">Not this time</h1>
      <p className="mt-3 text-sm text-neutral-500">{message}</p>
      <div className="mt-6 flex gap-3 text-sm">
        <Link href="/" className="underline hover:text-neutral-800 dark:hover:text-neutral-300">
          Back to the public site
        </Link>
        {reason !== "not_allowed" && (
          <Link href="/api/auth/login" className="underline hover:text-neutral-800 dark:hover:text-neutral-300">
            Try again
          </Link>
        )}
      </div>
    </main>
  );
}
