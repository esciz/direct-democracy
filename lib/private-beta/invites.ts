import "server-only";

import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AuthUser } from "@/types/domain";

const PRIVATE_DIR = path.join(process.cwd(), "data", "private");
const INVITES_PATH = path.join(PRIVATE_DIR, "private-beta-invites.json");

export type PrivateBetaInviteStatus = "draft" | "invited" | "accepted" | "feedback_received" | "paused" | "declined";

export type PrivateBetaInviteRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdByUserId: string;
  createdByName: string;
  testerName: string;
  testerEmail: string;
  relationship: string | null;
  priority: "low" | "normal" | "high";
  status: PrivateBetaInviteStatus;
  notes: string | null;
};

type PrivateBetaInviteStore = {
  schemaVersion: 1;
  generatedAt: string;
  records: PrivateBetaInviteRecord[];
};

export const PRIVATE_BETA_INVITE_STATUSES: Array<{ value: PrivateBetaInviteStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "invited", label: "Invited" },
  { value: "accepted", label: "Accepted" },
  { value: "feedback_received", label: "Feedback received" },
  { value: "paused", label: "Paused" },
  { value: "declined", label: "Declined" },
];

export const PRIVATE_BETA_INVITE_PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
] as const;

function emptyStore(): PrivateBetaInviteStore {
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), records: [] };
}

function isInviteRecord(value: unknown): value is PrivateBetaInviteRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.testerEmail === "string" && typeof record.status === "string";
}

function readStore(): PrivateBetaInviteStore {
  if (!existsSync(INVITES_PATH)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(INVITES_PATH, "utf8")) as Partial<PrivateBetaInviteStore>;
    return {
      schemaVersion: 1,
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : new Date().toISOString(),
      records: Array.isArray(parsed.records) ? parsed.records.filter(isInviteRecord) : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(records: PrivateBetaInviteRecord[]) {
  mkdirSync(PRIVATE_DIR, { recursive: true });
  writeFileSync(
    INVITES_PATH,
    `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), records }, null, 2)}\n`,
  );
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanLongText(value: string, maxLength: number) {
  return value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, maxLength);
}

function cleanEmail(value: string) {
  return cleanText(value, 254).toLowerCase();
}

function isStatus(value: string): value is PrivateBetaInviteStatus {
  return PRIVATE_BETA_INVITE_STATUSES.some((status) => status.value === value);
}

function isPriority(value: string): value is PrivateBetaInviteRecord["priority"] {
  return PRIVATE_BETA_INVITE_PRIORITIES.some((priority) => priority.value === value);
}

export function listPrivateBetaInvites() {
  return readStore().records.sort((left, right) => {
    const statusOrder = left.status.localeCompare(right.status);
    return statusOrder || right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function getPrivateBetaInviteSummary() {
  const records = listPrivateBetaInvites();
  const byStatus = Object.fromEntries(PRIVATE_BETA_INVITE_STATUSES.map((status) => [status.value, 0])) as Record<PrivateBetaInviteStatus, number>;
  for (const record of records) byStatus[record.status] += 1;

  return {
    total: records.length,
    active: records.filter((record) => record.status === "draft" || record.status === "invited" || record.status === "accepted").length,
    invited: byStatus.invited,
    accepted: byStatus.accepted,
    feedbackReceived: byStatus.feedback_received,
    highPriority: records.filter((record) => record.priority === "high").length,
    byStatus,
  };
}

export function createPrivateBetaInvite(input: {
  admin: AuthUser;
  testerName: string;
  testerEmail: string;
  relationship: string;
  priority: string;
  notes: string;
}) {
  const testerName = cleanText(input.testerName, 120);
  const testerEmail = cleanEmail(input.testerEmail);
  if (testerName.length < 2 || !testerEmail.includes("@")) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const records = listPrivateBetaInvites();
  if (records.some((record) => record.testerEmail === testerEmail)) {
    return { ok: false as const, reason: "duplicate" as const };
  }

  const now = new Date().toISOString();
  const record: PrivateBetaInviteRecord = {
    id: `private-beta-invite-${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
    invitedAt: null,
    acceptedAt: null,
    createdByUserId: input.admin.id,
    createdByName: input.admin.name,
    testerName,
    testerEmail,
    relationship: cleanText(input.relationship, 120) || null,
    priority: isPriority(input.priority) ? input.priority : "normal",
    status: "draft",
    notes: cleanLongText(input.notes, 1200) || null,
  };

  writeStore([record, ...records].slice(0, 500));
  return { ok: true as const, record };
}

export function updatePrivateBetaInvite(input: {
  admin: AuthUser;
  inviteId: string;
  status: string;
  notes: string;
}) {
  if (!isStatus(input.status)) return { ok: false as const, reason: "invalid_status" as const };
  const records = listPrivateBetaInvites();
  const index = records.findIndex((record) => record.id === input.inviteId);
  if (index < 0) return { ok: false as const, reason: "not_found" as const };

  const now = new Date().toISOString();
  const previous = records[index];
  records[index] = {
    ...previous,
    status: input.status,
    notes: cleanLongText(input.notes, 1200) || null,
    updatedAt: now,
    invitedAt: input.status === "invited" && !previous.invitedAt ? now : previous.invitedAt,
    acceptedAt: input.status === "accepted" && !previous.acceptedAt ? now : previous.acceptedAt,
  };

  writeStore(records);
  return { ok: true as const, record: records[index] };
}
