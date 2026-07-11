import { existsSync, readFileSync, statSync } from "fs";
import path from "path";

import { getCommunityById, getCommunityPageHref, seededCommunities } from "@/lib/community/communities";
import { communityMatchesMembership } from "@/lib/community/membership";
import type { FavoriteTargetType } from "@/lib/favorites/types";
import { getDurablePublicPeopleDirectory } from "@/lib/profile/public-people";
import { prisma } from "@/lib/prisma";
import type { AuthUser, PublicCitizenDirectorySummary } from "@/types/domain";

export type BrowsePreviewCategory =
  | "communities"
  | "issues"
  | "people"
  | "candidates"
  | "officials"
  | "petitions"
  | "cases"
  | "events"
  | "elections"
  | "ads"
  | "organizations";

export type BrowsePreviewBadgeTone = "slate" | "civic" | "orange" | "emerald";

export type BrowsePreviewItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  href: string;
  ctaLabel: string;
  badges?: Array<{ label: string; tone?: BrowsePreviewBadgeTone }>;
  avatar?: {
    name?: string | null;
    imageUrl?: string | null;
    entityType?:
      | "citizen"
      | "trustedCitizen"
      | "candidate"
      | "official"
      | "organization"
      | "media"
      | "community"
      | "agency"
      | "case"
      | "publicAccountability"
      | "petition"
      | "issue";
    verified?: boolean;
  };
  favorite?: {
    targetType: FavoriteTargetType;
    targetId: string;
  };
  follow?: {
    targetUserId: string;
    returnPath: string;
    isFollowing: boolean;
    canFollow: boolean;
  };
  facets?: Record<string, string[]>;
  sourceUrl?: string | null;
};

export type BrowsePreviewData = {
  category: BrowsePreviewCategory;
  items: BrowsePreviewItem[];
  sourceCount: number;
  availableGeneratedCount: number;
  lastGeneratedAt: string | null;
  isSourceBacked: boolean;
  emptyReason: string | null;
  usesDemoData: boolean;
  fullHref: string | null;
  statusLabel: "Source-backed" | "Limited data";
};

type BrowsePreviewOptions = {
  category: BrowsePreviewCategory;
  communityId: string;
  query?: string;
  limit?: number;
  favoriteIds?: string[];
  viewerUser?: AuthUser;
  filters?: Record<string, string | undefined>;
};

const DATA_ROOT = path.join(process.cwd(), "data", "generated");

const CATEGORY_HREFS: Record<BrowsePreviewCategory, string | null> = {
  communities: "/communities",
  issues: "/issues",
  people: "/people",
  candidates: null,
  officials: "/officials",
  petitions: null,
  cases: "/cases",
  events: "/events",
  elections: "/elections",
  ads: null,
  organizations: "/organizations",
};

function readJsonFile<T>(fileName: string, fallback: T): { data: T; lastGeneratedAt: string | null; exists: boolean } {
  const filePath = path.join(DATA_ROOT, fileName);

  if (!existsSync(filePath)) {
    return { data: fallback, lastGeneratedAt: null, exists: false };
  }

  try {
    const data = JSON.parse(readFileSync(filePath, "utf8")) as T;
    const lastGeneratedAt =
      typeof data === "object" && data && "generatedAt" in data && typeof (data as { generatedAt?: unknown }).generatedAt === "string"
        ? (data as { generatedAt: string }).generatedAt
        : statSync(filePath).mtime.toISOString();

    return { data, lastGeneratedAt, exists: true };
  } catch (error) {
    console.warn(`[browse-preview] failed to read ${fileName}`, error);
    return { data: fallback, lastGeneratedAt: null, exists: false };
  }
}

function recordsFrom<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const maybeRecords = (value as { records?: unknown; rows?: unknown }).records ?? (value as { rows?: unknown }).rows;
    if (Array.isArray(maybeRecords)) return maybeRecords as T[];
  }

  return [];
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function compactText(...values: Array<unknown>) {
  return values.map(asText).filter(Boolean).join(" ");
}

function matchesQuery(query: string, ...values: Array<unknown>) {
  if (!query.trim()) return true;
  const normalized = query.trim().toLowerCase();
  return values.some((value) => asText(value).toLowerCase().includes(normalized));
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/\bnevada\b/g, "nv")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCommunityNeedles(communityId: string) {
  const community = getCommunityById(communityId);

  if (!community) {
    return [];
  }

  return [
    community.name,
    community.shortName ?? "",
    community.primaryJurisdictionName,
    community.locationLabel ?? "",
    ...community.jurisdictionMatches,
  ]
    .map(normalizeForMatch)
    .filter(Boolean);
}

function matchesCommunity(communityId: string, ...values: Array<unknown>) {
  const needles = getCommunityNeedles(communityId);
  if (!needles.length) return true;

  const haystack = normalizeForMatch(compactText(...values));
  if (!haystack) return false;

  return needles.some((needle) => haystack.includes(needle) || needle.includes(haystack));
}

function isStatewideNevada(...values: Array<unknown>) {
  const haystack = normalizeForMatch(compactText(...values));
  return haystack === "nv" || haystack.includes("statewide") || haystack.includes("nevada legislature") || haystack.includes("supreme court of nv");
}

function orderLocalThenStatewide<T>(communityId: string, items: T[], getText: (item: T) => unknown[]) {
  return [...items].sort((a, b) => {
    const aText = getText(a);
    const bText = getText(b);
    const aLocal = matchesCommunity(communityId, ...aText);
    const bLocal = matchesCommunity(communityId, ...bText);
    if (aLocal !== bLocal) return aLocal ? -1 : 1;
    const aState = isStatewideNevada(...aText);
    const bState = isStatewideNevada(...bText);
    if (aState !== bState) return aState ? 1 : -1;
    return 0;
  });
}

function normalizeFacet(value: string) {
  return value.trim().toLowerCase();
}

function facetValues(...values: Array<unknown>) {
  return values.flatMap((value) => {
    if (Array.isArray(value)) {
      return value.map(asText).filter(Boolean);
    }

    return asText(value) ? [asText(value)] : [];
  });
}

function matchesFilters(item: BrowsePreviewItem, filters?: Record<string, string | undefined>) {
  const activeFilters = Object.entries(filters ?? {}).filter(([, value]) => value?.trim());

  if (!activeFilters.length) {
    return true;
  }

  return activeFilters.every(([key, value]) => {
    const normalizedValue = normalizeFacet(value ?? "");
    const values = item.facets?.[key] ?? [];
    return values.some((entry) => normalizeFacet(entry) === normalizedValue);
  });
}

function inferGovernmentLevel(...values: Array<unknown>) {
  const text = compactText(...values).toLowerCase();

  if (text.includes("school") || text.includes("trustee")) return "School";
  if (text.includes("congress") || text.includes("u.s.") || text.includes("federal")) return "Federal";
  if (text.includes("senate") || text.includes("assembly") || text.includes("governor") || text.includes("state")) return "State";
  if (text.includes("county") || text.includes("commissioner") || text.includes("sheriff")) return "County";
  if (text.includes("city") || text.includes("mayor") || text.includes("council") || text.includes("municipal")) return "City";
  if (text.includes("court") || text.includes("judge") || text.includes("justice")) return "Court";
  return "Other";
}

function filterItems(items: BrowsePreviewItem[], query: string, favoriteIds?: string[], filters?: Record<string, string | undefined>) {
  const favoriteFiltered = favoriteIds ? items.filter((item) => favoriteIds.includes(item.id)) : items;
  return favoriteFiltered.filter((item) => matchesQuery(query, item.title, item.subtitle, item.description) && matchesFilters(item, filters));
}

function withEmptyReason(data: Omit<BrowsePreviewData, "emptyReason" | "statusLabel">, emptyReason: string): BrowsePreviewData {
  const hasItems = data.items.length > 0;
  return {
    ...data,
    emptyReason: hasItems ? null : emptyReason,
    statusLabel: hasItems && data.isSourceBacked ? "Source-backed" : "Limited data",
  };
}

function formatDate(value: unknown) {
  const text = asText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCandidateName(value: string) {
  const [last, ...rest] = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (last && rest.length) return `${rest.join(" ")} ${last}`;
  return value;
}

async function getImportedCandidatePreviewRows() {
  return prisma.candidate.findMany({
    include: {
      election: { select: { title: true, electionDate: true } },
      office: { select: { title: true } },
      jurisdiction: { select: { name: true } },
      source: { select: { name: true, url: true } },
    },
    orderBy: [{ election: { electionDate: "desc" } }, { office: { title: "asc" } }, { fullName: "asc" }],
    take: 300,
  });
}

function eventStatusFromStartAt(record: Record<string, unknown>) {
  const currentStatus = asText(record.status).toLowerCase();
  if (currentStatus === "cancelled") return "cancelled";

  const startTime = Date.parse(asText(record.start_at));
  if (!Number.isFinite(startTime)) return currentStatus || "unknown";

  return startTime >= Date.now() ? "upcoming" : "completed";
}

function buildCommunitiesPreview({ communityId, query, limit = 8, favoriteIds, filters }: BrowsePreviewOptions): BrowsePreviewData {
  const report = readJsonFile<{ rows?: Array<Record<string, unknown>>; generatedAt?: string }>("nevada-community-coverage-report.json", {});
  const rows = recordsFrom<Record<string, unknown>>(report.data.rows ?? []);
  const rowById = new Map(rows.map((row) => [asText(row.id), row]));
  const selectedId = getCommunityById(communityId)?.id;
  const communities = [...seededCommunities].sort((a, b) => {
    if (a.id === selectedId) return -1;
    if (b.id === selectedId) return 1;
    return a.name.localeCompare(b.name);
  });

  const items = filterItems(
    communities.map((community) => {
      const row = rowById.get(community.id);
      const counts = (row?.counts ?? {}) as Record<string, unknown>;
      const localMeetings = asNumber(((row?.localCounts ?? {}) as Record<string, unknown>).meetings);
      return {
        id: community.id,
        title: community.name,
        subtitle: community.descriptor,
        description:
          localMeetings > 0
            ? `${localMeetings.toLocaleString()} local meeting records linked in the generated Nevada relationship index.`
            : community.locationLabel ?? "Canonical Nevada community page.",
        href: getCommunityPageHref(community.id),
        ctaLabel: "Open community",
        avatar: {
          name: community.shortName ?? community.name,
          imageUrl: community.imagePath,
          entityType: "community" as const,
        },
        badges: [
          { label: community.scope, tone: "civic" as const },
          { label: `${asNumber(counts.meetings).toLocaleString()} meetings`, tone: "slate" as const },
        ],
        facets: {
          scope: facetValues(community.scope),
          location: facetValues(community.name, community.primaryJurisdictionName, community.locationLabel),
        },
        favorite: { targetType: "community" as const, targetId: community.id },
      };
    }),
    query ?? "",
    favoriteIds,
    filters,
  ).slice(0, limit);

  return withEmptyReason(
    {
      category: "communities",
      items,
      sourceCount: rows.length || seededCommunities.length,
      availableGeneratedCount: rows.length,
      lastGeneratedAt: report.lastGeneratedAt,
      isSourceBacked: rows.length > 0,
      usesDemoData: false,
      fullHref: CATEGORY_HREFS.communities,
    },
    "No canonical Nevada community records are available in the generated coverage report yet.",
  );
}

function buildIssuesPreview({ communityId, query, limit = 8, favoriteIds, filters }: BrowsePreviewOptions): BrowsePreviewData {
  const runtime = readJsonFile<{ records?: Array<Record<string, unknown>>; generatedAt?: string }>("issues-runtime.json", {});
  const records = recordsFrom<Record<string, unknown>>(runtime.data);
  const sourceBacked = records.filter((record) => record.sourceBacked === true);
  const localRecords = sourceBacked.filter((record) =>
    matchesCommunity(communityId, record.jurisdictionName, Array.isArray(record.communities) ? record.communities.join(" ") : ""),
  );
  const candidates = localRecords.length ? localRecords : sourceBacked;
  const ordered = orderLocalThenStatewide(communityId, candidates, (record) => [
    record.jurisdictionName,
    Array.isArray(record.communities) ? record.communities.join(" ") : "",
  ]);

  const items = filterItems(
    ordered.map((record) => ({
      id: asText(record.id) || asText(record.issueSlug),
      title: asText(record.issueText) || "Source-backed issue",
      subtitle: `${asText(record.jurisdictionName) || "Nevada"} · ${asText(record.scope) || "civic issue"}`,
      description: asText(record.summary),
      href: `/issues/${asText(record.issueSlug) || asText(record.id)}`,
      ctaLabel: "Open issue",
      avatar: { name: asText(record.issueText), entityType: "issue" as const },
      badges: [
        { label: "Source-backed", tone: "emerald" as const },
        { label: `${asNumber((record.relationshipCounts as Record<string, unknown> | undefined)?.votingCards).toLocaleString()} voting cards`, tone: "civic" as const },
      ],
      facets: {
        scope: facetValues(record.scope),
        location: facetValues(record.jurisdictionName, Array.isArray(record.communities) ? record.communities : []),
      },
      favorite: { targetType: "issue" as const, targetId: asText(record.id) },
    })),
    query ?? "",
    favoriteIds,
    filters,
  ).slice(0, limit);

  return withEmptyReason(
    {
      category: "issues",
      items,
      sourceCount: sourceBacked.length,
      availableGeneratedCount: records.length,
      lastGeneratedAt: runtime.lastGeneratedAt,
      isSourceBacked: sourceBacked.length > 0,
      usesDemoData: false,
      fullHref: CATEGORY_HREFS.issues,
    },
    "No generated source-backed issue hubs are available for this community yet.",
  );
}

function buildPeopleReturnPath(communityId: string, query?: string, favoriteIds?: string[]) {
  const params = new URLSearchParams({
    communityId,
    category: "people",
  });

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (favoriteIds) {
    params.set("favorites", "1");
  }

  return `/explore?${params.toString()}`;
}

function personRoleLabel(role: PublicCitizenDirectorySummary["role"]) {
  return role === "trustedCitizen" ? "Trusted citizen" : "Registered citizen";
}

function buildPersonDescription(person: PublicCitizenDirectorySummary) {
  const issueText = person.topIssuesPreview.length
    ? ` Active around ${person.topIssuesPreview.slice(0, 2).join(" and ")}.`
    : " Follow to help build a visible civic signal around their public work.";

  return `${person.bio ?? "Public Direct Democracy profile."} ${issueText}`;
}

async function buildPeoplePreview({
  communityId,
  query,
  limit = 8,
  favoriteIds,
  viewerUser,
  filters,
}: BrowsePreviewOptions): Promise<BrowsePreviewData> {
  const people = await getDurablePublicPeopleDirectory(viewerUser ?? { id: "browse-audit-viewer" });
  const localPeople = people.filter((person) => communityMatchesMembership(communityId, person));
  const localIds = new Set(localPeople.map((person) => person.id));
  const candidates = query?.trim()
    ? people
    : [...localPeople, ...people.filter((person) => !localIds.has(person.id))];
  const returnPath = buildPeopleReturnPath(communityId, query, favoriteIds);

  const items = filterItems(
    candidates.map((person) => ({
      id: person.id,
      title: person.name,
      subtitle: `@${person.username} · ${person.jurisdictionName}`,
      description: buildPersonDescription(person),
      href: `/citizens/${person.id}`,
      ctaLabel: "Open profile",
      avatar: {
        name: person.name,
        imageUrl: person.profileImageUrl,
        entityType: person.role === "trustedCitizen" ? ("trustedCitizen" as const) : ("citizen" as const),
        verified: person.role === "trustedCitizen",
      },
      badges: [
        { label: personRoleLabel(person.role), tone: person.role === "trustedCitizen" ? ("emerald" as const) : ("civic" as const) },
        { label: `${person.followerCount.toLocaleString()} followers`, tone: "slate" as const },
        { label: `Credibility: ${person.civicCredibility.label}`, tone: "civic" as const },
        ...(person.topIssuesPreview[0] ? [{ label: person.topIssuesPreview[0], tone: "slate" as const }] : []),
      ],
      facets: {
        role: facetValues(personRoleLabel(person.role)),
        credibility: facetValues(person.civicCredibility.label),
        location: facetValues(person.jurisdictionName),
        topic: facetValues(person.topIssuesPreview),
      },
      favorite: { targetType: "person" as const, targetId: person.id },
      follow: {
        targetUserId: person.id,
        returnPath,
        isFollowing: person.viewerIsFollowing,
        canFollow: person.viewerCanFollow,
      },
    })),
    query ?? "",
    favoriteIds,
    filters,
  ).slice(0, limit);

  return withEmptyReason(
    {
      category: "people",
      items,
      sourceCount: people.length,
      availableGeneratedCount: people.length,
      lastGeneratedAt: null,
      isSourceBacked: false,
      usesDemoData: false,
      fullHref: CATEGORY_HREFS.people,
    },
    "No public citizen or trusted-citizen profiles are available for this community yet.",
  );
}

function buildCasesPreview({ communityId, query, limit = 8, favoriteIds, filters }: BrowsePreviewOptions): BrowsePreviewData {
  const reviewedRuntime = readJsonFile<{ records?: Array<Record<string, unknown>>; generatedAt?: string }>("public-court-cases-runtime.json", {});
  const publicCaseRuntime = readJsonFile<Array<Record<string, unknown>>>("public-cases-runtime.json", []);
  const reviewedCases = recordsFrom<Record<string, unknown>>(reviewedRuntime.data).filter(
    (record) => record.isRealCourtRecord === true && record.reviewStatus === "approved",
  );
  const agendaCases = recordsFrom<Record<string, unknown>>(publicCaseRuntime.data).filter((record) => asText(record.source_url));
  const combined: Array<Record<string, unknown> & { sourceKind: string }> = [
    ...reviewedCases.map((record) => ({ ...record, sourceKind: "reviewed_public_case" })),
    ...agendaCases.map((record) => ({ ...record, sourceKind: "agenda_derived_case" })),
  ];
  const local = combined.filter((record) =>
    matchesCommunity(communityId, record.jurisdictionName, record.communityName, record.jurisdiction, Array.isArray(record.communityTags) ? record.communityTags.join(" ") : ""),
  );
  const statewide = combined.filter((record) =>
    isStatewideNevada(record.jurisdictionName, record.communityName, record.jurisdiction, Array.isArray(record.communityTags) ? record.communityTags.join(" ") : ""),
  );
  const candidates = local.length ? local : statewide.length ? statewide : combined;

  const items = filterItems(
    candidates.map((record) => {
      const sourceKind = asText(record.sourceKind);
      return {
        id: asText(record.id),
        title: asText(record.title),
        subtitle: `${asText(record.jurisdictionName) || asText(record.jurisdiction) || "Nevada"} · ${asText(record.stage) || asText(record.status) || "public record"}`,
        description: asText(record.summary) || asText(record.plain_language_summary),
        href: `/cases/${asText(record.id)}`,
        ctaLabel: "View case",
        avatar: { name: asText(record.title), entityType: sourceKind === "reviewed_public_case" ? ("case" as const) : ("publicAccountability" as const), verified: sourceKind === "reviewed_public_case" },
        badges: [
          { label: sourceKind === "reviewed_public_case" ? "Reviewed public case" : "Source-backed agenda case", tone: "emerald" as const },
          { label: asText(record.reviewStatus) || asText(record.review_status) || "needs review", tone: "slate" as const },
        ],
        facets: {
          status: facetValues(asText(record.reviewStatus) || asText(record.review_status) || asText(record.stage) || asText(record.status) || "needs review"),
          location: facetValues(record.jurisdictionName, record.communityName, record.jurisdiction, Array.isArray(record.communityTags) ? record.communityTags : []),
          source: facetValues(sourceKind === "reviewed_public_case" ? "Reviewed public case" : "Agenda-derived case"),
        },
        favorite: { targetType: "case" as const, targetId: asText(record.id) },
        sourceUrl: asText(record.sourceUrl) || asText(record.source_url),
      };
    }),
    query ?? "",
    favoriteIds,
    filters,
  ).slice(0, limit);

  return withEmptyReason(
    {
      category: "cases",
      items,
      sourceCount: combined.length,
      availableGeneratedCount: combined.length,
      lastGeneratedAt: reviewedRuntime.lastGeneratedAt ?? publicCaseRuntime.lastGeneratedAt,
      isSourceBacked: combined.length > 0,
      usesDemoData: false,
      fullHref: CATEGORY_HREFS.cases,
    },
    "No reviewed public cases or source-backed case leads are available for this community yet.",
  );
}

function buildEventsPreview({ communityId, query, limit = 8, favoriteIds, filters }: BrowsePreviewOptions): BrowsePreviewData {
  const runtime = readJsonFile<{ records?: Array<Record<string, unknown>>; generatedAt?: string }>("nevada-community-events.json", {});
  const records = recordsFrom<Record<string, unknown>>(runtime.data).filter((record) => asText(record.source_url) || asText(record.agenda_url));
  const local = records.filter((record) => matchesCommunity(communityId, record.community, record.jurisdiction, record.body_name));
  const statewide = records.filter((record) => isStatewideNevada(record.community, record.jurisdiction, record.body_name));
  const candidates = local.length ? local : statewide.length ? statewide : records;
  const now = Date.now();
  const ordered = [...candidates].sort((a, b) => {
    const aTime = Date.parse(asText(a.start_at));
    const bTime = Date.parse(asText(b.start_at));
    const aUpcoming = Number.isFinite(aTime) && aTime >= now;
    const bUpcoming = Number.isFinite(bTime) && bTime >= now;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });

  const items = filterItems(
    ordered.map((record) => {
      const status = eventStatusFromStartAt(record);
      return {
        id: asText(record.meeting_id) || asText(record.id),
        title: asText(record.title),
        subtitle: `${formatDate(record.start_at) ?? "Date pending"} · ${asText(record.jurisdiction) || "Nevada"}`,
        description: asText(record.summary),
        href: `/events/${asText(record.meeting_id) || asText(record.id)}`,
        ctaLabel: "View event",
        avatar: { name: asText(record.body_name), entityType: "agency" as const, verified: true },
        badges: [
          { label: status || "meeting", tone: status === "completed" ? ("slate" as const) : ("emerald" as const) },
          { label: "Source-backed", tone: "emerald" as const },
        ],
        facets: {
          status: facetValues(status || "unknown"),
          location: facetValues(record.community, record.jurisdiction),
          body: facetValues(record.body_name),
          level: facetValues(inferGovernmentLevel(record.body_name, record.jurisdiction)),
        },
        favorite: { targetType: "event" as const, targetId: asText(record.meeting_id) || asText(record.id) },
        sourceUrl: asText(record.source_url) || asText(record.agenda_url),
      };
    }),
    query ?? "",
    favoriteIds,
    filters,
  ).slice(0, limit);

  return withEmptyReason(
    {
      category: "events",
      items,
      sourceCount: records.length,
      availableGeneratedCount: records.length,
      lastGeneratedAt: runtime.lastGeneratedAt,
      isSourceBacked: records.length > 0,
      usesDemoData: false,
      fullHref: CATEGORY_HREFS.events,
    },
    "No public meeting or civic event records are available for this community yet.",
  );
}

function buildOfficialsPreview({ communityId, query, limit = 8, favoriteIds, filters }: BrowsePreviewOptions): BrowsePreviewData {
  const runtime = readJsonFile<{ records?: Array<Record<string, unknown>>; generatedAt?: string }>("nevada-community-officials.json", {});
  const records = recordsFrom<Record<string, unknown>>(runtime.data).filter((record) => asText(record.name) && asText(record.source_url));
  const local = records.filter((record) => matchesCommunity(communityId, record.communityName, record.jurisdiction, record.body_name));
  const statewide = records.filter((record) => isStatewideNevada(record.communityName, record.jurisdiction, record.body_name));
  const candidates = local.length ? local : statewide.length ? statewide : records;

  const items = filterItems(
    candidates.map((record) => ({
      id: asText(record.id),
      title: asText(record.name),
      subtitle: `${asText(record.title) || asText(record.office) || "Officeholder"} · ${asText(record.jurisdiction) || "Nevada"}`,
      description: asText(record.office) || asText(record.source_label),
      href: `/officials/${asText(record.id)}`,
      ctaLabel: "View official",
      avatar: { name: asText(record.name), entityType: "official" as const, verified: true },
      badges: [
        { label: "Source-backed roster", tone: "emerald" as const },
        { label: asText(record.body_name) || asText(record.level) || "government body", tone: "civic" as const },
      ],
      facets: {
        level: facetValues(asText(record.level) || inferGovernmentLevel(record.title, record.office, record.body_name, record.jurisdiction)),
        office: facetValues(record.title, record.office),
        location: facetValues(record.communityName, record.jurisdiction, record.body_name),
        body: facetValues(record.body_name),
      },
      favorite: { targetType: "official" as const, targetId: asText(record.id) },
      sourceUrl: asText(record.source_url),
    })),
    query ?? "",
    favoriteIds,
    filters,
  ).slice(0, limit);

  return withEmptyReason(
    {
      category: "officials",
      items,
      sourceCount: records.length,
      availableGeneratedCount: records.length,
      lastGeneratedAt: runtime.lastGeneratedAt,
      isSourceBacked: records.length > 0,
      usesDemoData: false,
      fullHref: CATEGORY_HREFS.officials,
    },
    "No source-backed official roster entries are available for this community yet.",
  );
}

function buildOrganizationsPreview({ communityId, query, limit = 8, favoriteIds, filters }: BrowsePreviewOptions): BrowsePreviewData {
  const runtime = readJsonFile<Array<Record<string, unknown>>>("public-meeting-bodies.json", []);
  const records = recordsFrom<Record<string, unknown>>(runtime.data).filter((record) => asText(record.name) && (asText(record.source_url) || asText(record.website)));
  const local = records.filter((record) => matchesCommunity(communityId, record.jurisdiction, record.name));
  const statewide = records.filter((record) => isStatewideNevada(record.jurisdiction, record.name));
  const candidates = local.length ? local : statewide.length ? statewide : records;

  const items = filterItems(
    candidates.map((record) => ({
      id: asText(record.id),
      title: asText(record.name),
      subtitle: `${asText(record.jurisdiction) || "Nevada"} · ${asText(record.level) || "government body"}`,
      description: asText(record.notes) || "Government body with a source-backed public meeting record.",
      href: `/organizations/${asText(record.id)}`,
      ctaLabel: "View body",
      avatar: { name: asText(record.name), entityType: "organization" as const, verified: true },
      badges: [
        { label: "Government body", tone: "civic" as const },
        { label: "Source-backed", tone: "emerald" as const },
      ],
      facets: {
        level: facetValues(asText(record.level) || inferGovernmentLevel(record.name, record.jurisdiction)),
        location: facetValues(record.jurisdiction, record.name),
        type: facetValues("Government body"),
      },
      favorite: { targetType: "organization" as const, targetId: asText(record.id) },
      sourceUrl: asText(record.source_url) || asText(record.website),
    })),
    query ?? "",
    favoriteIds,
    filters,
  ).slice(0, limit);

  return withEmptyReason(
    {
      category: "organizations",
      items,
      sourceCount: records.length,
      availableGeneratedCount: records.length,
      lastGeneratedAt: runtime.lastGeneratedAt,
      isSourceBacked: records.length > 0,
      usesDemoData: false,
      fullHref: CATEGORY_HREFS.organizations,
    },
    "No source-backed civic or government organizations are available for this community yet.",
  );
}

function buildElectionsPreview({ communityId, query, limit = 8, favoriteIds, filters }: BrowsePreviewOptions): BrowsePreviewData {
  const relationships = readJsonFile<{ communities?: Record<string, { records?: { elections?: Array<Record<string, unknown>> } }>; generatedAt?: string }>(
    "nevada-community-relationships.json",
    {},
  );
  const candidateRecords = readJsonFile<Array<Record<string, unknown>>>("nv-sos-candidate-records.json", []);
  const relationshipRecords = Object.values(relationships.data.communities ?? {}).flatMap((community) => community.records?.elections ?? []);
  const selectedRecords = relationships.data.communities?.[communityId]?.records?.elections ?? [];
  const reviewedCandidateRecords = recordsFrom<Record<string, unknown>>(candidateRecords.data).filter((record) => record.unmatched !== true && asText(record.candidate_name));
  const candidates = selectedRecords.length ? selectedRecords : relationshipRecords;

  const items = filterItems(
    candidates.map((record) => ({
      id: asText(record.id),
      title: asText(record.storyHeadline) || asText(record.title) || "Nevada election source",
      subtitle: `${formatDate(record.date) ?? (asText(record.storyJurisdiction) || "Nevada")} · ${asText(record.storyJurisdiction) || "Nevada"}`,
      description: asText(record.storySummary) || asText(record.storySourceDetail),
      href: asText(record.href) || asText(record.sourceUrl),
      ctaLabel: asText(record.href) ? "View election" : "Source",
      avatar: { name: asText(record.title), entityType: "community" as const },
      badges: [
        { label: "Election source", tone: "emerald" as const },
        { label: asText(record.relationshipScope) || "statewide overlay", tone: "civic" as const },
      ],
      facets: {
        scope: facetValues(asText(record.relationshipScope) || "statewide overlay"),
        location: facetValues(record.storyJurisdiction, record.title),
      },
      favorite: { targetType: "election" as const, targetId: asText(record.id) },
      sourceUrl: asText(record.sourceUrl),
    })),
    query ?? "",
    favoriteIds,
    filters,
  ).slice(0, limit);

  return withEmptyReason(
    {
      category: "elections",
      items,
      sourceCount: relationshipRecords.length + reviewedCandidateRecords.length,
      availableGeneratedCount: relationshipRecords.length + recordsFrom<Record<string, unknown>>(candidateRecords.data).length,
      lastGeneratedAt: relationships.lastGeneratedAt ?? candidateRecords.lastGeneratedAt,
      isSourceBacked: relationshipRecords.length > 0 || reviewedCandidateRecords.length > 0,
      usesDemoData: false,
      fullHref: items.length ? CATEGORY_HREFS.elections : null,
    },
    "Nevada election source imports exist, but no reviewed local election preview is available for this community yet.",
  );
}

async function buildCandidatesPreview({ query, limit = 8, favoriteIds, filters }: BrowsePreviewOptions): Promise<BrowsePreviewData> {
  const importedCandidates = await getImportedCandidatePreviewRows().catch((error) => {
    console.warn("[browse-preview] imported candidate lookup failed", error);
    return [];
  });

  if (importedCandidates.length) {
    const items = filterItems(
      importedCandidates.map((candidate) => {
        const displayName = formatCandidateName(candidate.ballotName ?? candidate.fullName);
        const sourceUrl = candidate.sourceUrl ?? candidate.source?.url ?? null;

        return {
          id: candidate.id,
          title: displayName,
          subtitle: `${candidate.office?.title ?? "Office pending"} · ${candidate.jurisdiction.name}`,
          description:
            candidate.campaignStatement ??
            "Imported source-backed Nevada candidate record. Additional profile enrichment may still be pending.",
          href: `/candidates/${candidate.id}`,
          ctaLabel: "View candidate",
          avatar: { name: displayName, imageUrl: candidate.photoUrl, entityType: "candidate" as const, verified: true },
          badges: [
            { label: "Source-backed candidate", tone: "emerald" as const },
            { label: candidate.partyText ?? "Party pending", tone: "civic" as const },
          ],
          facets: {
            party: facetValues(candidate.partyText ?? "Party pending"),
            office: facetValues(candidate.office?.title ?? "Office pending"),
            level: facetValues(inferGovernmentLevel(candidate.office?.title, candidate.jurisdiction.name)),
            location: facetValues(candidate.jurisdiction.name),
          },
          favorite: { targetType: "candidate" as const, targetId: candidate.id },
          sourceUrl,
        };
      }),
      query ?? "",
      favoriteIds,
      filters,
    ).slice(0, limit);

    return withEmptyReason(
      {
        category: "candidates",
        items,
        sourceCount: importedCandidates.length,
        availableGeneratedCount: importedCandidates.length,
        lastGeneratedAt: null,
        isSourceBacked: true,
        usesDemoData: false,
        fullHref: "/candidates",
      },
      "Imported Nevada candidate records exist, but no candidate preview matched this browse context.",
    );
  }

  const runtime = readJsonFile<Array<Record<string, unknown>>>("nv-sos-candidate-records.json", []);
  const records = recordsFrom<Record<string, unknown>>(runtime.data);
  const reviewed = records.filter((record) => record.unmatched !== true && asText(record.candidate_name) && asText(record.source_url));
  const items = filterItems(
    reviewed.map((record) => ({
      id: `nvsos-candidate-${asText(record.candidate_name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: asText(record.candidate_name),
      subtitle: `${asText(record.office) || "Office pending"} · ${asText(record.jurisdiction) || "Nevada"}`,
      description: "Source-backed Nevada candidate filing record.",
      href: asText(record.source_url),
      ctaLabel: "Source",
      avatar: { name: asText(record.candidate_name), entityType: "candidate" as const, verified: true },
      badges: [{ label: "Source-backed filing", tone: "emerald" as const }],
      facets: {
        party: facetValues(record.party, record.partyText, record.party_text),
        office: facetValues(record.office),
        level: facetValues(inferGovernmentLevel(record.office, record.jurisdiction)),
        location: facetValues(record.jurisdiction),
      },
      favorite: { targetType: "candidate" as const, targetId: `nvsos-candidate-${asText(record.candidate_name)}` },
      sourceUrl: asText(record.source_url),
    })),
    query ?? "",
    favoriteIds,
    filters,
  ).slice(0, limit);

  return withEmptyReason(
    {
      category: "candidates",
      items,
      sourceCount: reviewed.length,
      availableGeneratedCount: records.length,
      lastGeneratedAt: runtime.lastGeneratedAt,
      isSourceBacked: reviewed.length > 0,
      usesDemoData: false,
      fullHref: null,
    },
    "Candidate source imports exist, but no reviewed candidate profiles are ready for production browse previews yet.",
  );
}

function buildEmptySourcePreview(category: BrowsePreviewCategory, emptyReason: string): BrowsePreviewData {
  return {
    category,
    items: [],
    sourceCount: 0,
    availableGeneratedCount: 0,
    lastGeneratedAt: null,
    isSourceBacked: false,
    emptyReason,
    usesDemoData: false,
    fullHref: null,
    statusLabel: "Limited data",
  };
}

export async function getBrowsePreviewCategory(options: BrowsePreviewOptions): Promise<BrowsePreviewData> {
  switch (options.category) {
    case "communities":
      return buildCommunitiesPreview(options);
    case "issues":
      return buildIssuesPreview(options);
    case "people":
      return await buildPeoplePreview(options);
    case "candidates":
      return await buildCandidatesPreview(options);
    case "officials":
      return buildOfficialsPreview(options);
    case "petitions":
      return buildEmptySourcePreview("petitions", "No reviewed public petitions are available for this community yet.");
    case "cases":
      return buildCasesPreview(options);
    case "events":
      return buildEventsPreview(options);
    case "elections":
      return buildElectionsPreview(options);
    case "ads":
      return buildEmptySourcePreview("ads", "No reviewed political ad repository records are available for production browse previews yet.");
    case "organizations":
      return buildOrganizationsPreview(options);
  }
}

export async function getBrowsePreviewData(options: Omit<BrowsePreviewOptions, "category">) {
  const categories: BrowsePreviewCategory[] = [
    "communities",
    "issues",
    "people",
    "candidates",
    "officials",
    "petitions",
    "cases",
    "events",
    "elections",
    "ads",
    "organizations",
  ];

  const entries = await Promise.all(categories.map(async (category) => [category, await getBrowsePreviewCategory({ ...options, category })] as const));
  return Object.fromEntries(entries) as Record<
    BrowsePreviewCategory,
    BrowsePreviewData
  >;
}
