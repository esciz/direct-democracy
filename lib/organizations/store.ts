import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import { getAllCommunityEvents } from "@/lib/community/events";
import { getCommunityById } from "@/lib/community/communities";
import { getDebatesForUser } from "@/lib/debates/store";
import { canonicalizeIssueTags } from "@/lib/issues/utils";
import { getAllCandidateCampaigns, getCandidateProfiles } from "@/lib/server/elections-context";
import { getAllPetitions } from "@/lib/petitions/store";
import { getUserProfileContent } from "@/lib/profile/details";
import type {
  AuthUser,
  CommunityEventSummary,
  DebateSummary,
  OrganizationAnnouncementSummary,
  OrganizationCreationRequestSummary,
  OrganizationDetail,
  OrganizationEndorsementSummary,
  OrganizationMembershipRole,
  OrganizationMembershipState,
  OrganizationMembershipSummary,
  OrganizationPlatformItemStatus,
  OrganizationPlatformItemSummary,
  OrganizationSummary,
  OrganizationType,
  OrganizationVoteChoice,
  OrganizationVoteSummary,
  PetitionSummary,
} from "@/types/domain";

const ORGANIZATIONS_COOKIE = "dd_organizations";
const ORGANIZATION_MEMBERSHIPS_COOKIE = "dd_organization_memberships";
const ORGANIZATION_ANNOUNCEMENTS_COOKIE = "dd_organization_announcements";
const ORGANIZATION_PLATFORM_ITEMS_COOKIE = "dd_organization_platform_items";
const ORGANIZATION_VOTES_COOKIE = "dd_organization_votes";
const ORGANIZATION_ENDORSEMENTS_COOKIE = "dd_organization_endorsements";
const ORGANIZATION_CREATION_REQUESTS_COOKIE = "dd_organization_creation_requests";

type SeedOrganization = {
  id: string;
  name: string;
  slug: string;
  description: string;
  organizationType: OrganizationType;
  communityId: string;
  campusCommunityId?: string | null;
  jurisdictionName: string;
  founderUserId: string;
  issueTags: string[];
  linkedEventIds: string[];
  linkedDebateIds: string[];
  linkedPetitionIds: string[];
  createdAt: string;
};

export type OrganizationPreviewSummary = {
  id: string;
  name: string;
  description: string;
  organizationType: OrganizationType;
  jurisdictionName: string;
  issueTags: string[];
  memberCount: number;
};

const seededOrganizations: SeedOrganization[] = [
  {
    id: "org_unr_student_transit_alliance",
    name: "UNR Student Transit Alliance",
    slug: "unr-student-transit-alliance",
    description: "A campus org organizing around late-night transit, campus access, and safer connections between housing and the university.",
    organizationType: "campus_org",
    communityId: "unr-campus",
    campusCommunityId: "unr-campus",
    jurisdictionName: "University of Nevada, Reno",
    founderUserId: "user_citizen_tiana_moore",
    issueTags: ["Late-night transit", "Campus housing", "Public safety"],
    linkedEventIds: ["event_unr_student_transit_forum"],
    linkedDebateIds: [],
    linkedPetitionIds: [],
    createdAt: "2026-03-20T18:00:00.000Z",
  },
  {
    id: "org_unr_civic_media_collective",
    name: "UNR Civic Media Collective",
    slug: "unr-civic-media-collective",
    description: "Student journalists and civic tech volunteers helping campus communities track elections, debates, and public decisions more clearly.",
    organizationType: "campus_org",
    communityId: "unr-campus",
    campusCommunityId: "unr-campus",
    jurisdictionName: "University of Nevada, Reno",
    founderUserId: "user_candidate_noah_brooks",
    issueTags: ["Student budgets", "Government transparency", "Campus accountability"],
    linkedEventIds: ["event_unr_campus_night_market"],
    linkedDebateIds: [],
    linkedPetitionIds: [],
    createdAt: "2026-03-21T18:00:00.000Z",
  },
  {
    id: "org_carson_budget_transparency_coalition",
    name: "Carson Budget Transparency Coalition",
    slug: "carson-budget-transparency-coalition",
    description: "A local coalition focused on budget clarity, public records, and easier-to-follow city decisions.",
    organizationType: "coalition",
    communityId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    founderUserId: "user_trusted_citizen_marco_silva",
    issueTags: ["Budget clarity", "Government transparency", "Public meeting access"],
    linkedEventIds: ["event_carson_budget_forum"],
    linkedDebateIds: ["debate_carson_teacher_support"],
    linkedPetitionIds: ["petition_carson_meeting_archives"],
    createdAt: "2026-03-18T18:00:00.000Z",
  },
  {
    id: "org_nevada_housing_action_coalition",
    name: "Nevada Housing Action Coalition",
    slug: "nevada-housing-action-coalition",
    description: "A statewide coalition organizing around affordability, zoning reform, and clearer public housing tradeoffs.",
    organizationType: "coalition",
    communityId: "nevada",
    jurisdictionName: "Nevada",
    founderUserId: "user_trusted_citizen_hannah_cho",
    issueTags: ["Housing affordability", "Zoning / permits", "Taxes / cost of living"],
    linkedEventIds: ["event_washoe_growth_meeting"],
    linkedDebateIds: ["debate_nevada_cost_groups"],
    linkedPetitionIds: ["petition_north_valley_zoning"],
    createdAt: "2026-03-17T18:00:00.000Z",
  },
];

const seededMemberships: OrganizationMembershipSummary[] = [
  {
    id: "org_member_tiana_transit_founder",
    organizationId: "org_unr_student_transit_alliance",
    userId: "user_citizen_tiana_moore",
    userName: "Tiana Moore",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-20T18:00:00.000Z",
  },
  {
    id: "org_member_jasmine_transit_admin",
    organizationId: "org_unr_student_transit_alliance",
    userId: "user_candidate_jasmine_kim",
    userName: "Jasmine Kim",
    role: "admin",
    state: "approved",
    createdAt: "2026-03-22T18:00:00.000Z",
  },
  {
    id: "org_member_noah_media_founder",
    organizationId: "org_unr_civic_media_collective",
    userId: "user_candidate_noah_brooks",
    userName: "Noah Brooks",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-21T18:00:00.000Z",
  },
  {
    id: "org_member_tiana_media_member",
    organizationId: "org_unr_civic_media_collective",
    userId: "user_citizen_tiana_moore",
    userName: "Tiana Moore",
    role: "member",
    state: "approved",
    createdAt: "2026-03-22T18:00:00.000Z",
  },
  {
    id: "org_member_marco_budget_founder",
    organizationId: "org_carson_budget_transparency_coalition",
    userId: "user_trusted_citizen_marco_silva",
    userName: "Marco Silva",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-18T18:00:00.000Z",
  },
  {
    id: "org_member_alicia_budget_member",
    organizationId: "org_carson_budget_transparency_coalition",
    userId: "user_citizen_alicia_hart",
    userName: "Alicia Hart",
    role: "member",
    state: "approved",
    createdAt: "2026-03-19T18:00:00.000Z",
  },
  {
    id: "org_member_hannah_housing_founder",
    organizationId: "org_nevada_housing_action_coalition",
    userId: "user_trusted_citizen_hannah_cho",
    userName: "Hannah Cho",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-17T18:00:00.000Z",
  },
  {
    id: "org_member_miles_housing_member",
    organizationId: "org_nevada_housing_action_coalition",
    userId: "user_citizen_miles_reed",
    userName: "Miles Reed",
    role: "member",
    state: "approved",
    createdAt: "2026-03-18T18:00:00.000Z",
  },
];

const seededAnnouncements: OrganizationAnnouncementSummary[] = [
  {
    id: "org_announce_transit_1",
    organizationId: "org_unr_student_transit_alliance",
    title: "Transit forum turnout push",
    body: "We are asking members to RSVP and bring one student commuter concern to the transit forum this week.",
    createdByUserId: "user_citizen_tiana_moore",
    createdByUserName: "Tiana Moore",
    createdAt: "2026-04-05T17:30:00.000Z",
  },
  {
    id: "org_announce_budget_1",
    organizationId: "org_carson_budget_transparency_coalition",
    title: "Budget notes and action recap",
    body: "The coalition posted a plain-language recap of the budget meeting and is collecting follow-up questions for the next session.",
    createdByUserId: "user_trusted_citizen_marco_silva",
    createdByUserName: "Marco Silva",
    createdAt: "2026-04-04T17:30:00.000Z",
  },
];

const seededPlatformItems: Array<Omit<OrganizationPlatformItemSummary, "supportCount" | "opposeCount" | "viewerVote">> = [
  {
    id: "org_platform_transit_tracker",
    organizationId: "org_unr_student_transit_alliance",
    title: "Publish a late-night transit tracker",
    description: "Ask the university and city to maintain a shared dashboard for shuttle gaps, wait times, and housing corridor service.",
    issueTag: "Late-night transit",
    status: "active",
    createdByUserId: "user_citizen_tiana_moore",
    createdByUserName: "Tiana Moore",
    createdAt: "2026-04-02T16:00:00.000Z",
  },
  {
    id: "org_platform_budget_archives",
    organizationId: "org_carson_budget_transparency_coalition",
    title: "Support searchable budget archives",
    description: "Push for budget packets, amendments, and summaries to be searchable in one public location.",
    issueTag: "Budget clarity",
    status: "adopted",
    createdByUserId: "user_trusted_citizen_marco_silva",
    createdByUserName: "Marco Silva",
    createdAt: "2026-04-01T16:00:00.000Z",
  },
  {
    id: "org_platform_housing_plain_language",
    organizationId: "org_nevada_housing_action_coalition",
    title: "Publish plain-language housing tradeoff briefs",
    description: "Release short coalition-backed briefs that explain housing proposals in practical terms for renters, homeowners, and students.",
    issueTag: "Housing affordability",
    status: "active",
    createdByUserId: "user_trusted_citizen_hannah_cho",
    createdByUserName: "Hannah Cho",
    createdAt: "2026-04-03T16:00:00.000Z",
  },
];

const seededVotes: OrganizationVoteSummary[] = [
  {
    id: "org_vote_transit_tiana",
    organizationId: "org_unr_student_transit_alliance",
    platformItemId: "org_platform_transit_tracker",
    userId: "user_citizen_tiana_moore",
    choice: "support",
    createdAt: "2026-04-02T18:00:00.000Z",
  },
  {
    id: "org_vote_transit_jasmine",
    organizationId: "org_unr_student_transit_alliance",
    platformItemId: "org_platform_transit_tracker",
    userId: "user_candidate_jasmine_kim",
    choice: "support",
    createdAt: "2026-04-02T18:10:00.000Z",
  },
  {
    id: "org_vote_budget_marco",
    organizationId: "org_carson_budget_transparency_coalition",
    platformItemId: "org_platform_budget_archives",
    userId: "user_trusted_citizen_marco_silva",
    choice: "support",
    createdAt: "2026-04-01T18:00:00.000Z",
  },
  {
    id: "org_vote_budget_alicia",
    organizationId: "org_carson_budget_transparency_coalition",
    platformItemId: "org_platform_budget_archives",
    userId: "user_citizen_alicia_hart",
    choice: "support",
    createdAt: "2026-04-01T18:05:00.000Z",
  },
];

const seededEndorsements: OrganizationEndorsementSummary[] = [
  {
    id: "org_endorse_jasmine",
    organizationId: "org_unr_student_transit_alliance",
    organizationName: "UNR Student Transit Alliance",
    organizationType: "campus_org",
    candidateCampaignId: "campaign_jasmine_unr_2026",
    electionId: "election_unr_student_government_2026",
    electionTitle: "UNR Student Government Community Vote",
    candidateName: "Jasmine Kim",
    officeSought: "Student Body President",
    statement: "Backed for a stronger transit and commuter focus.",
    isActive: true,
    createdAt: "2026-04-03T18:00:00.000Z",
  },
  {
    id: "org_endorse_elena",
    organizationId: "org_carson_budget_transparency_coalition",
    organizationName: "Carson Budget Transparency Coalition",
    organizationType: "coalition",
    candidateCampaignId: "campaign_elena_2026",
    electionId: "election_carson_mayor_2026",
    electionTitle: "Carson City Mayor Election",
    candidateName: "Elena Ramirez",
    officeSought: "Mayor",
    statement: "Endorsed for budget transparency follow-through and meeting archive commitments.",
    isActive: true,
    createdAt: "2026-04-04T18:00:00.000Z",
  },
];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isOrganizationType(value: unknown): value is OrganizationType {
  return value === "campus_org" || value === "coalition";
}

function isOrganizationMembershipRole(value: unknown): value is OrganizationMembershipRole {
  return value === "founder" || value === "admin" || value === "member";
}

function isOrganizationMembershipState(value: unknown): value is OrganizationMembershipState {
  return value === "pending" || value === "approved" || value === "declined";
}

function isOrganizationVoteChoice(value: unknown): value is OrganizationVoteChoice {
  return value === "support" || value === "oppose";
}

function isPlatformItemStatus(value: unknown): value is OrganizationPlatformItemStatus {
  return value === "draft" || value === "active" || value === "adopted";
}

function isOrganizationSeed(value: unknown): value is SeedOrganization {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    typeof value.description === "string" &&
    isOrganizationType(value.organizationType) &&
    typeof value.communityId === "string" &&
    typeof value.jurisdictionName === "string" &&
    typeof value.founderUserId === "string" &&
    Array.isArray(value.issueTags) &&
    Array.isArray(value.linkedEventIds) &&
    Array.isArray(value.linkedDebateIds) &&
    Array.isArray(value.linkedPetitionIds) &&
    typeof value.createdAt === "string"
  );
}

function isMembership(value: unknown): value is OrganizationMembershipSummary {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.userId === "string" &&
    typeof value.userName === "string" &&
    isOrganizationMembershipRole(value.role) &&
    isOrganizationMembershipState(value.state) &&
    typeof value.createdAt === "string"
  );
}

function isAnnouncement(value: unknown): value is OrganizationAnnouncementSummary {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    typeof value.createdByUserId === "string" &&
    typeof value.createdByUserName === "string" &&
    typeof value.createdAt === "string"
  );
}

function isPlatformItemSeed(value: unknown): value is Omit<OrganizationPlatformItemSummary, "supportCount" | "opposeCount" | "viewerVote"> {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.issueTag === "string" &&
    isPlatformItemStatus(value.status) &&
    typeof value.createdByUserId === "string" &&
    typeof value.createdByUserName === "string" &&
    typeof value.createdAt === "string"
  );
}

function isVote(value: unknown): value is OrganizationVoteSummary {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.platformItemId === "string" &&
    typeof value.userId === "string" &&
    isOrganizationVoteChoice(value.choice) &&
    typeof value.createdAt === "string"
  );
}

function isEndorsement(value: unknown): value is OrganizationEndorsementSummary {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.organizationId === "string" &&
    typeof value.organizationName === "string" &&
    isOrganizationType(value.organizationType) &&
    typeof value.candidateCampaignId === "string" &&
    typeof value.electionId === "string" &&
    typeof value.electionTitle === "string" &&
    typeof value.candidateName === "string" &&
    typeof value.officeSought === "string" &&
    typeof value.isActive === "boolean" &&
    typeof value.createdAt === "string"
  );
}

function isCreationRequest(value: unknown): value is OrganizationCreationRequestSummary {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    isOrganizationType(value.organizationType) &&
    typeof value.name === "string" &&
    typeof value.description === "string" &&
    typeof value.communityId === "string" &&
    typeof value.requestedByUserId === "string" &&
    typeof value.requestedByUserName === "string" &&
    Array.isArray(value.issueTags) &&
    typeof value.createdAt === "string"
  );
}

async function readCookieArray<T>(cookieName: string, guard: (value: unknown) => value is T): Promise<T[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(cookieName)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

async function writeCookieArray<T>(cookieName: string, items: T[]) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, JSON.stringify(items), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getStoredOrganizations() {
  return readCookieArray(ORGANIZATIONS_COOKIE, isOrganizationSeed);
}

export async function setStoredOrganizations(items: SeedOrganization[]) {
  await writeCookieArray(ORGANIZATIONS_COOKIE, items.slice(0, 50));
}

export async function getStoredOrganizationMemberships() {
  return readCookieArray(ORGANIZATION_MEMBERSHIPS_COOKIE, isMembership);
}

export async function setStoredOrganizationMemberships(items: OrganizationMembershipSummary[]) {
  await writeCookieArray(ORGANIZATION_MEMBERSHIPS_COOKIE, items.slice(0, 500));
}

export async function getStoredOrganizationAnnouncements() {
  return readCookieArray(ORGANIZATION_ANNOUNCEMENTS_COOKIE, isAnnouncement);
}

export async function setStoredOrganizationAnnouncements(items: OrganizationAnnouncementSummary[]) {
  await writeCookieArray(ORGANIZATION_ANNOUNCEMENTS_COOKIE, items.slice(0, 300));
}

export async function getStoredOrganizationPlatformItems() {
  return readCookieArray(ORGANIZATION_PLATFORM_ITEMS_COOKIE, isPlatformItemSeed);
}

export async function setStoredOrganizationPlatformItems(items: Array<Omit<OrganizationPlatformItemSummary, "supportCount" | "opposeCount" | "viewerVote">>) {
  await writeCookieArray(ORGANIZATION_PLATFORM_ITEMS_COOKIE, items.slice(0, 300));
}

export async function getStoredOrganizationVotes() {
  return readCookieArray(ORGANIZATION_VOTES_COOKIE, isVote);
}

export async function setStoredOrganizationVotes(items: OrganizationVoteSummary[]) {
  await writeCookieArray(ORGANIZATION_VOTES_COOKIE, items.slice(0, 1000));
}

export async function getStoredOrganizationEndorsements() {
  return readCookieArray(ORGANIZATION_ENDORSEMENTS_COOKIE, isEndorsement);
}

export async function setStoredOrganizationEndorsements(items: OrganizationEndorsementSummary[]) {
  await writeCookieArray(ORGANIZATION_ENDORSEMENTS_COOKIE, items.slice(0, 300));
}

export async function getStoredOrganizationCreationRequests() {
  return readCookieArray(ORGANIZATION_CREATION_REQUESTS_COOKIE, isCreationRequest);
}

export async function setStoredOrganizationCreationRequests(items: OrganizationCreationRequestSummary[]) {
  await writeCookieArray(ORGANIZATION_CREATION_REQUESTS_COOKIE, items.slice(0, 200));
}

export async function getAllOrganizationSeeds() {
  const stored = await getStoredOrganizations();
  const merged = new Map<string, SeedOrganization>();

  for (const organization of seededOrganizations) {
    merged.set(organization.id, organization);
  }

  for (const organization of stored) {
    merged.set(organization.id, organization);
  }

  return [...merged.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getAllOrganizationMemberships() {
  const stored = await getStoredOrganizationMemberships();
  const merged = new Map<string, OrganizationMembershipSummary>();

  for (const membership of seededMemberships) {
    merged.set(membership.id, membership);
  }

  for (const membership of stored) {
    merged.set(membership.id, membership);
  }

  return [...merged.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function getAllOrganizationAnnouncements() {
  const stored = await getStoredOrganizationAnnouncements();
  const merged = new Map<string, OrganizationAnnouncementSummary>();

  for (const entry of seededAnnouncements) {
    merged.set(entry.id, entry);
  }

  for (const entry of stored) {
    merged.set(entry.id, entry);
  }

  return [...merged.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getAllOrganizationPlatformItems() {
  const [items, votes] = await Promise.all([getStoredOrganizationPlatformItems(), getAllOrganizationVotes()]);
  const merged = new Map<string, Omit<OrganizationPlatformItemSummary, "supportCount" | "opposeCount" | "viewerVote">>();

  for (const entry of seededPlatformItems) {
    merged.set(entry.id, entry);
  }

  for (const entry of items) {
    merged.set(entry.id, entry);
  }

  return [...merged.values()]
    .map((entry) => ({
      ...entry,
      supportCount: votes.filter((vote) => vote.platformItemId === entry.id && vote.choice === "support").length,
      opposeCount: votes.filter((vote) => vote.platformItemId === entry.id && vote.choice === "oppose").length,
      viewerVote: null,
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function getAllOrganizationVotes() {
  const stored = await getStoredOrganizationVotes();
  const merged = new Map<string, OrganizationVoteSummary>();

  for (const vote of seededVotes) {
    merged.set(`${vote.platformItemId}:${vote.userId}`, vote);
  }

  for (const vote of stored) {
    merged.set(`${vote.platformItemId}:${vote.userId}`, vote);
  }

  return [...merged.values()];
}

export async function getAllOrganizationEndorsements() {
  const stored = await getStoredOrganizationEndorsements();
  const merged = new Map<string, OrganizationEndorsementSummary>();

  for (const endorsement of seededEndorsements) {
    merged.set(endorsement.id, endorsement);
  }

  for (const endorsement of stored) {
    merged.set(endorsement.id, endorsement);
  }

  return [...merged.values()].filter((entry) => entry.isActive).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function getSeedUserName(userId: string) {
  return seedUsers.find((user) => user.id === userId)?.name ?? "Community member";
}

function getOrganizationMembershipRole(
  userId: string | undefined,
  organizationId: string,
  memberships: OrganizationMembershipSummary[],
) {
  if (!userId) {
    return { role: null, state: null } as const;
  }

  const membership = memberships.find((entry) => entry.organizationId === organizationId && entry.userId === userId);

  return {
    role: membership?.state === "approved" ? membership.role : null,
    state: membership?.state ?? null,
  } as const;
}

export function isStudentVerifiedForCampusOrg(user: Pick<AuthUser, "studentVerified" | "studentModeEnabled" | "studentCampusCommunityId" | "campusCommunityIds">, campusCommunityId: string) {
  if (!user.studentModeEnabled || !user.studentVerified) {
    return false;
  }

  return user.studentCampusCommunityId === campusCommunityId || user.campusCommunityIds?.includes(campusCommunityId);
}

export function canUserCreateCampusOrg(user: AuthUser, campusCommunityId: string) {
  return isStudentVerifiedForCampusOrg(user, campusCommunityId);
}

export function canUserDirectlyCreateCoalition(user: AuthUser) {
  return user.role === "trustedCitizen" || user.role === "admin";
}

export function canUserRequestCoalition(user: AuthUser) {
  return user.role === "citizen" || user.role === "trustedCitizen" || user.role === "admin";
}

export async function getAllOrganizations(viewer?: AuthUser): Promise<OrganizationSummary[]> {
  const [organizations, memberships, announcements, platformItems, endorsements] = await Promise.all([
    getAllOrganizationSeeds(),
    getAllOrganizationMemberships(),
    getAllOrganizationAnnouncements(),
    getAllOrganizationPlatformItems(),
    getAllOrganizationEndorsements(),
  ]);

  return organizations.map((organization) => {
    const approvedMemberships = memberships.filter(
      (entry) => entry.organizationId === organization.id && entry.state === "approved",
    );
    const admins = approvedMemberships.filter((entry) => entry.role === "founder" || entry.role === "admin");
    const viewerMembership = getOrganizationMembershipRole(viewer?.id, organization.id, memberships);

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      organizationType: organization.organizationType,
      communityId: organization.communityId,
      campusCommunityId: organization.campusCommunityId ?? null,
      jurisdictionName: organization.jurisdictionName,
      issueTags: canonicalizeIssueTags(organization.issueTags),
      founderUserId: organization.founderUserId,
      founderName: getSeedUserName(organization.founderUserId),
      adminUserIds: admins.map((entry) => entry.userId),
      adminNames: admins.map((entry) => entry.userName),
      memberCount: approvedMemberships.length,
      viewerMembershipRole: viewerMembership.role,
      viewerMembershipState: viewerMembership.state,
      canManage: Boolean(viewerMembership.role && (viewerMembership.role === "founder" || viewerMembership.role === "admin")),
      platformItemCount: platformItems.filter((item) => item.organizationId === organization.id).length,
      endorsementCount: endorsements.filter((item) => item.organizationId === organization.id).length,
      announcementCount: announcements.filter((item) => item.organizationId === organization.id).length,
      createdAt: organization.createdAt,
    } satisfies OrganizationSummary;
  });
}

export async function getOrganizationById(orgId: string, viewer: AuthUser): Promise<OrganizationDetail | null> {
  const [organizations, memberships, announcements, allPlatformItems, allVotes, endorsements, events, petitions, debates] = await Promise.all([
    getAllOrganizations(viewer),
    getAllOrganizationMemberships(),
    getAllOrganizationAnnouncements(),
    getAllOrganizationPlatformItems(),
    getAllOrganizationVotes(),
    getAllOrganizationEndorsements(),
    getAllCommunityEvents(),
    getAllPetitions(),
    getDebatesForUser(viewer, { status: "all" }),
  ]);
  const rawOrganizations = await getAllOrganizationSeeds();

  const organization = organizations.find((entry) => entry.id === orgId);
  const rawOrganization = rawOrganizations.find((entry) => entry.id === orgId);

  if (!organization || !rawOrganization) {
    return null;
  }

  const platformItems = allPlatformItems
    .filter((entry) => entry.organizationId === orgId)
    .map((entry) => ({
      ...entry,
      viewerVote: allVotes.find((vote) => vote.platformItemId === entry.id && vote.userId === viewer.id)?.choice ?? null,
    }));

  const relatedEvents = events.filter((event) => event.organizationId === orgId || rawOrganization.linkedEventIds.includes(event.id));
  const relatedPetitions = petitions.filter((petition) => petition.organizationId === orgId || rawOrganization.linkedPetitionIds.includes(petition.id));
  const relatedDebates = debates.filter((debate) => rawOrganization.linkedDebateIds.includes(debate.id));

  return {
    ...organization,
    announcements: announcements.filter((entry) => entry.organizationId === orgId),
    platformItems,
    memberships: memberships.filter((entry) => entry.organizationId === orgId),
    endorsements: endorsements.filter((entry) => entry.organizationId === orgId),
    relatedEvents,
    relatedDebates,
    relatedPetitions,
  };
}

export async function getOrganizationEndorsementsForCampaign(candidateCampaignId: string) {
  const endorsements = await getAllOrganizationEndorsements();
  return endorsements.filter((entry) => entry.candidateCampaignId === candidateCampaignId);
}

export async function getOrganizationsForCommunity(viewer: AuthUser, communityId: string, issueTag?: string) {
  const organizations = await getAllOrganizations(viewer);

  return organizations
    .filter((entry) => entry.communityId === communityId || entry.campusCommunityId === communityId)
    .filter((entry) => (issueTag ? entry.issueTags.some((tag) => tag.toLowerCase().includes(issueTag.toLowerCase())) : true))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 6);
}

export function getOrganizationPreviewsForCommunity(communityId: string, limit = 4): OrganizationPreviewSummary[] {
  return seededOrganizations
    .filter((entry) => entry.communityId === communityId || entry.campusCommunityId === communityId)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      organizationType: entry.organizationType,
      jurisdictionName: entry.jurisdictionName,
      issueTags: canonicalizeIssueTags(entry.issueTags),
      memberCount: seededMemberships.filter(
        (membership) => membership.organizationId === entry.id && membership.state === "approved",
      ).length,
    }))
    .sort((a, b) => b.memberCount - a.memberCount || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function getRecommendedOrganizationsForUser(user: AuthUser, communityId?: string) {
  const [organizations, profile] = await Promise.all([getAllOrganizations(user), getUserProfileContent(user.id)]);
  const interests = new Set([
    ...profile.localIssues.map((entry) => entry.value.toLowerCase()),
    ...profile.stateIssues.map((entry) => entry.value.toLowerCase()),
    ...profile.groupTags.map((entry) => entry.value.toLowerCase()),
  ]);

  return organizations
    .filter((organization) => organization.viewerMembershipState !== "approved")
    .filter((organization) => (communityId ? organization.communityId === communityId || organization.campusCommunityId === communityId : true))
    .map((organization) => ({
      organization,
      score:
        (organization.communityId === user.primaryCommunityId ? 3 : 0) +
        (organization.campusCommunityId && user.campusCommunityIds?.includes(organization.campusCommunityId) ? 4 : 0) +
        canonicalizeIssueTags(organization.issueTags).filter((tag) =>
          [...interests].some((entry) => tag.toLowerCase().includes(entry) || entry.includes(tag.toLowerCase())),
        ).length,
    }))
    .sort((a, b) => b.score - a.score || b.organization.memberCount - a.organization.memberCount)
    .map((entry) => entry.organization)
    .slice(0, 4);
}

export async function getOrganizationCreationRequests() {
  return getStoredOrganizationCreationRequests();
}

export async function getOrganizationCampaignOptions(organizationId: string) {
  const [organization, campaigns, candidates] = await Promise.all([getAllOrganizationSeeds(), getAllCandidateCampaigns(), getCandidateProfiles()]);
  const targetOrg = organization.find((entry) => entry.id === organizationId);

  if (!targetOrg) {
    return [];
  }

  return campaigns
    .filter((campaign) => campaign.jurisdictionName === targetOrg.jurisdictionName || targetOrg.communityId === "nevada")
    .map((campaign) => ({
      ...campaign,
      candidateName: candidates.find((candidate) => candidate.id === campaign.publicProfileId)?.name ?? campaign.publicProfileId,
    }));
}
