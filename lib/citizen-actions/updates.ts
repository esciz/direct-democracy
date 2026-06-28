import "server-only";

import { getCitizenActionDashboard, type CitizenActionItem } from "@/lib/citizen-actions/dashboard";
import type { AuthUser } from "@/types/domain";

export type CitizenUpdateRecord = {
  id: string;
  userId: string;
  targetType: CitizenActionItem["targetType"];
  targetId: string;
  title: string;
  summary: string;
  whyItMatters: string;
  href: string;
  sourceBacked: boolean;
  needsReview: boolean;
  updateType: "source_change" | "review_needed" | "status_watch" | "next_step";
  sourceLabel: string;
  generatedAt: string;
};

export type CitizenUpdateDigest = {
  generatedAt: string;
  userId: string;
  records: CitizenUpdateRecord[];
  totals: {
    followedItems: number;
    updatesGenerated: number;
    sourceBackedUpdates: number;
    limitedSourceUpdates: number;
    reviewNeededUpdates: number;
    staleFollowedItems: number;
  };
};

function updateTypeForItem(item: CitizenActionItem): CitizenUpdateRecord["updateType"] {
  if (!item.sourceBacked) return "review_needed";
  if (item.targetType === "project") return "status_watch";
  if (item.targetType === "decision" || item.targetType === "event") return "source_change";
  return "next_step";
}

function titleForItem(item: CitizenActionItem) {
  switch (item.targetType) {
    case "decision":
      return "A followed decision is ready to review";
    case "project":
      return "A followed project has a status card";
    case "community":
      return "Your followed community has a briefing";
    case "event":
      return "A followed meeting or event has source activity";
    case "issue":
      return "A followed issue has related civic activity";
    case "case":
      return "A followed case has reviewed public context";
    case "election":
      return "A followed election has deadline context";
    default:
      return `${item.label} update`;
  }
}

function whyForItem(item: CitizenActionItem) {
  if (!item.sourceBacked) {
    return "This item is in your watchlist, but the current update is limited because a reviewed public source is not attached yet.";
  }
  return item.updateTrigger;
}

export async function getCitizenUpdateDigest(user: AuthUser): Promise<CitizenUpdateDigest> {
  const dashboard = await getCitizenActionDashboard(user);
  const generatedAt = new Date().toISOString();
  const records = dashboard.items.map((item): CitizenUpdateRecord => {
    const updateType = updateTypeForItem(item);
    return {
      id: `watchlist_update_${user.id}_${item.targetType}_${item.targetId}`,
      userId: user.id,
      targetType: item.targetType,
      targetId: item.targetId,
      title: titleForItem(item),
      summary: item.summary,
      whyItMatters: whyForItem(item),
      href: item.href,
      sourceBacked: item.sourceBacked,
      needsReview: updateType === "review_needed",
      updateType,
      sourceLabel: item.sourceBacked ? "Source-backed watchlist item" : "Limited source watchlist item",
      generatedAt,
    };
  });

  return {
    generatedAt,
    userId: user.id,
    records,
    totals: {
      followedItems: dashboard.totals.followedItems,
      updatesGenerated: records.length,
      sourceBackedUpdates: records.filter((record) => record.sourceBacked).length,
      limitedSourceUpdates: records.filter((record) => !record.sourceBacked).length,
      reviewNeededUpdates: records.filter((record) => record.needsReview).length,
      staleFollowedItems: dashboard.totals.followedItems - records.length,
    },
  };
}
