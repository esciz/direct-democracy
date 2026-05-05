import { cookies } from "next/headers";
import { cache } from "react";

import { seedUsers } from "@/lib/auth/mock-users";
import { getCreatedPosts } from "@/lib/feed/posts";
import { applyPostReactionState } from "@/lib/feed/reactions";
import { mockPosts } from "@/lib/mock-data";
import type {
  MediaBiasRatingSummary,
  MediaBiasRatingValue,
  MediaBiasSummary,
  MediaProfileSummary,
  MediaTier,
  PostSummary,
} from "@/types/domain";

const MEDIA_BIAS_COOKIE = "dd_media_bias_ratings";

export const MEDIA_BIAS_VALUES: MediaBiasRatingValue[] = ["Far Left", "Left", "Center", "Right", "Far Right"];

const TIER_LABELS: Record<MediaTier, string> = {
  trustedSource: "Trusted Source",
  verifiedMedia: "Verified Media",
};

const seededBiasRatings: MediaBiasRatingSummary[] = [
  {
    id: "media_bias_1",
    userId: "user_citizen_alicia_hart",
    mediaUserId: "user_media_nevada_public_signal",
    rating: "Center",
    createdAt: "2026-04-01T10:15:00.000Z",
  },
  {
    id: "media_bias_2",
    userId: "user_trusted_citizen_nora_patel",
    mediaUserId: "user_media_nevada_public_signal",
    rating: "Center",
    createdAt: "2026-04-01T11:00:00.000Z",
  },
  {
    id: "media_bias_3",
    userId: "user_candidate_maya_ortega",
    mediaUserId: "user_media_nevada_public_signal",
    rating: "Left",
    createdAt: "2026-04-01T11:20:00.000Z",
  },
  {
    id: "media_bias_4",
    userId: "user_citizen_miles_reed",
    mediaUserId: "user_media_carson_civic_watch",
    rating: "Center",
    createdAt: "2026-04-01T12:10:00.000Z",
  },
  {
    id: "media_bias_5",
    userId: "user_trusted_citizen_marco_silva",
    mediaUserId: "user_media_carson_civic_watch",
    rating: "Left",
    createdAt: "2026-04-01T12:30:00.000Z",
  },
  {
    id: "media_bias_6",
    userId: "user_official_elena_ramirez",
    mediaUserId: "user_media_carson_civic_watch",
    rating: "Center",
    createdAt: "2026-04-01T13:00:00.000Z",
  },
];

function isMediaBiasRatingValue(value: unknown): value is MediaBiasRatingValue {
  return MEDIA_BIAS_VALUES.includes(value as MediaBiasRatingValue);
}

function isMediaBiasRatingSummary(value: unknown): value is MediaBiasRatingSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rating = value as Record<string, unknown>;
  return (
    typeof rating.id === "string" &&
    typeof rating.userId === "string" &&
    typeof rating.mediaUserId === "string" &&
    isMediaBiasRatingValue(rating.rating) &&
    typeof rating.createdAt === "string"
  );
}

export function getMediaTierLabel(tier: MediaTier) {
  return TIER_LABELS[tier];
}

export async function getStoredMediaBiasRatings(): Promise<MediaBiasRatingSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(MEDIA_BIAS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isMediaBiasRatingSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredMediaBiasRatings(ratings: MediaBiasRatingSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(MEDIA_BIAS_COOKIE, JSON.stringify(ratings.slice(0, 400)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getAllMediaBiasRatings() {
  const merged = new Map<string, MediaBiasRatingSummary>();

  for (const rating of seededBiasRatings) {
    merged.set(`${rating.userId}:${rating.mediaUserId}`, rating);
  }

  for (const rating of await getStoredMediaBiasRatings()) {
    merged.set(`${rating.userId}:${rating.mediaUserId}`, rating);
  }

  return [...merged.values()];
}

export async function getMediaBiasSummary(mediaUserId: string, viewerUserId?: string): Promise<MediaBiasSummary> {
  const ratings = (await getAllMediaBiasRatings()).filter((entry) => entry.mediaUserId === mediaUserId);
  const totalRatings = ratings.length;
  const viewerRating = viewerUserId ? ratings.find((entry) => entry.userId === viewerUserId)?.rating ?? null : null;

  const distribution = MEDIA_BIAS_VALUES.map((label) => {
    const count = ratings.filter((entry) => entry.rating === label).length;

    return {
      label,
      count,
      percentage: totalRatings ? Math.round((count / totalRatings) * 100) : 0,
    };
  });

  const topBucket = distribution
    .slice()
    .sort((a, b) => b.count - a.count || MEDIA_BIAS_VALUES.indexOf(a.label) - MEDIA_BIAS_VALUES.indexOf(b.label))[0];
  const label = topBucket && topBucket.count > 0 ? topBucket.label : null;

  return {
    mediaUserId,
    totalRatings,
    viewerRating,
    label,
    distribution,
  };
}

export async function getMediaProfileByUserId(mediaUserId: string, viewerUserId?: string): Promise<MediaProfileSummary | null> {
  const user = seedUsers.find((entry) => entry.id === mediaUserId && entry.role === "media" && entry.mediaTier);

  if (!user || !user.mediaTier) {
    return null;
  }

  return {
    userId: user.id,
    name: user.name,
    username: user.username,
    tier: user.mediaTier,
    jurisdictionName: user.jurisdictionName,
    bio: user.bio,
    websiteUrl: `https://news.example.com/${user.username}`,
    profileImageUrl: null,
    followerCount: user.followerCount,
    biasSummary: await getMediaBiasSummary(user.id, viewerUserId),
  };
}

export async function getAllMediaProfiles(viewerUserId?: string): Promise<MediaProfileSummary[]> {
  const profiles = await Promise.all(
    seedUsers
      .filter((entry) => entry.role === "media" && entry.mediaTier)
      .map((entry) => getMediaProfileByUserId(entry.id, viewerUserId)),
  );

  return profiles.filter((entry): entry is MediaProfileSummary => Boolean(entry));
}

export type MediaFeedPreview = {
  id: string;
  title: string;
  sourceName: string;
  jurisdictionName: string;
  createdAt: string;
  thumbnailUrl?: string;
  biasLabel: MediaBiasRatingValue | null;
  reactionTotals: {
    up: number;
    down: number;
  };
  viewerReaction: "up" | "down" | null;
};

const getMediaBiasLabelSnapshotsCached = cache(async () => {
  const ratings = await getAllMediaBiasRatings();
  const labelByMediaUserId = new Map<string, MediaBiasRatingValue | null>();

  for (const user of seedUsers.filter((entry) => entry.role === "media")) {
    const scopedRatings = ratings.filter((entry) => entry.mediaUserId === user.id);
    const counts = new Map<MediaBiasRatingValue, number>();

    for (const rating of scopedRatings) {
      counts.set(rating.rating, (counts.get(rating.rating) ?? 0) + 1);
    }

    const top = MEDIA_BIAS_VALUES.map((label) => ({
      label,
      count: counts.get(label) ?? 0,
    })).sort((a, b) => b.count - a.count || MEDIA_BIAS_VALUES.indexOf(a.label) - MEDIA_BIAS_VALUES.indexOf(b.label))[0];

    labelByMediaUserId.set(user.id, top && top.count > 0 ? top.label : null);
  }

  return labelByMediaUserId;
});

const getFeedMediaPreviewsCached = cache(
  async (viewerUserId: string | undefined, jurisdictionKey: string, limit: number): Promise<MediaFeedPreview[]> => {
    const jurisdictionNames = jurisdictionKey ? jurisdictionKey.split("|").filter(Boolean) : null;
    const allowedJurisdictions = jurisdictionNames ? new Set(jurisdictionNames) : null;
    const createdPosts = await getCreatedPosts();
    const allPosts = await applyPostReactionState([...createdPosts, ...mockPosts], viewerUserId);
    const biasLabels = await getMediaBiasLabelSnapshotsCached();

    const previews = allPosts
      .filter(
        (post: PostSummary) =>
          post.authorRole === "media" &&
          post.contentType === "newsStory" &&
          Boolean(post.title) &&
          (allowedJurisdictions ? allowedJurisdictions.has(post.jurisdictionName) : true),
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((post) => ({
        id: post.id,
        title: post.title ?? "News story",
        sourceName: post.authorName,
        jurisdictionName: post.jurisdictionName,
        createdAt: post.createdAt,
        thumbnailUrl: post.mediaThumbnailUrl ?? undefined,
        biasLabel: post.authorId ? (biasLabels.get(post.authorId) ?? null) : null,
        reactionTotals: post.reactionTotals,
        viewerReaction: post.viewerReaction ?? null,
      }));

    return limit > 0 ? previews.slice(0, limit) : previews;
  },
);

export async function getFeedMediaPreviews(options?: { jurisdictionNames?: string[]; limit?: number; viewerUserId?: string }) {
  const jurisdictionKey = options?.jurisdictionNames?.length ? [...options.jurisdictionNames].sort().join("|") : "";
  return getFeedMediaPreviewsCached(options?.viewerUserId, jurisdictionKey, options?.limit ?? -1);
}
