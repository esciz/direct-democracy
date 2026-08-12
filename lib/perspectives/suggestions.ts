import "server-only";

import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { get, list, put } from "@vercel/blob";

import type { ChallengeTopic } from "@/lib/perspectives/types";
import type { AuthUser } from "@/types/domain";

const LOCAL_SUGGESTION_DIR = path.join(process.cwd(), ".local", "perspective-suggestions");
const BLOB_PREFIX = "perspective-suggestions/";

export type PerspectiveSuggestionStatus = "pending" | "approved" | "rejected";

export type PerspectiveSuggestion = {
  id: string;
  category: string;
  statement: string;
  context: string;
  caseFor: string;
  caseAgainst: string;
  sharedGround: string[];
  evidenceToTest: string[];
  affectedPeople: string[];
  policyPaths: string[];
  sourceUrls: string[];
  submittedByUserId: string;
  submittedByName: string;
  submittedByRole: string;
  submittedByVerification: string;
  submittedAt: string;
  status: PerspectiveSuggestionStatus;
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

function cleanList(value: string, maxItems = 5) {
  return value
    .split(/\r?\n/)
    .map((entry) => cleanText(entry.replace(/^[-•]\s*/, ""), 180))
    .filter((entry) => entry.length >= 4)
    .slice(0, maxItems);
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

function isSuggestionStatus(value: string): value is PerspectiveSuggestionStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

function isSuggestion(value: unknown): value is PerspectiveSuggestion {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PerspectiveSuggestion>;
  return (
    typeof record.id === "string" &&
    typeof record.category === "string" &&
    typeof record.statement === "string" &&
    typeof record.context === "string" &&
    typeof record.caseFor === "string" &&
    typeof record.caseAgainst === "string" &&
    Array.isArray(record.sharedGround) &&
    Array.isArray(record.evidenceToTest) &&
    Array.isArray(record.affectedPeople) &&
    Array.isArray(record.policyPaths) &&
    Array.isArray(record.sourceUrls) &&
    typeof record.status === "string" &&
    isSuggestionStatus(record.status) &&
    typeof record.submittedAt === "string"
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

async function writeSuggestion(record: PerspectiveSuggestion) {
  const body = `${JSON.stringify(record, null, 2)}\n`;
  if (process.env.VERCEL_ENV) {
    if (!isBlobStorageConfigured()) throw new Error("Perspective suggestion storage is not configured.");
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
  if (!/^perspective-[a-f0-9-]{20,}$/.test(id)) return null;
  if (process.env.VERCEL_ENV) return readBlobSuggestion(suggestionPath(id));
  return readLocalSuggestion(path.join(LOCAL_SUGGESTION_DIR, `${id}.json`));
}

export function canSuggestPerspective(user: AuthUser | null) {
  if (!user) return false;
  if (user.role === "trustedCitizen" || user.role === "verified_resident") return true;
  return user.role === "citizen" && user.verificationState !== "unverified";
}

export async function listPerspectiveSuggestions(status?: PerspectiveSuggestionStatus) {
  let records: PerspectiveSuggestion[] = [];
  if (process.env.VERCEL_ENV) {
    if (!isBlobStorageConfigured()) return [];
    const result = await list({ prefix: BLOB_PREFIX, limit: 250 }).catch(() => null);
    if (!result) return [];
    records = (await Promise.all(result.blobs.map((blob) => readBlobSuggestion(blob.pathname)))).filter(
      (record): record is PerspectiveSuggestion => Boolean(record),
    );
  } else {
    const entries = await fs.readdir(LOCAL_SUGGESTION_DIR, { withFileTypes: true }).catch(() => []);
    records = (
      await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
          .map((entry) => readLocalSuggestion(path.join(LOCAL_SUGGESTION_DIR, entry.name))),
      )
    ).filter((record): record is PerspectiveSuggestion => Boolean(record));
  }

  return records
    .filter((record) => !status || record.status === status)
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export async function createPerspectiveSuggestion(input: {
  user: AuthUser;
  category: string;
  statement: string;
  context: string;
  caseFor: string;
  caseAgainst: string;
  sharedGround: string;
  evidenceToTest: string;
  affectedPeople: string;
  policyPaths: string;
  sourceUrls: string;
}) {
  if (!canSuggestPerspective(input.user)) return { ok: false as const, reason: "permission" as const };

  const category = cleanText(input.category, 60);
  const statement = cleanText(input.statement, 220);
  const context = cleanLongText(input.context, 900);
  const caseFor = cleanLongText(input.caseFor, 1200);
  const caseAgainst = cleanLongText(input.caseAgainst, 1200);
  const sharedGround = cleanList(input.sharedGround);
  const evidenceToTest = cleanList(input.evidenceToTest);
  const affectedPeople = cleanList(input.affectedPeople);
  const policyPaths = cleanList(input.policyPaths);
  const sourceUrls = cleanSourceUrls(input.sourceUrls);

  if (category.length < 3 || statement.length < 12 || context.length < 30) return { ok: false as const, reason: "basics" as const };
  if (caseFor.length < 40 || caseAgainst.length < 40) return { ok: false as const, reason: "arguments" as const };
  if (!sharedGround.length || !evidenceToTest.length || !affectedPeople.length || !policyPaths.length) return { ok: false as const, reason: "lenses" as const };
  if (!sourceUrls.length) return { ok: false as const, reason: "sources" as const };

  const record: PerspectiveSuggestion = {
    id: `perspective-${crypto.randomUUID()}`,
    category,
    statement,
    context,
    caseFor,
    caseAgainst,
    sharedGround,
    evidenceToTest,
    affectedPeople,
    policyPaths,
    sourceUrls,
    submittedByUserId: input.user.id,
    submittedByName: input.user.name,
    submittedByRole: input.user.role,
    submittedByVerification: input.user.verificationState,
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

export async function reviewPerspectiveSuggestion(input: {
  suggestionId: string;
  status: string;
  reviewer: AuthUser;
  reviewerNotes: string;
}) {
  if (input.status !== "approved" && input.status !== "rejected") return { ok: false as const, reason: "status" as const };
  const existing = await getSuggestionById(input.suggestionId);
  if (!existing) return { ok: false as const, reason: "not_found" as const };

  const record: PerspectiveSuggestion = {
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

export function perspectiveSuggestionToTopic(record: PerspectiveSuggestion): ChallengeTopic {
  return {
    id: record.id,
    category: record.category,
    statement: record.statement,
    context: record.context,
    caseFor: {
      label: "Strongest case for",
      headline: "The strongest community-submitted case supporting this statement",
      summary: record.caseFor,
      question: "What evidence would most strengthen or weaken this case?",
    },
    caseAgainst: {
      label: "Strongest challenge",
      headline: "The strongest community-submitted challenge to this statement",
      summary: record.caseAgainst,
      question: "What evidence would most strengthen or weaken this challenge?",
    },
    shared: record.sharedGround,
    evidence: record.evidenceToTest,
    people: record.affectedPeople,
    options: record.policyPaths,
    communityAdded: true,
  };
}
