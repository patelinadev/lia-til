import { NextResponse } from "next/server";
import { baseUrl } from "@/lib/auth";
import { deleteSession } from "@/lib/session";

export async function POST() {
  await deleteSession();
  return NextResponse.redirect(`${await baseUrl()}/`, { status: 303 });
}
