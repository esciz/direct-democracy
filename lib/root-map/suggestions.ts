import "server-only";

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { get, list, put } from "@vercel/blob";

import type { AuthUser } from "@/types/domain";

const LOCAL_SUGGESTION_DIR = path.join(process.cwd(), ".local", "root-map-suggestions");
const BLOB_PREFIX = "root-map-suggestions/";

export type RootMapSuggestionType = "new_issue" | "new_connection" | "correction";
export type RootMapSuggestionStatus = "pending" | "approved" | "rejected";

export type RootMapSuggestion = {
  id: string;
  type: RootMapSuggestionType;
  title: string;
  explanation: string;
  fromNodeId: string | null;
  toNodeId: string | null;
  proposedRelationship: string | null;
  sourceUrls: string[];
  submittedByUserId: string;
  submittedByName: string;
  submittedAt: string;
  status: RootMapSuggestionStatus;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewerNotes: string | null;
};

function isBlobStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID));
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanLongText(value: string, maxLength: number) {
  return value.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, maxLength);
}

function cleanNodeId(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,80}$/.test(normalized) ? normalized : null;
}

function cleanSourceUrls(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => {
      try {
        const url = new URL(entry);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    })
    .slice(0, 8);
}

function isSuggestionType(value: string): value is RootMapSuggestionType {
  return value === "new_issue" || value === "new_connection" || value === "correction";
}

function isSuggestionStatus(value: string): value is RootMapSuggestionStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function isSuggestion(value: unknown): value is RootMapSuggestion {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RootMapSuggestion>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.explanation === "string" &&
    typeof record.type === "string" &&
    isSuggestionType(record.type) &&
    typeof record.status === "string" &&
    isSuggestionStatus(record.status) &&
    typeof record.submittedAt === "string" &&
    Array.isArray(record.sourceUrls)
  );
}

function suggestionPath(id: string) {
  return `${BLOB_PREFIX}${id}.json`;
}

async function readBlobSuggestion(pathname: string) {
  const result = await get(pathname, { access: "private" }).catch(() => null);
  if (!result || result.statusCode !== 200) return null;
  try {
    const parsed = JSON.parse(await new Response(result.stream).text()) as unknown;
    return isSuggestion(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readLocalSuggestion(filePath: string) {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    return isSuggestion(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writeSuggestion(record: RootMapSuggestion) {
  const body = `${JSON.stringify(record, null, 2)}\n`;

  if (process.env.VERCEL_ENV) {
    if (!isBlobStorageConfigured()) throw new Error("Root-map suggestion storage is not configured.");
    await put(suggestionPath(record.id), body, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }

  await fs.mkdir(LOCAL_SUGGESTION_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_SUGGESTION_DIR, `${record.id}.json`), body, "utf8");
}

async function getSuggestionById(id: string) {
  if (!/^root-map-[a-f0-9-]{20,}$/.test(id)) return null;
  if (process.env.VERCEL_ENV) return readBlobSuggestion(suggestionPath(id));
  return readLocalSuggestion(path.join(LOCAL_SUGGESTION_DIR, `${id}.json`));
}

export async function listRootMapSuggestions(status?: RootMapSuggestionStatus) {
  let records: RootMapSuggestion[] = [];

  if (process.env.VERCEL_ENV) {
    if (!isBlobStorageConfigured()) return [];
    const result = await list({ prefix: BLOB_PREFIX, limit: 250 }).catch(() => null);
    if (!result) return [];
    records = (await Promise.all(result.blobs.map((blob) => readBlobSuggestion(blob.pathname)))).filter(
      (record): record is RootMapSuggestion => Boolean(record),
    );
  } else {
    const entries = await fs.readdir(LOCAL_SUGGESTION_DIR, { withFileTypes: true }).catch(() => []);
    records = (
      await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
          .map((entry) => readLocalSuggestion(path.join(LOCAL_SUGGESTION_DIR, entry.name))),
      )
    ).filter((record): record is RootMapSuggestion => Boolean(record));
  }

  return records
    .filter((record) => !status || record.status === status)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export async function createRootMapSuggestion(input: {
  user: AuthUser;
  type: string;
  title: string;
  explanation: string;
  fromNodeId: string;
  toNodeId: string;
  proposedRelationship: string;
  sourceUrls: string;
}) {
  if (!isSuggestionType(input.type)) return { ok: false as const, reason: "type" as const };
  const title = cleanText(input.title, 120);
  const explanation = cleanLongText(input.explanation, 1800);
  const fromNodeId = cleanNodeId(input.fromNodeId);
  const toNodeId = cleanNodeId(input.toNodeId);
  const proposedRelationship = cleanText(input.proposedRelationship, 80);

  if (title.length < 4) return { ok: false as const, reason: "title" as const };
  if (explanation.length < 20) return { ok: false as const, reason: "explanation" as const };
  if (input.type === "new_connection" && (!fromNodeId || !toNodeId || fromNodeId === toNodeId)) {
    return { ok: false as const, reason: "connection" as const };
  }
  if (input.type === "new_issue" && !fromNodeId) return { ok: false as const, reason: "connection" as const };

  const record: RootMapSuggestion = {
    id: `root-map-${crypto.randomUUID()}`,
    type: input.type,
    title,
    explanation,
    fromNodeId,
    toNodeId,
    proposedRelationship: proposedRelationship || null,
    sourceUrls: cleanSourceUrls(input.sourceUrls),
    submittedByUserId: input.user.id,
    submittedByName: input.user.name,
    submittedAt: new Date().toISOString(),
    status: "pending",
    reviewedAt: null,
    reviewedByUserId: null,
    reviewedByName: null,
    reviewerNotes: null,
  };

  await writeSuggestion(record);
  return { ok: true as const, record };
}

export async function reviewRootMapSuggestion(input: {
  suggestionId: string;
  status: string;
  reviewer: AuthUser;
  reviewerNotes: string;
}) {
  if (input.status !== "approved" && input.status !== "rejected") {
    return { ok: false as const, reason: "status" as const };
  }
  const existing = await getSuggestionById(input.suggestionId);
  if (!existing) return { ok: false as const, reason: "not_found" as const };

  const record: RootMapSuggestion = {
    ...existing,
    status: input.status,
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: input.reviewer.id,
    reviewedByName: input.reviewer.name,
    reviewerNotes: cleanLongText(input.reviewerNotes, 1200) || null,
  };
  await writeSuggestion(record);
  return { ok: true as const, record };
}
