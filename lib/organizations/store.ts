import { cookies } from "next/headers";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { seedUsers } from "@/lib/auth/mock-users";
import { getAllCommunityEvents } from "@/lib/community/events";
import { getCommunityById, seededCommunities } from "@/lib/community/communities";
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
const GENERATED_DATA_ROOT = path.join(process.cwd(), "data", "generated");

type SeedOrganization = {
  id: string;
  name: string;
  slug: string;
  description: string;
  organizationType: OrganizationType;
  communityId: string;
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

type PublicMeetingBodyRecord = {
  id?: string;
  name?: string;
  jurisdiction?: string;
  level?: string;
  website?: string;
  source_url?: string;
  meeting_index_url?: string;
  scraper_type?: string;
  active?: boolean;
  seed_source_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type GovernmentBodyDetail = {
  kind: "government_body";
  id: string;
  name: string;
  jurisdictionName: string;
  level: string;
  communityId: string | null;
  communityName: string | null;
  description: string;
  website: string | null;
  sourceUrl: string | null;
  meetingIndexUrl: string | null;
  sourceLabel: string;
  scraperType: string | null;
  active: boolean;
  seedSourceId: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const seededOrganizations: SeedOrganization[] = [
  {
    id: "org_carson_budget_transparency_coalition",
    name: "Carson Budget Transparency Coalition",
    slug: "carson-budget-transparency-coalition",
    description: "A local coalition focused on budget clarity, accountability materials, and easier-to-follow city decisions.",
    organizationType: "coalition",
    communityId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    founderUserId: "user_trusted_citizen_marco_silva",
    issueTags: ["Budget clarity", "Government transparency", "Public meeting access"],
    linkedEventIds: [],
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
    linkedEventIds: [],
    linkedDebateIds: ["debate_nevada_cost_groups"],
    linkedPetitionIds: ["petition_north_valley_zoning"],
    createdAt: "2026-03-17T18:00:00.000Z",
  },
  {
    id: "org_washoe_service_workers_union",
    name: "Washoe Service Workers Union",
    slug: "washoe-service-workers-union",
    description: "A labor organization focused on public-sector staffing, worker retention, and service reliability across Washoe County.",
    organizationType: "labor",
    communityId: "washoe-county",
    jurisdictionName: "Washoe County, Nevada",
    founderUserId: "user_trusted_citizen_hannah_cho",
    issueTags: ["Teacher pay", "Public staffing", "Collective bargaining"],
    linkedEventIds: [],
    linkedDebateIds: [],
    linkedPetitionIds: [],
    createdAt: "2026-03-16T18:00:00.000Z",
  },
  {
    id: "org_nevada_open_government_project",
    name: "Nevada Open Government Project",
    slug: "nevada-open-government-project",
    description: "A public-interest group tracking access, ethics, records, and government accountability across Nevada jurisdictions.",
    organizationType: "public_interest",
    communityId: "nevada",
    jurisdictionName: "Nevada",
    founderUserId: "user_trusted_citizen_marco_silva",
    issueTags: ["Government transparency", "Ethics", "Meeting access"],
    linkedEventIds: [],
    linkedDebateIds: [],
    linkedPetitionIds: ["petition_carson_meeting_archives"],
    createdAt: "2026-03-15T18:00:00.000Z",
  },
  {
    id: "org_carson_neighborhood_council",
    name: "Carson Neighborhood Council",
    slug: "carson-neighborhood-council",
    description: "A neighborhood association focused on public safety, downtown growth, sidewalks, and everyday city follow-through.",
    organizationType: "neighborhood",
    communityId: "carson-city",
    jurisdictionName: "Carson City, Nevada",
    founderUserId: "user_citizen_alicia_hart",
    issueTags: ["Sidewalk safety", "Downtown growth", "Neighborhood quality of life"],
    linkedEventIds: [],
    linkedDebateIds: [],
    linkedPetitionIds: [],
    createdAt: "2026-03-19T18:00:00.000Z",
  },
  {
    id: "org_reno_faith_and_service_network",
    name: "Reno Faith and Service Network",
    slug: "reno-faith-and-service-network",
    description: "A religious-community network coordinating service projects, housing relief, and family-support advocacy across Reno.",
    organizationType: "religious",
    communityId: "reno",
    jurisdictionName: "Reno, Nevada",
    founderUserId: "user_citizen_miles_reed",
    issueTags: ["Housing affordability", "Food access", "Family services"],
    linkedEventIds: [],
    linkedDebateIds: [],
    linkedPetitionIds: [],
    createdAt: "2026-03-14T18:00:00.000Z",
  },
  {
    id: "org_nevada_small_business_council",
    name: "Nevada Small Business Council",
    slug: "nevada-small-business-council",
    description: "A business association organizing around permits, workforce pipelines, street access, and practical regulatory feedback.",
    organizationType: "business",
    communityId: "nevada",
    jurisdictionName: "Nevada",
    founderUserId: "user_candidate_noah_brooks",
    issueTags: ["Permits", "Workforce", "Downtown access"],
    linkedEventIds: [],
    linkedDebateIds: [],
    linkedPetitionIds: [],
    createdAt: "2026-03-13T18:00:00.000Z",
  },
  {
    id: "org_northern_nevada_tenants_network",
    name: "Northern Nevada Tenants Network",
    slug: "northern-nevada-tenants-network",
    description: "An issue advocacy group helping renters compare policy tradeoffs, organize testimony, and coordinate housing action.",
    organizationType: "advocacy",
    communityId: "reno",
    jurisdictionName: "Northern Nevada",
    founderUserId: "user_trusted_citizen_hannah_cho",
    issueTags: ["Housing affordability", "Renter protections", "Zoning / permits"],
    linkedEventIds: [],
    linkedDebateIds: ["debate_nevada_cost_groups"],
    linkedPetitionIds: ["petition_north_valley_zoning"],
    createdAt: "2026-03-12T18:00:00.000Z",
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
  {
    id: "org_member_hannah_service_workers_founder",
    organizationId: "org_washoe_service_workers_union",
    userId: "user_trusted_citizen_hannah_cho",
    userName: "Hannah Cho",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-16T18:00:00.000Z",
  },
  {
    id: "org_member_miles_service_workers_member",
    organizationId: "org_washoe_service_workers_union",
    userId: "user_citizen_miles_reed",
    userName: "Miles Reed",
    role: "member",
    state: "approved",
    createdAt: "2026-03-17T18:00:00.000Z",
  },
  {
    id: "org_member_marco_open_gov_founder",
    organizationId: "org_nevada_open_government_project",
    userId: "user_trusted_citizen_marco_silva",
    userName: "Marco Silva",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-15T18:00:00.000Z",
  },
  {
    id: "org_member_alicia_open_gov_member",
    organizationId: "org_nevada_open_government_project",
    userId: "user_citizen_alicia_hart",
    userName: "Alicia Hart",
    role: "member",
    state: "approved",
    createdAt: "2026-03-16T18:00:00.000Z",
  },
  {
    id: "org_member_alicia_neighborhood_founder",
    organizationId: "org_carson_neighborhood_council",
    userId: "user_citizen_alicia_hart",
    userName: "Alicia Hart",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-19T18:00:00.000Z",
  },
  {
    id: "org_member_marco_neighborhood_member",
    organizationId: "org_carson_neighborhood_council",
    userId: "user_trusted_citizen_marco_silva",
    userName: "Marco Silva",
    role: "member",
    state: "approved",
    createdAt: "2026-03-20T18:00:00.000Z",
  },
  {
    id: "org_member_miles_faith_founder",
    organizationId: "org_reno_faith_and_service_network",
    userId: "user_citizen_miles_reed",
    userName: "Miles Reed",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-14T18:00:00.000Z",
  },
  {
    id: "org_member_hannah_faith_member",
    organizationId: "org_reno_faith_and_service_network",
    userId: "user_trusted_citizen_hannah_cho",
    userName: "Hannah Cho",
    role: "member",
    state: "approved",
    createdAt: "2026-03-15T18:00:00.000Z",
  },
  {
    id: "org_member_noah_business_founder",
    organizationId: "org_nevada_small_business_council",
    userId: "user_candidate_noah_brooks",
    userName: "Noah Brooks",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-13T18:00:00.000Z",
  },
  {
    id: "org_member_miles_business_member",
    organizationId: "org_nevada_small_business_council",
    userId: "user_citizen_miles_reed",
    userName: "Miles Reed",
    role: "member",
    state: "approved",
    createdAt: "2026-03-14T18:00:00.000Z",
  },
  {
    id: "org_member_hannah_tenants_founder",
    organizationId: "org_northern_nevada_tenants_network",
    userId: "user_trusted_citizen_hannah_cho",
    userName: "Hannah Cho",
    role: "founder",
    state: "approved",
    createdAt: "2026-03-12T18:00:00.000Z",
  },
  {
    id: "org_member_tiana_tenants_member",
    organizationId: "org_northern_nevada_tenants_network",
    userId: "user_citizen_tiana_moore",
    userName: "Tiana Moore",
    role: "member",
    state: "approved",
    createdAt: "2026-03-13T18:00:00.000Z",
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
  {
    id: "org_announce_open_gov_1",
    organizationId: "org_nevada_open_government_project",
    title: "Records access toolkit published",
    body: "The group shared a plain-language toolkit for residents filing records requests and tracking meeting-access follow-through.",
    createdByUserId: "user_trusted_citizen_marco_silva",
    createdByUserName: "Marco Silva",
    createdAt: "2026-04-06T17:30:00.000Z",
  },
  {
    id: "org_announce_tenants_1",
    organizationId: "org_northern_nevada_tenants_network",
    title: "Tenant testimony night",
    body: "Members are collecting short renter testimony clips ahead of the next housing and zoning hearing.",
    createdByUserId: "user_trusted_citizen_hannah_cho",
    createdByUserName: "Hannah Cho",
    createdAt: "2026-04-07T17:30:00.000Z",
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
  {
    id: "org_platform_open_data_deadlines",
    organizationId: "org_nevada_open_government_project",
    title: "Track records-request deadlines statewide",
    description: "Maintain a statewide tracker showing pending, fulfilled, and overdue records and meeting-access requests.",
    issueTag: "Government transparency",
    status: "active",
    createdByUserId: "user_trusted_citizen_marco_silva",
    createdByUserName: "Marco Silva",
    createdAt: "2026-04-04T16:00:00.000Z",
  },
  {
    id: "org_platform_tenants_hearing_pack",
    organizationId: "org_northern_nevada_tenants_network",
    title: "Adopt a housing-hearing testimony pack",
    description: "Package renter testimony, policy tradeoffs, and turnout asks into one member-ready action brief.",
    issueTag: "Housing affordability",
    status: "active",
    createdByUserId: "user_trusted_citizen_hannah_cho",
    createdByUserName: "Hannah Cho",
    createdAt: "2026-04-05T16:00:00.000Z",
  },
  {
    id: "org_platform_business_permits",
    organizationId: "org_nevada_small_business_council",
    title: "Recommend a simplified permit timeline",
    description: "Coordinate member feedback on permit delays and propose a clearer statewide turnaround target.",
    issueTag: "Permits",
    status: "active",
    createdByUserId: "user_candidate_noah_brooks",
    createdByUserName: "Noah Brooks",
    createdAt: "2026-04-06T16:00:00.000Z",
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
  {
    id: "org_vote_open_gov_marco",
    organizationId: "org_nevada_open_government_project",
    platformItemId: "org_platform_open_data_deadlines",
    userId: "user_trusted_citizen_marco_silva",
    choice: "support",
    createdAt: "2026-04-04T18:00:00.000Z",
  },
  {
    id: "org_vote_open_gov_alicia",
    organizationId: "org_nevada_open_government_project",
    platformItemId: "org_platform_open_data_deadlines",
    userId: "user_citizen_alicia_hart",
    choice: "support",
    createdAt: "2026-04-04T18:05:00.000Z",
  },
  {
    id: "org_vote_tenants_hannah",
    organizationId: "org_northern_nevada_tenants_network",
    platformItemId: "org_platform_tenants_hearing_pack",
    userId: "user_trusted_citizen_hannah_cho",
    choice: "support",
    createdAt: "2026-04-05T18:00:00.000Z",
  },
  {
    id: "org_vote_tenants_tiana",
    organizationId: "org_northern_nevada_tenants_network",
    platformItemId: "org_platform_tenants_hearing_pack",
    userId: "user_citizen_tiana_moore",
    choice: "support",
    createdAt: "2026-04-05T18:05:00.000Z",
  },
];

const seededEndorsements: OrganizationEndorsementSummary[] = [
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
  {
    id: "org_endorse_noah",
    organizationId: "org_nevada_small_business_council",
    organizationName: "Nevada Small Business Council",
    organizationType: "business",
    candidateCampaignId: "campaign_noah_assembly_2026",
    electionId: "election_nevada_assembly_2026",
    electionTitle: "Nevada Assembly Election",
    candidateName: "Noah Brooks",
    officeSought: "Assembly District 14",
    statement: "Backed for emphasizing clearer permit timelines and workforce coordination.",
    isActive: true,
    createdAt: "2026-04-08T18:00:00.000Z",
  },
];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isOrganizationType(value: unknown): value is OrganizationType {
  return (
    value === "coalition" ||
    value === "labor" ||
    value === "public_interest" ||
    value === "special_interest" ||
    value === "religious" ||
    value === "nonprofit" ||
    value === "neighborhood" ||
    value === "professional" ||
    value === "student" ||
    value === "business" ||
    value === "advocacy"
  );
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
    const community = getCommunityById(organization.communityId);
    const activePlatformItems = platformItems.filter((item) => item.organizationId === organization.id && item.status === "active");
    const activeDebateCount = organization.linkedDebateIds.length;
    const upcomingEventCount = organization.linkedEventIds.length;
    const scopeLabel =
      community?.scope === "national"
        ? "National"
        : community?.scope === "state"
          ? "State"
          : organization.issueTags.length > 2 && organization.communityId === "nevada"
            ? "Issue-based"
            : "Local";

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      organizationType: organization.organizationType,
      communityId: organization.communityId,
      jurisdictionName: organization.jurisdictionName,
      scopeLabel,
      issueTags: canonicalizeIssueTags(organization.issueTags),
      founderUserId: organization.founderUserId,
      founderName: getSeedUserName(organization.founderUserId),
      adminUserIds: admins.map((entry) => entry.userId),
      adminNames: admins.map((entry) => entry.userName),
      memberCount: approvedMemberships.length,
      activeDebateCount,
      activeVoteCount: activePlatformItems.length,
      viewerMembershipRole: viewerMembership.role,
      viewerMembershipState: viewerMembership.state,
      canManage: Boolean(viewerMembership.role && (viewerMembership.role === "founder" || viewerMembership.role === "admin")),
      platformItemCount: platformItems.filter((item) => item.organizationId === organization.id).length,
      endorsementCount: endorsements.filter((item) => item.organizationId === organization.id).length,
      announcementCount: announcements.filter((item) => item.organizationId === organization.id).length,
      upcomingEventCount,
      petitionCount: organization.linkedPetitionIds.length,
      statementCount: announcements.filter((item) => item.organizationId === organization.id).length,
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

function readGeneratedRecords<T>(fileName: string): T[] {
  const filePath = path.join(GENERATED_DATA_ROOT, fileName);
  if (!existsSync(filePath)) return [];

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (Array.isArray(parsed)) return parsed as T[];
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
      return (parsed as { records: T[] }).records;
    }
  } catch (error) {
    console.warn(`[organizations] failed to read generated ${fileName}`, error);
  }

  return [];
}

function generatedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGeneratedText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bnevada\b/g, "nv")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getGeneratedBodyCommunity(record: PublicMeetingBodyRecord) {
  const jurisdiction = normalizeGeneratedText(generatedText(record.jurisdiction));
  const name = normalizeGeneratedText(generatedText(record.name));
  if (!jurisdiction && !name) return null;

  return (
    seededCommunities.find((community) => {
      const needles = [
        community.name,
        community.shortName,
        community.primaryJurisdictionName,
        community.locationLabel,
        ...community.jurisdictionMatches,
      ]
        .map((value) => normalizeGeneratedText(value ?? ""))
        .filter(Boolean);

      return needles.some((needle) => jurisdiction.includes(needle) || needle.includes(jurisdiction) || name.includes(needle));
    }) ?? null
  );
}

function governmentBodyDetailFromRecord(record: PublicMeetingBodyRecord): GovernmentBodyDetail | null {
  const id = generatedText(record.id);
  const name = generatedText(record.name);
  if (!id || !name) {
    return null;
  }

  const community = getGeneratedBodyCommunity(record);
  const jurisdictionName = generatedText(record.jurisdiction) || community?.primaryJurisdictionName || "Nevada";
  const level = generatedText(record.level) || "government body";
  const sourceUrl = generatedText(record.source_url) || generatedText(record.meeting_index_url) || generatedText(record.website) || null;
  const meetingIndexUrl = generatedText(record.meeting_index_url) || generatedText(record.source_url) || null;
  const website = generatedText(record.website) || null;

  return {
    kind: "government_body",
    id,
    name,
    jurisdictionName,
    level,
    communityId: community?.id ?? null,
    communityName: community?.name ?? null,
    description:
      generatedText(record.notes) ||
      `${generatedText(record.name)} is a source-backed ${level} record from the generated Nevada public meeting body index.`,
    website,
    sourceUrl,
    meetingIndexUrl,
    sourceLabel: generatedText(record.scraper_type) ? `${generatedText(record.scraper_type)} meeting source` : "Public meeting source",
    scraperType: generatedText(record.scraper_type) || null,
    active: record.active !== false,
    seedSourceId: generatedText(record.seed_source_id) || null,
    notes: generatedText(record.notes) || null,
    createdAt: generatedText(record.created_at) || null,
    updatedAt: generatedText(record.updated_at) || null,
  };
}

export async function getGovernmentBodyById(bodyId: string): Promise<GovernmentBodyDetail | null> {
  const records = readGeneratedRecords<PublicMeetingBodyRecord>("public-meeting-bodies.json");
  const record = records.find((entry) => generatedText(entry.id) === bodyId);
  return record ? governmentBodyDetailFromRecord(record) : null;
}

export async function getGovernmentBodiesForCommunity(communityId: string, query = ""): Promise<GovernmentBodyDetail[]> {
  const normalizedQuery = normalizeGeneratedText(query);
  const records = readGeneratedRecords<PublicMeetingBodyRecord>("public-meeting-bodies.json");
  const bodies = records.flatMap((record) => {
    const body = governmentBodyDetailFromRecord(record);
    return body ? [body] : [];
  });

  const local = bodies.filter((body) => body.communityId === communityId);
  const statewide = bodies.filter((body) => body.communityId === "nevada" || normalizeGeneratedText(body.jurisdictionName).includes("nv"));
  const candidates = local.length ? local : statewide.length ? statewide : bodies;

  return candidates
    .filter((body) => {
      if (!normalizedQuery) return true;
      return normalizeGeneratedText(`${body.name} ${body.jurisdictionName} ${body.level} ${body.description}`).includes(normalizedQuery);
    })
    .sort((left, right) => {
      if (left.communityId === communityId && right.communityId !== communityId) return -1;
      if (right.communityId === communityId && left.communityId !== communityId) return 1;
      return left.name.localeCompare(right.name);
    });
}

export async function getOrganizationEndorsementsForCampaign(candidateCampaignId: string) {
  const endorsements = await getAllOrganizationEndorsements();
  return endorsements.filter((entry) => entry.candidateCampaignId === candidateCampaignId);
}

export async function getOrganizationsForCommunity(viewer: AuthUser, communityId: string, issueTag?: string) {
  const organizations = await getAllOrganizations(viewer);

  return organizations
    .filter((entry) => entry.communityId === communityId)
    .filter((entry) => (issueTag ? entry.issueTags.some((tag) => tag.toLowerCase().includes(issueTag.toLowerCase())) : true))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 6);
}

export function getOrganizationPreviewsForCommunity(communityId: string, limit = 4): OrganizationPreviewSummary[] {
  return seededOrganizations
    .filter((entry) => entry.communityId === communityId)
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
    .filter((organization) => (communityId ? organization.communityId === communityId : true))
    .map((organization) => ({
      organization,
      score:
        (organization.communityId === user.primaryCommunityId ? 3 : 0) +
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
