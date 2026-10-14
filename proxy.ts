import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { DEV_ONLY_AUTH_ENABLED, MOCK_AUTH_COOKIE, PUBLIC_POST_CREATOR_ROLES } from "@/lib/auth/constants";
import { getAuthCookieDeleteOptions } from "@/lib/auth/cookies";
import { getSeedUserById } from "@/lib/auth/mock-users";
import { resolveDurableSession } from "@/lib/identity/durable-sessions";
import { isIdentitySessionToken } from "@/lib/identity/session-tokens";
import type { UserRole } from "@/types/domain";

function isPubliclyReachablePath(pathname: string) {
  return (
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/account/verify-email" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/root-striker-lab" ||
    pathname.startsWith("/infographics/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    /\.(?:html|ico|png|jpg|jpeg|svg|webp|gif|css|js|map|txt|xml|webmanifest)$/.test(pathname)
  );
}

function isPrivateAccountPath(pathname: string) {
  return pathname === "/profile" || pathname.startsWith("/profile/") || pathname === "/messages" || pathname.startsWith("/messages/") || pathname === "/notifications" || pathname === "/get-started" || (pathname.startsWith("/account/") && pathname !== "/account/verify-email" && pathname !== "/account/reset-password");
}

function expireSessionCookie(response: NextResponse) {
  response.cookies.delete(MOCK_AUTH_COOKIE);
  const deleteOptions = getAuthCookieDeleteOptions();
  if (!deleteOptions.domain) return;
  response.cookies.set(MOCK_AUTH_COOKIE, "", {
    ...deleteOptions,
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionValue = request.cookies.get(MOCK_AUTH_COOKIE)?.value ?? null;
  const demoUser = DEV_ONLY_AUTH_ENABLED && !isIdentitySessionToken(sessionValue) ? getSeedUserById(sessionValue ?? undefined) : null;
  const needsSession = isPrivateAccountPath(pathname) || pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/") || pathname.startsWith("/feed/create") || pathname.startsWith("/posts/create");
  let durableSession: Awaited<ReturnType<typeof resolveDurableSession>> = null;
  if (needsSession && isIdentitySessionToken(sessionValue)) {
    try { durableSession = await resolveDurableSession(sessionValue); }
    catch { return NextResponse.json({ ok: false, error: "authentication_unavailable" }, { status: 503 }); }
  }
  const authenticated = Boolean(durableSession || demoUser);

  if (!DEV_ONLY_AUTH_ENABLED && request.method === "GET" && isPrivateAccountPath(pathname) && !isPubliclyReachablePath(pathname)) {
    if (!authenticated) {
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      const response = NextResponse.redirect(authUrl);
      if (sessionValue) {
        expireSessionCookie(response);
      }
      return response;
    }
  }

  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin/");

  if (isAdminPage || isAdminApi) {
    const role = durableSession?.account.role ?? demoUser?.role;
    const isAdmin = role === "admin" || role === "platform_admin" || role === "moderator" || Boolean(durableSession?.account.permissionGrants.some((grant) => grant.permission.startsWith("dataops.") || grant.permission.startsWith("identity.")));

    if (isAdmin) return NextResponse.next();

    if (isAdminApi) {
      return NextResponse.json({ ok: false, error: authenticated ? "forbidden" : "unauthorized" }, { status: authenticated ? 403 : 401 });
    }

    if (!authenticated) {
      const authUrl = new URL("/auth", request.url);
      authUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(authUrl);
    }

    const deniedUrl = new URL("/", request.url);
    deniedUrl.searchParams.set("admin", "forbidden");
    return NextResponse.redirect(deniedUrl);
  }

  if (!pathname.startsWith("/feed/create") && !pathname.startsWith("/posts/create")) {
    return NextResponse.next();
  }

  const role = durableSession?.account.role ?? demoUser?.role;
  if (role && PUBLIC_POST_CREATOR_ROLES.includes(role as UserRole)) {
    return NextResponse.next();
  }

  const deniedUrl = new URL("/posts", request.url);
  deniedUrl.searchParams.set("denied", "create-post");

  return NextResponse.redirect(deniedUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
