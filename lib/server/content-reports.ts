import "server-only";

import { cookies } from "next/headers";

import type { ModerationReportSummary, ModerationReportTargetType } from "@/types/domain";

const CONTENT_REPORTS_COOKIE = "dd_content_reports";

function isModerationReportSummary(value: unknown): value is ModerationReportSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Record<string, unknown>;
  return (
    typeof report.id === "string" &&
    (report.targetType === "post" || report.targetType === "comment") &&
    typeof report.targetId === "string" &&
    typeof report.userId === "string" &&
    (report.reason === "harassment" ||
      report.reason === "hate" ||
      report.reason === "threat" ||
      report.reason === "sexual" ||
      report.reason === "spam" ||
      report.reason === "misinformation" ||
      report.reason === "other") &&
    (typeof report.note === "string" || typeof report.note === "undefined" || report.note === null) &&
    typeof report.createdAt === "string" &&
    report.status === "open"
  );
}

export async function getStoredContentReports(): Promise<ModerationReportSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CONTENT_REPORTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isModerationReportSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredContentReports(reports: ModerationReportSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(CONTENT_REPORTS_COOKIE, JSON.stringify(reports.slice(0, 500)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function hasUserReportedTarget(userId: string, targetType: ModerationReportTargetType, targetId: string) {
  const reports = await getStoredContentReports();
  return reports.some((report) => report.userId === userId && report.targetType === targetType && report.targetId === targetId);
}

export async function getReportedTargetIdsForUser(userId: string, targetType: ModerationReportTargetType) {
  const reports = await getStoredContentReports();
  return new Set(
    reports
      .filter((report) => report.userId === userId && report.targetType === targetType)
      .map((report) => report.targetId),
  );
}

export async function addContentReport(report: ModerationReportSummary) {
  const reports = await getStoredContentReports();
  await setStoredContentReports([report, ...reports]);
}
