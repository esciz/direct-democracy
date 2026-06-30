import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { clearAuthSessionCookies } from "@/lib/auth/cookies";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  clearAuthSessionCookies(cookieStore);

  return NextResponse.redirect(new URL("/auth", request.url));
}

export async function POST(request: NextRequest) {
  return GET(request);
}
