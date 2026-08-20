import "server-only";

export type FullApplication = {
  appNum: number;
  company: string | null;
  role: string | null;
  resume: string | null;
  appliedDate: string | null;
  status: string | null;
  notes: string | null;
};

/** Fetch the full ledger from the backend's private endpoint. The shared secret
 * lives only on the server; this is called only after the session is verified. */
export async function getFullApplications(): Promise<FullApplication[]> {
  const base = process.env.API_URL?.replace(/\/$/, "");
  const secret = process.env.BACKEND_SECRET;
  if (!base || !secret) return [];
  const res = await fetch(`${base}/api/applications/full`, {
    headers: { "x-admin-secret": secret },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { applications: FullApplication[] };
  return data.applications ?? [];
}
