import fs from "node:fs";
import path from "node:path";

import {
  nevadaLocalCommunityIds,
  seededCommunities,
} from "@/lib/community/communities";

const GENERATED_DIR = path.join(process.cwd(), "data/generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "nevada-community-linkage-audit.json");

type JsonRecord = Record<string, unknown>;

type PublicBodyRecord = {
  id: string;
  name?: string | null;
  jurisdiction?: string | null;
};

type PublicMeetingRecord = {
  id: string;
  public_body_id?: string | null;
  title?: string | null;
};

type PublicMeetingItemRecord = {
  id: string;
  meeting_id?: string | null;
  title?: string | null;
  fiscal_impact_summary?: string | null;
  financial_impact?: string | null;
};

type RuntimeSource = {
  label: string;
  path: string;
  records: JsonRecord[];
};

type LinkResult = {
  localCommunityIds: string[];
  allCommunityIds: string[];
  stateOnly: boolean;
  federalOnly: boolean;
  evidenceText: string;
  basis: "direct_community_id" | "meeting_body" | "runtime_text" | "issue_communities" | "none";
};

type DomainRecordAudit = {
  id: string;
  sourcePath: string;
  linkedLocalCommunityIds: string[];
  linkedCanonicalCommunityIds: string[];
  countedInCoverageReport: boolean;
  notCountedReasons: string[];
  linkBasis: LinkResult["basis"];
};

type DomainAudit = {
  domain: string;
  coverageReportMetric: string | null;
  sourcePaths: string[];
  interpretation: {
    actualDataAvailableInSystem: boolean;
    linkedToCanonicalCommunityRecords: boolean;
    onlyGeneratedByNewCoverageImplementation: boolean;
    notes: string[];
  };
  totals: {
    totalRecordsInDatabaseOrRuntime: number;
    recordsLinkedToCanonicalCommunities: number;
    recordsLinkedToCoverageCommunities: number;
    recordsNotLinkedToCoverageCommunities: number;
    recordsCountedInCoverageReport: number;
    recordsNotCountedInCoverageReport: number;
  };
  topReasonsRecordsAreNotCounted: { reason: string; count: number }[];
  sampleUncountedRecords: DomainRecordAudit[];
  sourceBreakdown: { path: string; totalRecords: number }[];
};

function readJson<T>(relativePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")) as T;
  } catch {
    return fallback;
  }
}

function asRecords(relativePath: string): JsonRecord[] {
  const value = readJson<unknown>(relativePath, []);

  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (isRecord(value)) {
    for (const key of ["records", "cards", "items", "events", "cases"]) {
      const nested = value[key];
      if (Array.isArray(nested)) {
        return nested.filter(isRecord);
      }
    }
  }

  return [];
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bnv\b/g, "nevada")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRecordId(record: JsonRecord, fallbackPrefix: string, index: number) {
  return text(record.id) || text(record.source_id) || text(record.generation_key) || `${fallbackPrefix}-${index}`;
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const canonicalCommunities = seededCommunities;
const localCommunityIdSet = new Set(nevadaLocalCommunityIds);
const localCommunities = canonicalCommunities.filter((community) => localCommunityIdSet.has(community.id));

const aliasesByCommunity = new Map(
  canonicalCommunities.map((community) => {
    const aliases =
      community.id === "united-states"
        ? new Set([community.id, community.name, community.shortName, community.primaryJurisdictionName, "Federal", "National"])
        : community.id === "nevada"
          ? new Set([community.id, community.name, community.shortName, community.primaryJurisdictionName, "Statewide Nevada"])
          : new Set([
              community.id,
              community.name,
              community.shortName,
              community.primaryJurisdictionName,
              ...community.jurisdictionMatches,
            ]);

    return [
      community.id,
      [...aliases]
        .map((alias) => normalize(alias))
        .filter((alias) => alias.length >= 3)
        .sort((left, right) => right.length - left.length),
    ] as const;
  }),
);

function matchCommunitiesFromText(value: string, options: { includeStatewide: boolean }) {
  const haystack = normalize(value);
  if (!haystack) {
    return [];
  }

  const matches: string[] = [];

  for (const community of canonicalCommunities) {
    if (!options.includeStatewide && !localCommunityIdSet.has(community.id)) {
      continue;
    }

    const aliases = aliasesByCommunity.get(community.id) ?? [];
    if (aliases.some((alias) => haystack.includes(alias))) {
      matches.push(community.id);
    }
  }

  return [...new Set(matches)];
}

function localMatches(value: string) {
  return matchCommunitiesFromText(value, { includeStatewide: false });
}

function allCanonicalMatches(value: string) {
  return matchCommunitiesFromText(value, { includeStatewide: true });
}

function makeLinkResult(evidenceText: string, basis: LinkResult["basis"]): LinkResult {
  const localCommunityIds = localMatches(evidenceText);
  const allCommunityIds = allCanonicalMatches(evidenceText);
  return {
    localCommunityIds,
    allCommunityIds,
    stateOnly: allCommunityIds.includes("nevada") && localCommunityIds.length === 0,
    federalOnly: allCommunityIds.includes("united-states") && localCommunityIds.length === 0,
    evidenceText,
    basis: localCommunityIds.length || allCommunityIds.length ? basis : "none",
  };
}

function linkedViaDirectCommunityId(record: JsonRecord) {
  const direct = text(record.communityId) || text(record.community_id) || text(record.related_community_id) || text(record.jurisdictionId);
  if (!direct) return null;
  const community = canonicalCommunities.find((entry) => entry.id === direct);
  if (!community) return null;
  return makeLinkResult(`${community.id} ${community.name} ${community.primaryJurisdictionName}`, "direct_community_id");
}

const bodies = readJson<PublicBodyRecord[]>("data/generated/public-meeting-bodies.json", []);
const meetings = readJson<PublicMeetingRecord[]>("data/generated/public-meetings.json", []);
const meetingItems = readJson<PublicMeetingItemRecord[]>("data/generated/public-meeting-items.json", []);
const bodyById = new Map(bodies.map((body) => [body.id, body]));
const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
const itemById = new Map(meetingItems.map((item) => [item.id, item]));

function linkMeeting(meeting: JsonRecord) {
  const direct = linkedViaDirectCommunityId(meeting);
  if (direct) return direct;
  const body = bodyById.get(text(meeting.public_body_id));
  const evidence = `${body?.name ?? ""} ${body?.jurisdiction ?? ""} ${text(meeting.title)}`;
  return makeLinkResult(evidence, "meeting_body");
}

function linkMeetingItem(item: JsonRecord) {
  const direct = linkedViaDirectCommunityId(item);
  if (direct) return direct;
  const meeting = meetingById.get(text(item.meeting_id));
  const body = meeting ? bodyById.get(text(meeting.public_body_id)) : null;
  const evidence = `${body?.name ?? ""} ${body?.jurisdiction ?? ""} ${text(item.title)} ${text(item.description)}`;
  return makeLinkResult(evidence, "meeting_body");
}

function linkVotingCard(card: JsonRecord) {
  const direct = linkedViaDirectCommunityId(card);
  if (direct) return direct;
  const item = itemById.get(text(card.topic_item_id));
  const meeting = meetingById.get(text(card.meeting_id)) ?? (item ? meetingById.get(text(item.meeting_id)) : undefined);
  const body = meeting ? bodyById.get(text(meeting.public_body_id)) : null;
  const evidence = [
    text(card.jurisdiction),
    text(card.jurisdiction_display_name),
    text(card.body_name),
    text(card.governing_body_display_name),
    body?.name ?? "",
    body?.jurisdiction ?? "",
  ].join(" ");
  return makeLinkResult(evidence, "runtime_text");
}

function linkIssue(issue: JsonRecord) {
  const direct = linkedViaDirectCommunityId(issue);
  if (direct) return direct;
  const communities = Array.isArray(issue.communities) ? issue.communities.map(text).join(" ") : "";
  const evidence = `${communities} ${text(issue.jurisdictionName)} ${text(issue.scope)}`;
  return makeLinkResult(evidence, communities ? "issue_communities" : "runtime_text");
}

function linkRuntimeText(record: JsonRecord, fields: string[]) {
  const direct = linkedViaDirectCommunityId(record);
  if (direct) return direct;
  const evidence = fields.map((field) => text(record[field])).join(" ");
  return makeLinkResult(evidence, "runtime_text");
}

function reasonsForRecord({
  record,
  link,
  coverageIncludesDomain,
  countedInCoverageReport,
  sourcePath,
}: {
  record: JsonRecord;
  link: LinkResult;
  coverageIncludesDomain: boolean;
  countedInCoverageReport: boolean;
  sourcePath: string;
}) {
  if (countedInCoverageReport) return [];
  const reasons: string[] = [];

  if (!coverageIncludesDomain) {
    reasons.push("domain_not_in_current_coverage_report");
  }

  if (link.localCommunityIds.length === 0) {
    if (link.stateOnly) {
      reasons.push("statewide_record_not_linked_to_local_community");
    } else if (link.federalOnly) {
      reasons.push("federal_record_not_linked_to_local_community");
    } else {
      reasons.push("no_canonical_local_community_match");
    }
  }

  if (link.allCommunityIds.length === 0) {
    reasons.push("no_canonical_community_match");
  }

  if (link.basis !== "direct_community_id") {
    reasons.push("no_direct_community_id_field");
  }

  if (text(record.review_status) === "needs_review" || text(record.reviewStatus) === "needs_review") {
    reasons.push("record_needs_review");
  }

  if (record.unmatched === true) {
    reasons.push("source_parser_marked_unmatched");
  }

  const confidence = numberValue(record.parse_confidence) ?? numberValue(record.confidence_score) ?? numberValue(record.confidence);
  if (confidence !== null && confidence < 0.5) {
    reasons.push("low_confidence_parse_or_match");
  }

  if (sourcePath.includes("candidate") && (!text(record.candidate_name) || !text(record.office))) {
    reasons.push("candidate_record_missing_candidate_or_office");
  }

  if (sourcePath.includes("campaign-finance") && (!text(record.candidate_name) || !text(record.jurisdiction))) {
    reasons.push("finance_record_missing_candidate_or_jurisdiction");
  }

  return [...new Set(reasons)];
}

function buildDomainAudit({
  domain,
  coverageReportMetric,
  sources,
  linker,
  coverageIncludesDomain,
  countedInCoverage,
  notes,
}: {
  domain: string;
  coverageReportMetric: string | null;
  sources: RuntimeSource[];
  linker: (record: JsonRecord, sourcePath: string) => LinkResult;
  coverageIncludesDomain: boolean;
  countedInCoverage: (record: JsonRecord, link: LinkResult, sourcePath: string) => boolean;
  notes: string[];
}): DomainAudit {
  const auditedRecords: DomainRecordAudit[] = [];
  const reasonCounts = new Map<string, number>();
  let totalRecords = 0;
  let linkedCanonical = 0;
  let linkedLocal = 0;
  let counted = 0;

  for (const source of sources) {
    source.records.forEach((record, index) => {
      totalRecords += 1;
      const link = linker(record, source.path);
      const countedInCoverageReport = countedInCoverage(record, link, source.path);
      const reasons = reasonsForRecord({
        record,
        link,
        coverageIncludesDomain,
        countedInCoverageReport,
        sourcePath: source.path,
      });

      if (link.allCommunityIds.length > 0) linkedCanonical += 1;
      if (link.localCommunityIds.length > 0) linkedLocal += 1;
      if (countedInCoverageReport) counted += 1;
      for (const reason of reasons) increment(reasonCounts, reason);

      auditedRecords.push({
        id: getRecordId(record, domain, index),
        sourcePath: source.path,
        linkedLocalCommunityIds: link.localCommunityIds,
        linkedCanonicalCommunityIds: link.allCommunityIds,
        countedInCoverageReport,
        notCountedReasons: reasons,
        linkBasis: link.basis,
      });
    });
  }

  return {
    domain,
    coverageReportMetric,
    sourcePaths: sources.map((source) => source.path),
    interpretation: {
      actualDataAvailableInSystem: totalRecords > 0,
      linkedToCanonicalCommunityRecords: linkedCanonical > 0,
      onlyGeneratedByNewCoverageImplementation: false,
      notes,
    },
    totals: {
      totalRecordsInDatabaseOrRuntime: totalRecords,
      recordsLinkedToCanonicalCommunities: linkedCanonical,
      recordsLinkedToCoverageCommunities: linkedLocal,
      recordsNotLinkedToCoverageCommunities: totalRecords - linkedLocal,
      recordsCountedInCoverageReport: counted,
      recordsNotCountedInCoverageReport: totalRecords - counted,
    },
    topReasonsRecordsAreNotCounted: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
    sampleUncountedRecords: auditedRecords.filter((record) => !record.countedInCoverageReport).slice(0, 25),
    sourceBreakdown: sources.map((source) => ({
      path: source.path,
      totalRecords: source.records.length,
    })),
  };
}

const meetingSources: RuntimeSource[] = [
  { label: "meetings", path: "data/generated/public-meetings.json", records: asRecords("data/generated/public-meetings.json") },
];

const officialSources: RuntimeSource[] = [
  { label: "official actions", path: "data/generated/officials-runtime.json", records: asRecords("data/generated/officials-runtime.json") },
];

const electionSources: RuntimeSource[] = [
  { label: "candidate records", path: "data/generated/nv-sos-candidate-records.json", records: asRecords("data/generated/nv-sos-candidate-records.json") },
];

const courtCaseSources: RuntimeSource[] = [
  { label: "reviewed public court cases", path: "data/generated/public-court-cases-runtime.json", records: asRecords("data/generated/public-court-cases-runtime.json") },
  { label: "public civic cases", path: "data/generated/public-cases-runtime.json", records: asRecords("data/generated/public-cases-runtime.json") },
];

const spendingSources: RuntimeSource[] = [
  {
    label: "meeting items with fiscal impact",
    path: "data/generated/public-meeting-items.json",
    records: asRecords("data/generated/public-meeting-items.json").filter((record) => Boolean(text(record.fiscal_impact_summary) || text(record.financial_impact))),
  },
  { label: "campaign finance records", path: "data/generated/nv-sos-campaign-finance-records.json", records: asRecords("data/generated/nv-sos-campaign-finance-records.json") },
];

const votingCardSources: RuntimeSource[] = [
  { label: "meeting voting cards", path: "data/generated/public-meeting-voting-cards.json", records: asRecords("data/generated/public-meeting-voting-cards.json") },
];

const issueSources: RuntimeSource[] = [
  { label: "issue hubs", path: "data/generated/issues-runtime.json", records: asRecords("data/generated/issues-runtime.json") },
];

function main() {
  const domains: DomainAudit[] = [
    buildDomainAudit({
      domain: "meetings",
      coverageReportMetric: "communitiesWithMeetings",
      sources: meetingSources,
      linker: (record) => linkMeeting(record),
      coverageIncludesDomain: true,
      countedInCoverage: (_record, link) => link.localCommunityIds.length > 0,
      notes: [
        "Meetings are counted through their public_body_id joined to public-meeting-bodies, then inferred against canonical community names.",
        "There is no direct communityId on meeting records.",
      ],
    }),
    buildDomainAudit({
      domain: "officials",
      coverageReportMetric: "communitiesWithOfficials",
      sources: officialSources,
      linker: (record) => linkRuntimeText(record, ["jurisdiction_body", "action_text", "official_name_raw"]),
      coverageIncludesDomain: true,
      countedInCoverage: (_record, link) => link.localCommunityIds.length > 0,
      notes: [
        "The audited runtime source contains official meeting action records, not the complete elected-official directory.",
        "Coverage is inferred from jurisdiction_body text.",
      ],
    }),
    buildDomainAudit({
      domain: "elections",
      coverageReportMetric: "communitiesWithElections",
      sources: electionSources,
      linker: (record) => linkRuntimeText(record, ["jurisdiction", "district", "office"]),
      coverageIncludesDomain: true,
      countedInCoverage: (_record, link) => link.localCommunityIds.length > 0,
      notes: [
        "The audited runtime source is Nevada SOS candidate parser output.",
        "Current records are sparse and several are marked unmatched or low-confidence, so coverage can reflect parser quality as much as missing election data.",
      ],
    }),
    buildDomainAudit({
      domain: "courtCases",
      coverageReportMetric: "communitiesWithCourtCases",
      sources: courtCaseSources,
      linker: (record) => linkRuntimeText(record, ["jurisdiction", "jurisdictionName", "communityName", "title", "body_or_department"]),
      coverageIncludesDomain: true,
      countedInCoverage: (_record, link) => link.localCommunityIds.length > 0,
      notes: [
        "Reviewed appellate court records often link to statewide Nevada only, not a local community.",
        "Public civic case records derived from meeting agenda items are local when their jurisdiction text matches a canonical community.",
      ],
    }),
    buildDomainAudit({
      domain: "spending",
      coverageReportMetric: "communitiesWithSpendingData",
      sources: spendingSources,
      linker: (record, sourcePath) => sourcePath.includes("public-meeting-items") ? linkMeetingItem(record) : linkRuntimeText(record, ["jurisdiction", "district", "office", "candidate_name"]),
      coverageIncludesDomain: true,
      countedInCoverage: (_record, link) => link.localCommunityIds.length > 0,
      notes: [
        "Coverage counts meeting agenda items with financial/fiscal impact plus campaign finance records.",
        "Meeting spending links through meeting body; campaign finance links through parsed office/jurisdiction text.",
      ],
    }),
    buildDomainAudit({
      domain: "votingCards",
      coverageReportMetric: "communitiesWithVotingCards",
      sources: votingCardSources,
      linker: (record) => linkVotingCard(record),
      coverageIncludesDomain: true,
      countedInCoverage: (_record, link) => link.localCommunityIds.length > 0 || link.stateOnly,
      notes: [
        "Voting cards are generated runtime records and are counted in the Sprint 1B community coverage report.",
        "Local links come through jurisdiction/body/meeting references; statewide-only cards appear as statewide overlay relationships.",
      ],
    }),
    buildDomainAudit({
      domain: "issues",
      coverageReportMetric: "communitiesWithIssues",
      sources: issueSources,
      linker: (record) => linkIssue(record),
      coverageIncludesDomain: true,
      countedInCoverage: (_record, link) => link.localCommunityIds.length > 0 || link.stateOnly,
      notes: [
        "Issue hubs are generated runtime summaries from meetings, voting cards, court cases, and review requests.",
        "Issue hubs are counted in the Sprint 1B community coverage report through the generated relationship map.",
      ],
    }),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    auditGoal: "Determine whether Nevada community coverage gaps are missing data or missing canonical community relationships.",
    canonicalCommunityScope: {
      coverageCommunities: localCommunities.length,
      allCanonicalCommunities: canonicalCommunities.length,
      coverageCommunityIds: localCommunities.map((community) => community.id),
      statewideCommunityId: "nevada",
      federalOverlayCommunityId: "united-states",
    },
    coverageReportUnderAudit: "data/generated/nevada-community-coverage-report.json",
    conclusions: {
      coverageReportRepresents: [
        "actual runtime records where available",
        "records inferred to canonical local community records by text/body/jurisdiction matching",
        "not merely records generated by the new community coverage implementation",
      ],
      caveats: [
        "Most domains do not have direct communityId fields, so linkage is inferred.",
        "Statewide Nevada records are actual data but are intentionally not counted as local community coverage.",
        "Voting cards and issues are now counted in the Sprint 1B coverage report through the generated relationship map.",
        "Officials coverage uses official-action runtime records, not a full official directory.",
      ],
    },
    domains,
  };

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      Object.fromEntries(
        domains.map((domain) => [
          domain.domain,
          {
            total: domain.totals.totalRecordsInDatabaseOrRuntime,
            linkedToCoverageCommunities: domain.totals.recordsLinkedToCoverageCommunities,
            notLinkedToCoverageCommunities: domain.totals.recordsNotLinkedToCoverageCommunities,
            countedInCoverageReport: domain.totals.recordsCountedInCoverageReport,
          },
        ]),
      ),
      null,
      2,
    ),
  );
  console.log(`[nevada-community-linkage-audit] Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();
