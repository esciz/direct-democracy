import "server-only";

import { cookies } from "next/headers";

const FOLLOWED_COMMUNITIES_COOKIE = "dd_followed_communities";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

export async function getFollowedCommunityIds() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FOLLOWED_COMMUNITIES_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return isStringArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setFollowedCommunityIds(ids: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(FOLLOWED_COMMUNITIES_COOKIE, JSON.stringify(ids.slice(0, 20)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}
