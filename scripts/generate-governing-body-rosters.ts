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
  generatedPersonKey: string;
  officialIdMissing: boolean;
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

const STATIC_SOURCE_ROSTERS: Record<
  string,
  {
    sourceLabel: string;
    sourceUrl: string;
    confidence: number;
    needsReview?: boolean;
    members: Array<{ fullName: string; title: string; district: string | null; startDate?: string | null; endDate?: string | null; votingMember?: boolean; snippet?: string }>;
  }
> = {
  "carson-city-board-of-supervisors": {
    sourceLabel: "Carson City Board of Supervisors contact page",
    sourceUrl: "https://www.carsoncity.gov/government/board-of-supervisors/contact-us",
    confidence: 0.9,
    members: [
      { fullName: "Lori Bagwell", title: "Mayor", district: "Mayor", snippet: "Bagwell, Lori Mayor Board of Supervisors" },
      { fullName: "Stacey Giomi", title: "Supervisor", district: "Ward 1", snippet: "Giomi, Stacey Supervisor, Ward 1 Board of Supervisors" },
      { fullName: 'Maurice "Mo" White', title: "Supervisor", district: "Ward 2", snippet: 'White, Maurice "Mo" Supervisor, Ward 2 Board of Supervisors' },
      { fullName: "Curtis Horton", title: "Supervisor", district: "Ward 3", snippet: "Horton, Curtis Supervisor, Ward 3 Board of Supervisors" },
      { fullName: "Lisa Schuette", title: "Supervisor", district: "Ward 4", snippet: "Schuette, Lisa Supervisor, Ward 4 Board of Supervisors" },
    ],
  },
  "washoe-county-commission": {
    sourceLabel: "Washoe County Commissioner Profiles",
    sourceUrl: "https://www.washoecounty.gov/bcc/profile/index.php",
    confidence: 0.92,
    members: [
      { fullName: "Alexis Hill", title: "Commissioner", district: "District 1", startDate: "2025-01-06", endDate: "2029-01-01", snippet: "Commissioner Alexis Hill District 1 Current Term: 01/06/25 - 01/01/29" },
      { fullName: "Michael Clark", title: "Commissioner", district: "District 2", startDate: "2023-01-06", endDate: "2027-01-04", snippet: "Commissioner Michael Clark District 2 Current Term: 01/06/23 - 01/04/27" },
      { fullName: "Mariluz Garcia", title: "Vice Chair", district: "District 3", startDate: "2023-01-06", endDate: "2027-01-04", snippet: "Vice Chair Mariluz Garcia District 3 Current Term: 01/06/23 - 01/04/27" },
      { fullName: "Clara Andriola", title: "Chair", district: "District 4", startDate: "2025-01-06", endDate: "2029-01-01", snippet: "Chair Clara Andriola District 4 Current Term: 01/06/25 - 01/01/29" },
      { fullName: "Jeanne Herman", title: "Commissioner", district: "District 5", startDate: "2023-01-06", endDate: "2027-01-04", snippet: "Commissioner Jeanne Herman District 5 Current Term: 01/06/23 - 01/04/27" },
    ],
  },
  "washoe-county-school-district": {
    sourceLabel: "Washoe County School District Board of Trustees",
    sourceUrl: "https://www.washoeschools.net/trustees/board-of-trustees",
    confidence: 0.9,
    members: [
      { fullName: "Christine Hull", title: "Trustee", district: "District A", snippet: "Christine Hull, District A" },
      { fullName: "Colleen Westlake", title: "Trustee", district: "District B", snippet: "Colleen Westlake, District B" },
      { fullName: "James Phoenix", title: "Trustee", district: "District C", snippet: "James Phoenix, District C" },
      { fullName: "Elizabeth Smith", title: "Trustee", district: "District D", snippet: "Elizabeth Smith, District D" },
      { fullName: "Alex Woodley", title: "Trustee", district: "District E", snippet: "Alex Woodley, District E" },
      { fullName: "Adam Mayberry", title: "Trustee", district: "District F", snippet: "Adam Mayberry, District F" },
      { fullName: "Diane Nicolet", title: "Trustee", district: "District G", snippet: "Diane Nicolet Ph.D., District G" },
    ],
  },
  "nv-senate": {
    sourceLabel: "Nevada Legislature Senate 83rd Session roster",
    sourceUrl: "https://www.leg.state.nv.us/App/Legislator/A/Senate/83rd2025",
    confidence: 0.88,
    members: [
      ["Carrie Ann Buck", "5"], ["Nicole J. Cannizzaro", "6"], ['Michelee "Shelly" Cruz-Crawford', "1"], ["Skip Daly", "13"], ["Fabian Doñate", "10"], ["Marilyn Dondero Loop", "8"], ["John Ellison", "19"], ["Edgar Flores", "2"], ["Ira Hansen", "14"], ["Lisa Krasner", "16"], ["Roberta Lange", "7"], ["Dina Neal", "4"], ["Rochelle T. Nguyen", "3"], ["James Ohrenschall", "21"], ["Julie Pazina", "12"], ["Lori Rogich", "11"], ["Melanie Scheible", "9"], ["John C. Steinbeck", "18"], ["Jeff Stone", "20"], ["Angela D. Taylor", "15"], ["Robin L. Titus", "17"],
    ].map(([fullName, district]) => ({ fullName, title: "Senator", district: `District ${district}`, snippet: `${fullName} No. ${district} Currently Serving` })),
  },
  "nv-assembly": {
    sourceLabel: "Nevada Legislature Assembly 83rd Session roster",
    sourceUrl: "https://www.leg.state.nv.us/App/Legislator/A/Assembly/83rd2025",
    confidence: 0.86,
    members: [
      ["Natha C. Anderson", "30"], ["Shea M. Backus", "37"], ["Tracy Brown-May", "42"], ["Max E. Carter II", "12"], ["Lisa K. Cole", "4"], ["Venicia Considine", "18"], ["Joe Dalia", "29"], ["Rich DeLong", "26"], ["Jill Dickman", "31"], ["Reuben D'Silva", "28"], ["Rebecca Edgeworth", "35"], ["Tanya P. Flanagan", "7"], ["Danielle Gallant", "23"], ["Cecelia González", "16"], ["Heather Goulding", "27"], ["Bert K. Gurr", "33"], ["Gregory T. Hafen II", "36"], ["Alexis M. Hansen", "32"], ["Melissa R. Hardy", "22"], ["Brian Hibbetts", "13"], ["Linda F. Hunt", "17"], ["Jovan A. Jackson", "6"], ["Sandra Jauregui", "41"], ["Venise Karris", "10"], ["Heidi Kasama", "2"], ["Gregory S. Koenig", "38"], ["Selena La Rue Hatch", "25"], ["Elaine H. Marzola", "21"], ["Brittney M. Miller", "5"], ["Daniele Monroe-Moreno", "1"], ["Cinthia Zermeño Moore", "11"], ["Erica Mosca", "14"], ["Hanadi Nadeem", "34"], ["Duy Nguyen", "8"], ["PK O’Neill", "40"], ["David Orentlicher", "20"], ["Erica P. Roth", "24"], ["Selena Torres-Fossett", "3"], ["Howard Watts", "15"], ["Steve Yeager", "9"],
    ].map(([fullName, district]) => ({ fullName, title: "Assemblymember", district: `District ${district}`, snippet: `${fullName} No. ${district} Currently Serving` })),
  },
};

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

function makeRecord({
  body,
  member,
  sourceLabel,
  sourceUrl,
  confidence,
  needsReview,
  officials,
}: {
  body: PublicBodyRecord;
  member: { fullName: string; title: string | null; district: string | null; startDate?: string | null; endDate?: string | null; votingMember?: boolean; snippet?: string | null };
  sourceLabel: string;
  sourceUrl: string | null;
  confidence: number;
  needsReview: boolean;
  officials: OfficialRecord[];
}): RosterRecord {
  const officialId = officialIdFor(member.fullName, body, officials);
  return {
    id: `governing-roster-${slugify(body.id)}-${slugify(member.fullName)}`,
    bodyId: body.id,
    organizationId: body.seed_source_id,
    officialId,
    generatedPersonKey: `generated-person-${slugify(body.seed_source_id)}-${slugify(member.fullName)}`,
    officialIdMissing: !officialId,
    fullName: member.fullName,
    normalizedName: normalizeName(member.fullName),
    title: member.title,
    district: member.district,
    startDate: member.startDate ?? null,
    endDate: member.endDate ?? null,
    votingMember: member.votingMember ?? !member.endDate,
    sourceReferences: [{ label: sourceLabel, url: sourceUrl, path: null, snippet: member.snippet ?? null }],
    confidence,
    needsReview,
  };
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
    const staticRoster = STATIC_SOURCE_ROSTERS[priority.seedSourceId];
    if (staticRoster) {
      for (const member of staticRoster.members) {
        records.push(
          makeRecord({
            body,
            member,
            sourceLabel: staticRoster.sourceLabel,
            sourceUrl: staticRoster.sourceUrl,
            confidence: staticRoster.confidence,
            needsReview: staticRoster.needsReview ?? false,
            officials,
          }),
        );
      }
      continue;
    }
    if (seed?.members?.length) {
      for (const member of seed.members) {
        const active = (member.status ?? "CURRENT").toUpperCase() === "CURRENT";
        records.push(
          makeRecord({
            body,
            member: { fullName: member.fullName, title: member.seatTitle ?? seed.bodyName, district: member.seatTitle ?? null, endDate: active ? null : generatedAt, votingMember: active },
            sourceLabel: seed.sourceName,
            sourceUrl: member.sourceUrl?.startsWith("http") ? member.sourceUrl : seed.sourceUrl ?? null,
            confidence: 0.88,
            needsReview: false,
            officials,
          }),
        );
      }
      continue;
    }
    if (priority.seedSourceId === "nshe-board-of-regents") {
      for (const member of sourceBackedNsheMembers(items)) {
        records.push(
          makeRecord({
            body,
            member: { fullName: member.fullName, title: "Regent", district: null, snippet: member.sourceSnippet },
            sourceLabel: "NSHE minutes members present section",
            sourceUrl: member.sourceUrl,
            confidence: 0.76,
            needsReview: true,
            officials,
          }),
        );
      }
    }
  }

  const isExpired = (record: RosterRecord) => Boolean(record.endDate && Date.parse(record.endDate) < Date.now());
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
      expiredMemberships: bodyRecords.filter(isExpired).length,
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
      expiredMemberships: records.filter(isExpired).length,
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
