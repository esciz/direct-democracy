import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import { inferIdeologicalLeaningLabel } from "@/lib/profile/signals";
import { getTrustedCitizenReputationWeight } from "@/lib/profile/reputation";
import type { IdeologicalLeaningLabel, TruthMeterSummary, TruthRatingSummary, TruthRatingValue } from "@/types/domain";

const TRUTH_RATINGS_COOKIE = "dd_truth_ratings";

export const TRUTH_RATING_VALUES: TruthRatingValue[] = [
  "Accurate",
  "Mostly True",
  "Mixed / Unclear",
  "Misleading",
  "False",
];

export type TruthBadgeLabel = "Mostly Accurate" | "Mixed" | "Misleading";
export type TruthIdeologyGroupLabel = IdeologicalLeaningLabel | "Unknown";
export type TruthIdeologyBreakdownEntry = {
  ideology: TruthIdeologyGroupLabel;
  totalRatings: number;
  badge: TruthBadgeLabel | null;
  distribution: Array<{
    label: TruthRatingValue;
    count: number;
    percentage: number;
  }>;
};

const seededTruthRatings: TruthRatingSummary[] = [
  { id: "truth_post_1_marco", userId: "user_trusted_citizen_marco_silva", entityId: "post_1", rating: "Mostly True", createdAt: "2026-03-29T18:00:00.000Z" },
  { id: "truth_post_1_hannah", userId: "user_trusted_citizen_hannah_cho", entityId: "post_1", rating: "Accurate", createdAt: "2026-03-29T18:20:00.000Z" },
  { id: "truth_post_4_hannah", userId: "user_trusted_citizen_hannah_cho", entityId: "post_4", rating: "Mostly True", createdAt: "2026-03-28T20:10:00.000Z" },
  { id: "truth_post_6_nora", userId: "user_trusted_citizen_nora_patel", entityId: "post_6", rating: "Accurate", createdAt: "2026-03-28T15:45:00.000Z" },
  { id: "truth_post_8_marco", userId: "user_trusted_citizen_marco_silva", entityId: "post_8", rating: "Mixed / Unclear", createdAt: "2026-03-27T19:15:00.000Z" },
  { id: "truth_post_8_david", userId: "user_official_david_park", entityId: "post_8", rating: "Mostly True", createdAt: "2026-03-27T19:35:00.000Z" },
  { id: "truth_post_13_nora", userId: "user_trusted_citizen_nora_patel", entityId: "post_13", rating: "Mostly True", createdAt: "2026-03-26T16:10:00.000Z" },
  { id: "truth_post_16_marco", userId: "user_trusted_citizen_marco_silva", entityId: "post_16", rating: "Mostly True", createdAt: "2026-03-30T15:20:00.000Z" },
  { id: "truth_post_16_nora", userId: "user_trusted_citizen_nora_patel", entityId: "post_16", rating: "Mostly True", createdAt: "2026-03-30T15:22:00.000Z" },
  { id: "truth_post_16_hannah", userId: "user_trusted_citizen_hannah_cho", entityId: "post_16", rating: "Mixed / Unclear", createdAt: "2026-03-30T15:25:00.000Z" },
  { id: "truth_post_18_nora", userId: "user_trusted_citizen_nora_patel", entityId: "post_18", rating: "Mixed / Unclear", createdAt: "2026-03-30T12:30:00.000Z" },
  { id: "truth_post_18_hannah", userId: "user_trusted_citizen_hannah_cho", entityId: "post_18", rating: "Misleading", createdAt: "2026-03-30T12:32:00.000Z" },
  { id: "truth_post_3b_nora", userId: "user_trusted_citizen_nora_patel", entityId: "post_3b", rating: "Mostly True", createdAt: "2026-03-29T11:10:00.000Z" },
  { id: "truth_post_3b_marco", userId: "user_trusted_citizen_marco_silva", entityId: "post_3b", rating: "Mixed / Unclear", createdAt: "2026-03-29T11:30:00.000Z" },
  { id: "truth_post_10b_hannah", userId: "user_trusted_citizen_hannah_cho", entityId: "post_10b", rating: "Mostly True", createdAt: "2026-03-27T14:00:00.000Z" },
  { id: "truth_post_20_nora", userId: "user_trusted_citizen_nora_patel", entityId: "post_20", rating: "Mostly True", createdAt: "2026-03-30T09:15:00.000Z" },
  { id: "truth_statement_meeting_marco", userId: "user_trusted_citizen_marco_silva", entityId: "case_statement_alicia_meeting", rating: "Accurate", createdAt: "2026-03-23T10:30:00.000Z" },
  { id: "truth_statement_meeting_hannah", userId: "user_trusted_citizen_hannah_cho", entityId: "case_statement_alicia_meeting", rating: "Mostly True", createdAt: "2026-03-23T11:10:00.000Z" },
  { id: "truth_debate_turn_carson_a_hannah", userId: "user_trusted_citizen_hannah_cho", entityId: "debate_turn_carson_open_a", rating: "Mostly True", createdAt: "2026-04-02T08:20:00.000Z" },
  { id: "truth_debate_turn_carson_a_nora", userId: "user_trusted_citizen_nora_patel", entityId: "debate_turn_carson_open_a", rating: "Mixed / Unclear", createdAt: "2026-04-02T09:00:00.000Z" },
  { id: "truth_debate_turn_housing_b_marco", userId: "user_trusted_citizen_marco_silva", entityId: "debate_turn_housing_response_b", rating: "Mostly True", createdAt: "2026-03-28T15:00:00.000Z" },
];

function isTruthRatingValue(value: unknown): value is TruthRatingValue {
  return TRUTH_RATING_VALUES.includes(value as TruthRatingValue);
}

function isTruthRatingSummary(value: unknown): value is TruthRatingSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const rating = value as Record<string, unknown>;

  return (
    typeof rating.id === "string" &&
    typeof rating.userId === "string" &&
    typeof rating.entityId === "string" &&
    isTruthRatingValue(rating.rating) &&
    typeof rating.createdAt === "string"
  );
}

export async function getStoredTruthRatings(): Promise<TruthRatingSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TRUTH_RATINGS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTruthRatingSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredTruthRatings(ratings: TruthRatingSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(TRUTH_RATINGS_COOKIE, JSON.stringify(ratings.slice(0, 500)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getAllTruthRatings() {
  const merged = new Map<string, TruthRatingSummary>();

  for (const rating of seededTruthRatings) {
    merged.set(`${rating.userId}:${rating.entityId}`, rating);
  }

  for (const rating of await getStoredTruthRatings()) {
    merged.set(`${rating.userId}:${rating.entityId}`, rating);
  }

  return [...merged.values()];
}

async function buildTruthMeter(entityId: string, viewerUserId?: string, weighted = true): Promise<TruthMeterSummary> {
  const ratings = (await getAllTruthRatings()).filter((entry) => entry.entityId === entityId);
  const totalRatings = ratings.length;
  const viewerRating = viewerUserId ? ratings.find((entry) => entry.userId === viewerUserId)?.rating ?? null : null;
  const ratingWeights = weighted
    ? await Promise.all(
        ratings.map(async (rating) => {
          const ratingUser = seedUsers.find((entry) => entry.id === rating.userId);
          const weight = ratingUser?.role === "trustedCitizen" ? await getTrustedCitizenReputationWeight(rating.userId) : 1;
          return [rating.id, weight] as const;
        }),
      )
    : [];
  const weightByRatingId = new Map(ratingWeights);
  const weightedTotal = weighted ? ratings.reduce((total, rating) => total + (weightByRatingId.get(rating.id) ?? 1), 0) : totalRatings;

  return {
    entityId,
    totalRatings,
    viewerRating,
    distribution: TRUTH_RATING_VALUES.map((label) => {
      const count = ratings.filter((entry) => entry.rating === label).length;

      return {
        label,
        count,
        percentage: totalRatings ? Math.round((count / totalRatings) * 100) : 0,
      };
    }),
    weightedDistribution: weighted
      ? TRUTH_RATING_VALUES.map((label) => {
          const count = ratings
            .filter((entry) => entry.rating === label)
            .reduce((total, rating) => total + (weightByRatingId.get(rating.id) ?? 1), 0);

          return {
            label,
            count,
            percentage: weightedTotal ? Math.round((count / weightedTotal) * 100) : 0,
          };
        })
      : undefined,
  };
}

export async function getTruthMeter(entityId: string, viewerUserId?: string): Promise<TruthMeterSummary> {
  return buildTruthMeter(entityId, viewerUserId, true);
}

export async function getRawTruthMeter(entityId: string, viewerUserId?: string): Promise<TruthMeterSummary> {
  return buildTruthMeter(entityId, viewerUserId, false);
}

export function getTruthBadgeFromMeter(meter: TruthMeterSummary): TruthBadgeLabel | null {
  if (meter.totalRatings === 0) {
    return null;
  }

  const sourceDistribution = meter.weightedDistribution ?? meter.distribution;
  const weightedTotal = sourceDistribution.reduce((total, entry) => total + entry.count, 0);
  const countFor = (label: TruthRatingValue) => sourceDistribution.find((entry) => entry.label === label)?.count ?? 0;
  const positive = countFor("Accurate") + countFor("Mostly True");
  const mixed = countFor("Mixed / Unclear");
  const negative = countFor("Misleading") + countFor("False");
  const positivePct = weightedTotal ? (positive / weightedTotal) * 100 : 0;
  const negativePct = weightedTotal ? (negative / weightedTotal) * 100 : 0;
  const mixedPct = weightedTotal ? (mixed / weightedTotal) * 100 : 0;

  if (negativePct >= 45 && negative >= positive) {
    return "Misleading";
  }

  if (positivePct >= 55 && positive > negative) {
    return "Mostly Accurate";
  }

  if (mixedPct >= 30 || Math.abs(positivePct - negativePct) < 20) {
    return "Mixed";
  }

  return positive > negative ? "Mostly Accurate" : "Misleading";
}

export function getTruthRankingSignal(meter: TruthMeterSummary) {
  const badge = getTruthBadgeFromMeter(meter);

  if (badge === "Mostly Accurate") {
    return 1;
  }

  if (badge === "Misleading") {
    return -1;
  }

  return 0;
}

export async function getTruthIdeologyBreakdown(entityId: string): Promise<TruthIdeologyBreakdownEntry[]> {
  const ratings = (await getAllTruthRatings()).filter((entry) => entry.entityId === entityId);
  const grouped = new Map<TruthIdeologyGroupLabel, TruthRatingSummary[]>();

  for (const rating of ratings) {
    const ratingUser = seedUsers.find((entry) => entry.id === rating.userId);
    const ideology =
      inferIdeologicalLeaningLabel({
        sourceTexts: [ratingUser?.bio ?? "", ratingUser?.jurisdictionName ?? "", ratingUser?.name ?? ""],
      }) ?? "Unknown";
    const bucket = grouped.get(ideology) ?? [];
    bucket.push(rating);
    grouped.set(ideology, bucket);
  }

  const orderedIdeologies: TruthIdeologyGroupLabel[] = ["Left", "Lean Left", "Center", "Lean Right", "Right", "Unknown"];

  return orderedIdeologies
    .map((ideology) => {
      const entries = grouped.get(ideology) ?? [];

      if (!entries.length) {
        return null;
      }

      const distribution = TRUTH_RATING_VALUES.map((label) => {
        const count = entries.filter((entry) => entry.rating === label).length;
        return {
          label,
          count,
          percentage: entries.length ? Math.round((count / entries.length) * 100) : 0,
        };
      });

      return {
        ideology,
        totalRatings: entries.length,
        badge: getTruthBadgeFromMeter({
          entityId: `${entityId}-${ideology}`,
          totalRatings: entries.length,
          viewerRating: null,
          distribution,
        }),
        distribution,
      } satisfies TruthIdeologyBreakdownEntry;
    })
    .filter((entry): entry is TruthIdeologyBreakdownEntry => Boolean(entry));
}
