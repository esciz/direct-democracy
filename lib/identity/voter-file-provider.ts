import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type VoterFileIndexRecord = {
  providerId: string;
  county: string;
  countyVoterIdHash: string;
  firstNameHash: string;
  lastNameHash: string;
  precinct: string;
  zip: string;
  status: string;
};

export type VoterFileIndex = {
  generatedAt: string;
  hashVersion: "voter-file-hash-v1";
  providers: Array<{
    providerId: string;
    county: string;
    sourceUrl: string;
    sourceHash: string;
    dateOfRecord: string;
    recordsIndexed: number;
    activeRecords: number;
  }>;
  activeMatchKeys: string[];
  records?: VoterFileIndexRecord[];
};

export type VoterFileMatchInput = {
  countyOrJurisdiction: string;
  countyVoterId: string;
  electionPrecinct: string;
  registeredFirstName: string;
  registeredLastName: string;
};

const PRIVATE_INDEX_PATH = path.join(process.cwd(), "data", "private", "voter-files", "voter-file-provider-index.json");
let cachedIndex: VoterFileIndex | null = null;
let cachedIndexMtimeMs = 0;
let cachedActiveMatchKeys: Set<string> | null = null;

function hashSecret() {
  return process.env.DIRECT_DEMOCRACY_VOTER_FILE_HASH_SECRET || process.env.IDENTITY_EVIDENCE_ENCRYPTION_KEY || "local-development-voter-file-hash-secret";
}

export function normalizeVoterText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeCounty(value: string | null | undefined) {
  const normalized = normalizeVoterText(value).replace(/,\s*nevada$/, "");
  if (normalized === "clark" || normalized === "clark county") return "clark county";
  if (normalized === "washoe" || normalized === "washoe county") return "washoe county";
  if (normalized === "carson city") return "carson city";
  return normalized;
}

export function normalizePrecinct(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, "");
}

export function hashVoterField(value: string) {
  return createHash("sha256").update(`${hashSecret()}:${normalizeVoterText(value)}`).digest("hex");
}

export function hashVoterMatchKey(input: VoterFileMatchInput) {
  return createHash("sha256")
    .update(
      [
        hashSecret(),
        normalizeCounty(input.countyOrJurisdiction),
        normalizeVoterText(input.countyVoterId),
        normalizePrecinct(input.electionPrecinct),
        normalizeVoterText(input.registeredFirstName),
        normalizeVoterText(input.registeredLastName),
      ].join(":"),
    )
    .digest("hex");
}

export function getVoterFileIndexPath() {
  return PRIVATE_INDEX_PATH;
}

export function readVoterFileIndex(): VoterFileIndex | null {
  if (!existsSync(PRIVATE_INDEX_PATH)) return null;
  const mtimeMs = statSync(PRIVATE_INDEX_PATH).mtimeMs;
  if (cachedIndex && cachedIndexMtimeMs === mtimeMs) return cachedIndex;
  cachedIndex = JSON.parse(readFileSync(PRIVATE_INDEX_PATH, "utf8")) as VoterFileIndex;
  cachedIndexMtimeMs = mtimeMs;
  cachedActiveMatchKeys = null;
  return cachedIndex;
}

function readActiveMatchKeySet(index: VoterFileIndex) {
  if (!cachedActiveMatchKeys) {
    cachedActiveMatchKeys = new Set(index.activeMatchKeys ?? []);
  }
  return cachedActiveMatchKeys;
}

export function matchVoterFileRecord(input: VoterFileMatchInput) {
  const index = readVoterFileIndex();
  if (!index) {
    return {
      matched: false as const,
      status: "index_missing" as const,
      providerId: null,
      sourceHash: null,
      dateOfRecord: null,
    };
  }

  const county = normalizeCounty(input.countyOrJurisdiction);
  const precinct = normalizePrecinct(input.electionPrecinct);
  const matchKey = hashVoterMatchKey(input);
  const matchedByCompactIndex = readActiveMatchKeySet(index).has(matchKey);
  const legacyMatch = matchedByCompactIndex
    ? null
    : index.records?.find(
        (record) =>
          normalizeCounty(record.county) === county &&
          record.countyVoterIdHash === hashVoterField(input.countyVoterId) &&
          record.firstNameHash === hashVoterField(input.registeredFirstName) &&
          record.lastNameHash === hashVoterField(input.registeredLastName) &&
          normalizePrecinct(record.precinct) === precinct &&
          normalizeVoterText(record.status).startsWith("active"),
      ) ?? null;
  const matched = matchedByCompactIndex || Boolean(legacyMatch);
  const provider = index.providers.find((entry) => normalizeCounty(entry.county) === county) ?? index.providers[0] ?? null;

  if (!matched) {
    return {
      matched: false as const,
      status: "no_private_index_match" as const,
      providerId: null,
      sourceHash: null,
      dateOfRecord: null,
    };
  }

  return {
    matched: true as const,
    status: "matched" as const,
    providerId: legacyMatch?.providerId ?? provider?.providerId ?? "unknown_voter_file_provider",
    county: provider?.county ?? input.countyOrJurisdiction,
    precinct: legacyMatch?.precinct ?? input.electionPrecinct,
    zip: legacyMatch?.zip ?? null,
    voterStatus: legacyMatch?.status ?? "ACTIVE",
    sourceHash: provider?.sourceHash ?? null,
    dateOfRecord: provider?.dateOfRecord ?? null,
  };
}
