import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { MOCK_AUTH_COOKIE, PUBLIC_POST_CREATOR_ROLES } from "@/lib/auth/constants";
import { getDefaultSeedUser, getSeedUserById } from "@/lib/auth/mock-users";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/feed/create") && !request.nextUrl.pathname.startsWith("/posts/create")) {
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
  matcher: ["/feed/create", "/posts/create"],
};
