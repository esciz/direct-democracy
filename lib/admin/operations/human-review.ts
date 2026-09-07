import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const REVIEW_STATUSES = new Set(["pending", "needs_source", "needs_roster", "reviewed_no_change", "resolved", "deferred"]);
export const REVIEW_TYPES = new Set(["ambiguous_vote", "attendance_review", "distribution_review", "identity_quality"]);
export type ReviewDecision = {
  itemId: string; reviewType: string; status: string; notes?: string;
  reviewerUserId?: string; reviewerName?: string; updatedAt?: string;
};
export function reviewKey(reviewType: string, itemId: string) {
  return JSON.stringify([reviewType, itemId]);
}
export function reviewIsComplete(status?: string) {
  return status === "resolved" || status === "reviewed_no_change";
}

type ReviewDatabase = Pick<PrismaClient, "humanReviewDecision" | "$transaction">;
export function createHumanReviewService(database: ReviewDatabase = prisma) {
  async function read() {
    const rows = await database.humanReviewDecision.findMany();
    return Object.fromEntries(rows.map(row => [reviewKey(row.reviewType, row.itemId), {
      ...row, updatedAt: row.updatedAt.toISOString(),
    }])) as Record<string, ReviewDecision>;
  }
  async function save(input: { itemId: string; reviewType: string; status: string; notes: string; reviewerUserId: string; reviewerName: string }) {
    if (!input.itemId.trim() || input.itemId.length > 1000 || !REVIEW_TYPES.has(input.reviewType) || !REVIEW_STATUSES.has(input.status)) {
      throw new Error("invalid_review_decision");
    }
    const data = { ...input, itemId: input.itemId.trim(), notes: input.notes.trim().slice(0, 2000) };
    await database.$transaction(async tx => {
      await tx.humanReviewDecision.upsert({
        where: { reviewType_itemId: { reviewType: data.reviewType, itemId: data.itemId } },
        create: data, update: data,
      });
      await tx.identitySecurityEvent.create({ data: {
        id: `review_${randomUUID()}`, actorAccountId: data.reviewerUserId,
        eventType: "human_review_workflow_updated", summary: "Admin review decision saved.",
        metadata: { ...data },
      } });
    });
  }
  return { read, save };
}
export const humanReviewService = createHumanReviewService();
