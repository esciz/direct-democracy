import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { normalizeWhitespace, slugify, summarizeText } from "@/lib/public-meetings/shared";
import type { PublicBodyRecord, PublicMeetingItemRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "governing-body-rosters.json");
const AUDIT_PATH = path.join(GENERATED_DIR, "governing-body-roster-audit.json");

type RosterRecord = {
  id: string;
  bodyId: string;
  organizationId: string;
  officialId: string | null;
  fullName: string;
  normalizedName: string;
  title: string | null;
  district: string | null;
  startDate: string | null;
  endDate: string | null;
  votingMember: boolean;
  sourceReferences: Array<{ label: string; url: string | null; path: string | null; snippet: string | null }>;
  confidence: number;
  needsReview: boolean;
};

type RosterSeed = {
  providerId: string;
  sourceName: string;
  sourceUrl?: string | null;
  bodyName: string;
  members?: Array<{
    fullName: string;
    surname?: string | null;
    seatTitle?: string | null;
    status?: string | null;
    sourceUrl?: string | null;
    aliases?: string[];
  }>;
};

type OfficialRecord = { id?: string; name?: string; body_name?: string; aliases?: string[] };

const PRIORITY_BODIES = [
  { label: "Carson City Board of Supervisors", seedSourceId: "carson-city-board-of-supervisors" },
  { label: "Reno City Council", seedSourceId: "reno-city-council" },
  { label: "Washoe County Commission", seedSourceId: "washoe-county-commission" },
  { label: "Washoe County School District Board", seedSourceId: "washoe-county-school-district" },
  { label: "NSHE Board of Regents", seedSourceId: "nshe-board-of-regents" },
  { label: "Nevada Senate", seedSourceId: "nv-senate" },
  { label: "Nevada Assembly", seedSourceId: "nv-assembly" },
];

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function normalizeName(value: string) {
  return normalizeWhitespace(value.toLowerCase().replace(/\b(?:mr|mrs|ms|dr)\.?\s+/g, "").replace(/[^a-z0-9]+/g, " "));
}

function cleanName(value: string) {
  return normalizeWhitespace(value.replace(/\b(?:Mr|Mrs|Ms|Dr)\.\s+/g, "").replace(/\b(?:Chair|Vice Chair|President|Vice President|Clerk)\b.*$/i, ""));
}

function officialIdFor(name: string, body: PublicBodyRecord, officials: OfficialRecord[]) {
  const normalized = normalizeName(name);
  return (
    officials.find((official) => {
      if (official.body_name && normalizeWhitespace(official.body_name).toLowerCase() !== normalizeWhitespace(body.name).toLowerCase()) return false;
      return normalizeName(official.name ?? "") === normalized || (official.aliases ?? []).some((alias) => normalizeName(alias) === normalized);
    })?.id ?? null
  );
}

function priorityBodyFor(seedSourceId: string, bodies: PublicBodyRecord[]) {
  return bodies.find((body) => body.seed_source_id === seedSourceId && body.id === `body-${seedSourceId}`) ?? bodies.find((body) => body.seed_source_id === seedSourceId) ?? null;
}

function sourceBackedNsheMembers(items: PublicMeetingItemRecord[]) {
  const item = items.find((entry) => entry.meeting_id.includes("nshe-board-of-regents") && /\bMembers Present:/i.test(entry.source_text));
  if (!item) return [];
  const match = normalizeWhitespace(item.source_text).match(/\bMembers Present:\s*([\s\S]{20,1200}?)(?=\b(?:Others Present|Also Present|Staff Present|Faculty senate|Student body|Chair Byron Brooks called|$))/i);
  if (!match) return [];
  const names = Array.from(match[1].matchAll(/\b(?:Mr|Mrs|Ms|Dr)\.\s+([A-Z][A-Za-z'.-]+(?:\s+(?!Mr\.|Mrs\.|Ms\.|Dr\.|Chair\b|Vice\b)[A-Z](?:\.|[A-Za-z'.-]+)){0,3})/g)).map((nameMatch) =>
    cleanName(nameMatch[1]),
  );
  return [...new Set(names)].map((fullName) => ({
    fullName,
    sourceSnippet: summarizeText(match[0], 520),
    sourcePath: item.source_local_path ?? item.cached_text_path ?? null,
    sourceUrl: item.source_url,
  }));
}

function generateRosters() {
  const generatedAt = new Date().toISOString();
  const bodies = readJson<PublicBodyRecord[]>("data/generated/public-meeting-bodies.json", []);
  const items = readJson<PublicMeetingItemRecord[]>("data/generated/public-meeting-items.json", []);
  const rosterSeeds = readJson<RosterSeed[]>("data/seed/public-meeting-official-rosters.json", []);
  const officialsArtifact = readJson<{ records?: OfficialRecord[] } | OfficialRecord[]>("data/generated/nevada-community-officials.json", {});
  const officials = Array.isArray(officialsArtifact) ? officialsArtifact : officialsArtifact.records ?? [];
  const seedByProvider = new Map(rosterSeeds.map((seed) => [seed.providerId, seed]));
  const records: RosterRecord[] = [];

  for (const priority of PRIORITY_BODIES) {
    const body = priorityBodyFor(priority.seedSourceId, bodies);
    if (!body) continue;
    const seed = seedByProvider.get(priority.seedSourceId);
    if (seed?.members?.length) {
      for (const member of seed.members) {
        const active = (member.status ?? "CURRENT").toUpperCase() === "CURRENT";
        records.push({
          id: `governing-roster-${slugify(body.id)}-${slugify(member.fullName)}`,
          bodyId: body.id,
          organizationId: body.seed_source_id,
          officialId: officialIdFor(member.fullName, body, officials),
          fullName: member.fullName,
          normalizedName: normalizeName(member.fullName),
          title: member.seatTitle ?? seed.bodyName,
          district: member.seatTitle ?? null,
          startDate: null,
          endDate: active ? null : generatedAt,
          votingMember: active,
          sourceReferences: [
            {
              label: seed.sourceName,
              url: member.sourceUrl?.startsWith("http") ? member.sourceUrl : seed.sourceUrl ?? null,
              path: member.sourceUrl?.startsWith("data/") ? member.sourceUrl : null,
              snippet: null,
            },
          ],
          confidence: 0.88,
          needsReview: false,
        });
      }
      continue;
    }
    if (priority.seedSourceId === "nshe-board-of-regents") {
      for (const member of sourceBackedNsheMembers(items)) {
        records.push({
          id: `governing-roster-${slugify(body.id)}-${slugify(member.fullName)}`,
          bodyId: body.id,
          organizationId: body.seed_source_id,
          officialId: officialIdFor(member.fullName, body, officials),
          fullName: member.fullName,
          normalizedName: normalizeName(member.fullName),
          title: "Regent",
          district: null,
          startDate: null,
          endDate: null,
          votingMember: true,
          sourceReferences: [{ label: "NSHE minutes members present section", url: member.sourceUrl, path: member.sourcePath, snippet: member.sourceSnippet }],
          confidence: 0.76,
          needsReview: true,
        });
      }
    }
  }

  const bodyReports = PRIORITY_BODIES.map((priority) => {
    const body = priorityBodyFor(priority.seedSourceId, bodies);
    const bodyRecords = body ? records.filter((record) => record.bodyId === body.id) : [];
    return {
      label: priority.label,
      bodyId: body?.id ?? null,
      organizationId: body?.seed_source_id ?? priority.seedSourceId,
      covered: bodyRecords.length > 0,
      votingMembers: bodyRecords.filter((record) => record.votingMember).length,
      unmatchedMembers: bodyRecords.filter((record) => !record.officialId).length,
      expiredMemberships: bodyRecords.filter((record) => record.endDate).length,
      confidence: bodyRecords.length ? Number((bodyRecords.reduce((sum, record) => sum + record.confidence, 0) / bodyRecords.length).toFixed(2)) : 0,
      blocker: bodyRecords.length ? null : "missing_source_backed_roster",
    };
  });

  const audit = {
    generatedAt,
    totals: {
      priorityBodies: PRIORITY_BODIES.length,
      bodiesCovered: bodyReports.filter((report) => report.covered).length,
      rosterRecords: records.length,
      votingMembers: records.filter((record) => record.votingMember).length,
      unmatchedMembers: records.filter((record) => !record.officialId).length,
      expiredMemberships: records.filter((record) => record.endDate).length,
      averageConfidence: records.length ? Number((records.reduce((sum, record) => sum + record.confidence, 0) / records.length).toFixed(2)) : 0,
    },
    bodyReports,
  };

  return { generatedAt, records, audit };
}

mkdirSync(GENERATED_DIR, { recursive: true });
const { generatedAt, records, audit } = generateRosters();
writeFileSync(OUTPUT_PATH, `${JSON.stringify({ generatedAt, records }, null, 2)}\n`);
writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Generated ${records.length} governing body roster records at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
