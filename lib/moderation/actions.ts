"use server";

import { getCurrentUser } from "@/lib/server/auth-session";
import { addContentReport, hasUserReportedTarget } from "@/lib/server/content-reports";
import type { ModerationReportReason, ModerationReportTargetType, ModerationReportSummary } from "@/types/domain";

const VALID_REASONS: ModerationReportReason[] = [
  "harassment",
  "hate",
  "threat",
  "sexual",
  "spam",
  "misinformation",
  "other",
];

function isValidTargetType(value: string): value is ModerationReportTargetType {
  return value === "post" || value === "comment";
}

function isValidReason(value: string): value is ModerationReportReason {
  return VALID_REASONS.includes(value as ModerationReportReason);
}

export async function submitContentReportAction(input: {
  targetType: string;
  targetId: string;
  reason: string;
  note?: string;
}) {
  const currentUser = await getCurrentUser();
  const targetType = input.targetType.trim();
  const targetId = input.targetId.trim();
  const reason = input.reason.trim();
  const note = input.note?.trim() ?? "";

  if (!isValidTargetType(targetType) || !targetId || !isValidReason(reason)) {
    return {
      ok: false,
      alreadyReported: false,
      message: "That report could not be submitted.",
    };
  }

  const alreadyReported = await hasUserReportedTarget(currentUser.id, targetType, targetId);

  if (alreadyReported) {
    return {
      ok: true,
      alreadyReported: true,
      reported: true,
      message: "You already reported this content.",
    };
  }

  const report: ModerationReportSummary = {
    id: `content_report_${Date.now()}`,
    targetType,
    targetId,
    userId: currentUser.id,
    reason,
    note: note ? note.slice(0, 500) : null,
    createdAt: new Date().toISOString(),
    status: "open",
  };

  await addContentReport(report);

  return {
    ok: true,
    alreadyReported: false,
    reported: true,
    message: "Thanks for your report.",
  };
}
