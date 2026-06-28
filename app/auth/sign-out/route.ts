import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { MOCK_AUTH_COOKIE } from "@/lib/auth/constants";
import { MFA_SESSION_COOKIE } from "@/lib/identity/mfa-session";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(MOCK_AUTH_COOKIE);
  cookieStore.delete(MFA_SESSION_COOKIE);

  return NextResponse.redirect(new URL("/auth", request.url));
}

export async function POST(request: NextRequest) {
  return GET(request);
}
