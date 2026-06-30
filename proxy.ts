import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { DEV_ONLY_AUTH_ENABLED, MOCK_AUTH_COOKIE, PUBLIC_POST_CREATOR_ROLES } from "@/lib/auth/constants";
import { getDefaultSeedUser, getSeedUserById } from "@/lib/auth/mock-users";
import { OWNER_ADMIN_USER_ID } from "@/lib/identity/constants";

const ADMIN_SESSION_IDS = new Set(["user_admin_riley_morgan", OWNER_ADMIN_USER_ID]);

function isSeededDemoSessionId(value: string | null | undefined) {
  return Boolean(value?.startsWith("user_"));
}

function isPubliclyReachablePath(pathname: string) {
  return (
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/account/verify-email" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    /\.(?:ico|png|jpg|jpeg|svg|webp|gif|css|js|map|txt|xml)$/.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionUserId = request.cookies.get(MOCK_AUTH_COOKIE)?.value ?? null;

  if (!DEV_ONLY_AUTH_ENABLED && request.method === "GET" && !isPubliclyReachablePath(pathname)) {
    if (!sessionUserId || isSeededDemoSessionId(sessionUserId)) {
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("next", pathname);
      const response = NextResponse.redirect(authUrl);
      if (sessionUserId && isSeededDemoSessionId(sessionUserId)) {
        response.cookies.delete(MOCK_AUTH_COOKIE);
      }
      return response;
    }
  }

  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin/");

  if (isAdminPage || isAdminApi) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
