import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

// The signed session cookie. Contains only the minimum identity we need — never
// the GitHub access token. Signed (HS256) with AUTH_SECRET so it can't be forged.
const COOKIE = "lt_session";
const MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days

export type Session = { login: string; name?: string; avatar?: string };

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(key());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.login !== "string") return null;
    return {
      login: payload.login,
      name: typeof payload.name === "string" ? payload.name : undefined,
      avatar: typeof payload.avatar === "string" ? payload.avatar : undefined,
    };
  } catch {
    return null; // expired, tampered, or wrong secret
  }
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
