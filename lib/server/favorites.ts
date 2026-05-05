import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getCurrentUser } from "@/lib/server/auth-session";
import type { FavoriteRecord, FavoriteTargetType } from "@/lib/favorites/types";

const FAVORITES_COOKIE = "dd_favorites";

const seededFavorites: FavoriteRecord[] = [
  {
    userId: "user_guest_browse",
    targetType: "community",
    targetId: "carson-city",
    createdAt: "2026-04-07T16:00:00.000Z",
  },
  {
    userId: "user_guest_browse",
    targetType: "official",
    targetId: "profile_elena_ramirez",
    createdAt: "2026-04-08T16:00:00.000Z",
  },
  {
    userId: "user_guest_browse",
    targetType: "petition",
    targetId: "petition_carson_meeting_archives",
    createdAt: "2026-04-09T16:00:00.000Z",
  },
  {
    userId: "user_guest_browse",
    targetType: "election",
    targetId: "election_carson_mayor_2026",
    createdAt: "2026-04-10T16:00:00.000Z",
  },
  {
    userId: "user_citizen_tiana_moore",
    targetType: "community",
    targetId: "carson-city",
    createdAt: "2026-04-11T16:00:00.000Z",
  },
  {
    userId: "user_citizen_tiana_moore",
    targetType: "candidate",
    targetId: "profile_sofia_bennett",
    createdAt: "2026-04-12T16:00:00.000Z",
  },
  {
    userId: "user_trusted_citizen_nora_patel",
    targetType: "event",
    targetId: "event_interview_nora_sofia_water",
    createdAt: "2026-04-03T18:00:00.000Z",
  },
  {
    userId: "user_candidate_sofia_bennett",
    targetType: "event",
    targetId: "event_interview_nora_sofia_water",
    createdAt: "2026-04-03T18:00:00.000Z",
  },
  {
    userId: "user_trusted_citizen_hannah_cho",
    targetType: "event",
    targetId: "event_interview_hannah_david_growth",
    createdAt: "2026-04-06T18:05:00.000Z",
  },
  {
    userId: "user_official_david_park",
    targetType: "event",
    targetId: "event_interview_hannah_david_growth",
    createdAt: "2026-04-06T18:05:00.000Z",
  },
];

function isFavoriteRecord(value: unknown): value is FavoriteRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.userId === "string" &&
    typeof record.targetType === "string" &&
    typeof record.targetId === "string" &&
    typeof record.createdAt === "string"
  );
}

async function getStoredFavorites() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(FAVORITES_COOKIE)?.value;

  if (!raw) {
    return [] as FavoriteRecord[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isFavoriteRecord) : [];
  } catch {
    return [];
  }
}

async function setStoredFavorites(favorites: FavoriteRecord[]) {
  const cookieStore = await cookies();
  cookieStore.set(FAVORITES_COOKIE, JSON.stringify(favorites), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function addFavoriteForUser(userId: string, targetType: FavoriteTargetType, targetId: string) {
  const stored = await getStoredFavorites();
  const exists = stored.some(
    (record) => record.userId === userId && record.targetType === targetType && record.targetId === targetId,
  );

  if (exists) {
    return { favorited: true };
  }

  await setStoredFavorites([
    {
      userId,
      targetType,
      targetId,
      createdAt: new Date().toISOString(),
    },
    ...stored,
  ]);

  return { favorited: true };
}

export async function getFavoritesForUser(userId: string) {
  const stored = await getStoredFavorites();
  const merged = new Map<string, FavoriteRecord>();

  for (const record of seededFavorites) {
    merged.set(`${record.userId}:${record.targetType}:${record.targetId}`, record);
  }

  for (const record of stored) {
    merged.set(`${record.userId}:${record.targetType}:${record.targetId}`, record);
  }

  return [...merged.values()]
    .filter((record) => record.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function isFavoriteForUser(userId: string, targetType: FavoriteTargetType, targetId: string) {
  const favorites = await getFavoritesForUser(userId);
  return favorites.some((record) => record.targetType === targetType && record.targetId === targetId);
}

export async function toggleFavoriteForUser(userId: string, targetType: FavoriteTargetType, targetId: string) {
  const stored = await getStoredFavorites();
  const existing = stored.find(
    (record) => record.userId === userId && record.targetType === targetType && record.targetId === targetId,
  );

  if (existing) {
    const next = stored.filter(
      (record) => !(record.userId === userId && record.targetType === targetType && record.targetId === targetId),
    );
    await setStoredFavorites(next);
    return { favorited: false };
  }

  const next = [
    ...stored,
    {
      userId,
      targetType,
      targetId,
      createdAt: new Date().toISOString(),
    } satisfies FavoriteRecord,
  ];
  await setStoredFavorites(next);
  return { favorited: true };
}

const getCurrentViewerFavorites = cache(async () => {
  const user = await getCurrentUser();
  const favorites = await getFavoritesForUser(user.id);
  return { user, favorites };
});

export const isFavoriteForCurrentViewer = cache(async (targetType: FavoriteTargetType, targetId: string) => {
  const { favorites } = await getCurrentViewerFavorites();
  return favorites.some((record) => record.targetType === targetType && record.targetId === targetId);
});
