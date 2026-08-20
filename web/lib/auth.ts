import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession, type Session } from "./session";

/** Only this GitHub login is allowed in. Everyone else is a public visitor. */
export function allowedLogin(): string | undefined {
  return process.env.ALLOWED_GITHUB_LOGIN;
}

export function isAllowed(session: Session | null): boolean {
  const allowed = allowedLogin();
  return !!session && !!allowed && session.login.toLowerCase() === allowed.toLowerCase();
}

/** Memoized per request — the admin session, or null for a public visitor. */
export const currentAdmin = cache(async (): Promise<Session | null> => {
  const session = await getSession();
  return isAllowed(session) ? session : null;
});

/** For a protected page/handler: return the admin session or bounce to login. */
export async function requireAdmin(): Promise<Session> {
  const session = await currentAdmin();
  if (!session) redirect("/api/auth/login");
  return session;
}

/** The site's public origin, derived from the proxy headers (so the OAuth
 * redirect_uri matches whatever host served the request). */
export async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
