import "server-only";

import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AuthUser } from "@/types/domain";

const PRIVATE_DIR = path.join(process.cwd(), "data", "private");
const FEEDBACK_PATH = path.join(PRIVATE_DIR, "private-beta-feedback.json");

export type PrivateBetaFeedbackCategory =
  | "bug"
  | "confusing"
  | "stale_data"
  | "missing_data"
  | "account_verification"
  | "performance"
  | "idea"
  | "other";

export type PrivateBetaFeedbackSeverity = "low" | "medium" | "high" | "blocking";
export type PrivateBetaFeedbackStatus = "new" | "triaged" | "in_progress" | "resolved" | "wont_fix";

export type PrivateBetaFeedbackRecord = {
  id: string;
  submittedAt: string;
  submittedByUserId: string;
  submittedByName: string;
  submittedByRole: string;
  category: PrivateBetaFeedbackCategory;
  severity: PrivateBetaFeedbackSeverity;
  pageUrl: string | null;
  summary: string;
  details: string;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  contactOk: boolean;
  contactEmail: string | null;
  status: PrivateBetaFeedbackStatus;
  reviewedAt: string | null;
  reviewerUserId: string | null;
  reviewerName: string | null;
  reviewerNotes: string | null;
  containsPersonalData: boolean;
  containsAccountIssue: boolean;
  needsFollowUp: boolean;
};

type PrivateBetaFeedbackStore = {
  schemaVersion: 1;
  generatedAt: string;
  records: PrivateBetaFeedbackRecord[];
};

export const PRIVATE_BETA_FEEDBACK_CATEGORIES: Array<{ value: PrivateBetaFeedbackCategory; label: string }> = [
  { value: "bug", label: "Something is broken" },
  { value: "confusing", label: "Something is confusing" },
  { value: "stale_data", label: "Information looks stale" },
  { value: "missing_data", label: "Information is missing" },
  { value: "account_verification", label: "Account or verification issue" },
  { value: "performance", label: "Page is slow or unstable" },
  { value: "idea", label: "Idea or improvement" },
  { value: "other", label: "Other feedback" },
];

export const PRIVATE_BETA_FEEDBACK_SEVERITIES: Array<{ value: PrivateBetaFeedbackSeverity; label: string }> = [
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "high", label: "High" },
  { value: "blocking", label: "Blocking" },
];

export const PRIVATE_BETA_FEEDBACK_STATUSES: Array<{ value: PrivateBetaFeedbackStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "triaged", label: "Triaged" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "wont_fix", label: "Won't fix" },
];

function emptyStore(): PrivateBetaFeedbackStore {
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), records: [] };
}

function readStore(): PrivateBetaFeedbackStore {
  if (!existsSync(FEEDBACK_PATH)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(FEEDBACK_PATH, "utf8")) as Partial<PrivateBetaFeedbackStore>;
    return {
      schemaVersion: 1,
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : new Date().toISOString(),
      records: Array.isArray(parsed.records) ? parsed.records.filter(isFeedbackRecord) : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(records: PrivateBetaFeedbackRecord[]) {
  mkdirSync(PRIVATE_DIR, { recursive: true });
  writeFileSync(
    FEEDBACK_PATH,
    `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), records }, null, 2)}\n`,
  );
}

function isFeedbackRecord(value: unknown): value is PrivateBetaFeedbackRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.submittedAt === "string" && typeof record.summary === "string";
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanLongText(value: string, maxLength: number) {
  return value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, maxLength);
}

function isCategory(value: string): value is PrivateBetaFeedbackCategory {
  return PRIVATE_BETA_FEEDBACK_CATEGORIES.some((category) => category.value === value);
}

function isSeverity(value: string): value is PrivateBetaFeedbackSeverity {
  return PRIVATE_BETA_FEEDBACK_SEVERITIES.some((severity) => severity.value === value);
}

function isStatus(value: string): value is PrivateBetaFeedbackStatus {
  return PRIVATE_BETA_FEEDBACK_STATUSES.some((status) => status.value === value);
}

function looksLikeUrl(value: string) {
  return value.startsWith("/") || value.startsWith("https://") || value.startsWith("http://");
}

function personalDataSignals(...values: string[]) {
  const text = values.join(" ");
  return /(?:\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|@|address|voter id|county voter id|password|mfa|token)/i.test(text);
}

export function getPrivateBetaFeedbackPath() {
  return FEEDBACK_PATH;
}

export function listPrivateBetaFeedback() {
  return readStore().records.sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export function getPrivateBetaFeedbackSummary() {
  const records = listPrivateBetaFeedback();
  const byStatus = Object.fromEntries(PRIVATE_BETA_FEEDBACK_STATUSES.map((status) => [status.value, 0])) as Record<PrivateBetaFeedbackStatus, number>;
  const byCategory = Object.fromEntries(PRIVATE_BETA_FEEDBACK_CATEGORIES.map((category) => [category.value, 0])) as Record<PrivateBetaFeedbackCategory, number>;
  const bySeverity = Object.fromEntries(PRIVATE_BETA_FEEDBACK_SEVERITIES.map((severity) => [severity.value, 0])) as Record<PrivateBetaFeedbackSeverity, number>;

  for (const record of records) {
    byStatus[record.status] += 1;
    byCategory[record.category] += 1;
    bySeverity[record.severity] += 1;
  }

  return {
    total: records.length,
    open: records.filter((record) => record.status === "new" || record.status === "triaged" || record.status === "in_progress").length,
    needsFollowUp: records.filter((record) => record.needsFollowUp).length,
    containsPersonalData: records.filter((record) => record.containsPersonalData).length,
    byStatus,
    byCategory,
    bySeverity,
  };
}

export function createPrivateBetaFeedback(input: {
  user: AuthUser;
  category: string;
  severity: string;
  pageUrl: string;
  summary: string;
  details: string;
  expectedBehavior: string;
  actualBehavior: string;
  contactOk: boolean;
  contactEmail: string;
}) {
  const category = isCategory(input.category) ? input.category : "other";
  const severity = isSeverity(input.severity) ? input.severity : "medium";
  const summary = cleanText(input.summary, 160);
  const details = cleanLongText(input.details, 4000);
  const expectedBehavior = cleanLongText(input.expectedBehavior, 1200);
  const actualBehavior = cleanLongText(input.actualBehavior, 1200);
  const pageUrl = cleanText(input.pageUrl, 500);
  const contactEmail = cleanText(input.contactEmail, 254);

  if (summary.length < 6 || details.length < 10) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const now = new Date().toISOString();
  const record: PrivateBetaFeedbackRecord = {
    id: `private-beta-feedback-${crypto.randomUUID()}`,
    submittedAt: now,
    submittedByUserId: input.user.id,
    submittedByName: input.user.name,
    submittedByRole: input.user.role,
    category,
    severity,
    pageUrl: pageUrl && looksLikeUrl(pageUrl) ? pageUrl : null,
    summary,
    details,
    expectedBehavior: expectedBehavior || null,
    actualBehavior: actualBehavior || null,
    contactOk: input.contactOk,
    contactEmail: input.contactOk && contactEmail.includes("@") ? contactEmail : null,
    status: "new",
    reviewedAt: null,
    reviewerUserId: null,
    reviewerName: null,
    reviewerNotes: null,
    containsPersonalData: personalDataSignals(summary, details, expectedBehavior, actualBehavior, contactEmail),
    containsAccountIssue: category === "account_verification" || /account|login|sign in|verification|voter|mfa/i.test(`${summary} ${details}`),
    needsFollowUp: severity === "blocking" || severity === "high" || category === "account_verification" || input.contactOk,
  };

  const records = listPrivateBetaFeedback();
  writeStore([record, ...records].slice(0, 500));
  return { ok: true as const, record };
}

export function updatePrivateBetaFeedbackReview(input: {
  feedbackId: string;
  status: string;
  reviewer: AuthUser;
  reviewerNotes: string;
}) {
  if (!isStatus(input.status)) return { ok: false as const, reason: "invalid_status" as const };
  const records = listPrivateBetaFeedback();
  const index = records.findIndex((record) => record.id === input.feedbackId);
  if (index < 0) return { ok: false as const, reason: "not_found" as const };

  records[index] = {
    ...records[index],
    status: input.status,
    reviewedAt: new Date().toISOString(),
    reviewerUserId: input.reviewer.id,
    reviewerName: input.reviewer.name,
    reviewerNotes: cleanLongText(input.reviewerNotes, 2000) || null,
  };

  writeStore(records);
  return { ok: true as const, record: records[index] };
}
