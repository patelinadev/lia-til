import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { baseUrl, allowedLogin } from "@/lib/auth";
import { createSession } from "@/lib/session";

// GitHub redirects back here with ?code & ?state. We verify state, exchange the
// code for an access token, fetch the user, and — only if it's the allowed
// login — mint a session and send them to /private.
export async function GET(request: Request) {
  const base = await baseUrl();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get("lt_oauth_state")?.value;
  store.delete("lt_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${base}/private/denied?reason=state`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/private/denied?reason=config`);
  }

  // 1. Exchange the code for an access token.
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${base}/api/auth/callback`,
    }),
    cache: "no-store",
  });
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) {
    return NextResponse.redirect(`${base}/private/denied?reason=token`);
  }

  // 2. Fetch the GitHub user behind that token.
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  const user = (await userRes.json()) as { login?: string; name?: string; avatar_url?: string };

  // 3. Allowlist check — only the configured login gets a session.
  const allowed = allowedLogin();
  if (!user.login || !allowed || user.login.toLowerCase() !== allowed.toLowerCase()) {
    return NextResponse.redirect(`${base}/private/denied?reason=not_allowed`);
  }

  await createSession({ login: user.login, name: user.name, avatar: user.avatar_url });
  return NextResponse.redirect(`${base}/private`);
}
