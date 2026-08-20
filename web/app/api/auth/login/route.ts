import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { baseUrl } from "@/lib/auth";

// Start the GitHub OAuth authorization-code flow.
export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "GITHUB_CLIENT_ID not set" }, { status: 500 });
  }

  // CSRF guard: a random state we hand to GitHub and re-check on callback.
  const state = crypto.randomUUID();
  (await cookies()).set("lt_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes to complete the round-trip
  });

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${await baseUrl()}/api/auth/callback`);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "false");

  return NextResponse.redirect(url.toString());
}
