import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin/session-token";
import { MOCK_AUTH_COOKIE, PUBLIC_POST_CREATOR_ROLES } from "@/lib/auth/constants";
import { getDefaultSeedUser, getSeedUserById } from "@/lib/auth/mock-users";

async function hasValidAdminSession(request: NextRequest) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!email || !secret) {
    return false;
  }

  const session = await verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, secret);
  return session?.email === email;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (await hasValidAdminSession(request)) {
      return NextResponse.next();
    }

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!pathname.startsWith("/feed/create") && !pathname.startsWith("/posts/create")) {
    return NextResponse.next();
  }

  const userId = request.cookies.get(MOCK_AUTH_COOKIE)?.value;
  const user = getSeedUserById(userId) ?? getDefaultSeedUser();

  if (PUBLIC_POST_CREATOR_ROLES.includes(user.role)) {
    return NextResponse.next();
  }

  const deniedUrl = new URL("/posts", request.url);
  deniedUrl.searchParams.set("denied", "create-post");

  return NextResponse.redirect(deniedUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/feed/create", "/posts/create"],
};
