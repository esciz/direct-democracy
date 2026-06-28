import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { MOCK_AUTH_COOKIE, PUBLIC_POST_CREATOR_ROLES } from "@/lib/auth/constants";
import { getDefaultSeedUser, getSeedUserById } from "@/lib/auth/mock-users";
import { OWNER_ADMIN_USER_ID } from "@/lib/identity/constants";

const ADMIN_SESSION_IDS = new Set(["user_admin_riley_morgan", OWNER_ADMIN_USER_ID]);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin/");

  if (isAdminPage || isAdminApi) {
    const sessionUserId = request.cookies.get(MOCK_AUTH_COOKIE)?.value ?? null;
    const isAdmin = sessionUserId ? ADMIN_SESSION_IDS.has(sessionUserId) : false;

    if (isAdmin) return NextResponse.next();

    if (isAdminApi) {
      return NextResponse.json({ ok: false, error: sessionUserId ? "forbidden" : "unauthorized" }, { status: sessionUserId ? 403 : 401 });
    }

    if (!sessionUserId) {
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(authUrl);
    }

    const deniedUrl = new URL("/", request.url);
    deniedUrl.searchParams.set("admin", "forbidden");
    return NextResponse.redirect(deniedUrl);
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
  matcher: ["/feed/create", "/posts/create", "/admin", "/admin/:path*", "/api/admin/:path*"],
};
