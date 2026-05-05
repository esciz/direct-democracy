"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityById } from "@/lib/community/communities";
import { createNotifications } from "@/lib/notifications/store";
import { getCanonicalIssueTextOrNull } from "@/lib/issues/utils";
import {
  canUserCreateCampusOrg,
  canUserDirectlyCreateCoalition,
  canUserRequestCoalition,
  getAllOrganizationMemberships,
  getAllOrganizations,
  getOrganizationById,
  getOrganizationCampaignOptions,
  isStudentVerifiedForCampusOrg,
  getStoredOrganizationAnnouncements,
  getStoredOrganizationCreationRequests,
  getStoredOrganizationEndorsements,
  getStoredOrganizationMemberships,
  getStoredOrganizationPlatformItems,
  getStoredOrganizationVotes,
  getStoredOrganizations,
  setStoredOrganizationAnnouncements,
  setStoredOrganizationCreationRequests,
  setStoredOrganizationEndorsements,
  setStoredOrganizationMemberships,
  setStoredOrganizationPlatformItems,
  setStoredOrganizationVotes,
  setStoredOrganizations,
} from "@/lib/organizations/store";
import type {
  OrganizationAnnouncementSummary,
  OrganizationCreationRequestSummary,
  OrganizationEndorsementSummary,
  OrganizationMembershipSummary,
  OrganizationPlatformItemStatus,
  OrganizationVoteSummary,
  OrganizationType,
} from "@/types/domain";

function normalizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIssueTags(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function canonicalizeIssueTags(tags: string[]) {
  const deduped = new Set<string>();

  for (const tag of tags) {
    const canonical = getCanonicalIssueTextOrNull(tag);

    if (canonical) {
      deduped.add(canonical);
    }
  }

  return [...deduped].slice(0, 6);
}

function normalizeOrganizationIssueInputs(formData: FormData) {
  return canonicalizeIssueTags(
    [
      normalizeText(formData.get("issueTagPrimary")),
      normalizeText(formData.get("issueTagSecondary")),
      normalizeText(formData.get("issueTagTertiary")),
      normalizeText(formData.get("campusIssueTagPrimary")),
      normalizeText(formData.get("campusIssueTagSecondary")),
      normalizeText(formData.get("campusIssueTagTertiary")),
      normalizeText(formData.get("coalitionIssueTagPrimary")),
      normalizeText(formData.get("coalitionIssueTagSecondary")),
      normalizeText(formData.get("coalitionIssueTagTertiary")),
      ...normalizeIssueTags(normalizeText(formData.get("issueTags"))),
    ].filter(Boolean),
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function redirectWithState(path: string, key: string, value: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${value}`);
}

function isManager(membership: OrganizationMembershipSummary | undefined) {
  return membership?.state === "approved" && (membership.role === "founder" || membership.role === "admin");
}

export async function createOrganization(formData: FormData) {
  const user = await getCurrentUser();
  const organizationType = normalizeText(formData.get("organizationType")) as OrganizationType;
  const name = normalizeText(formData.get("name"));
  const description = normalizeText(formData.get("description"));
  const communityId = normalizeText(formData.get("communityId"));
  const issueTags = normalizeOrganizationIssueInputs(formData);
  const returnPath = normalizeText(formData.get("returnPath")) || "/organizations";
  const community = getCommunityById(communityId);

  if (!community || !name || description.length < 20 || !issueTags.length) {
    redirectWithState(returnPath, "orgError", "fields");
  }

  if (organizationType !== "campus_org" && organizationType !== "coalition") {
    redirectWithState(returnPath, "orgError", "type");
  }

  const existing = await getStoredOrganizations();
  const duplicate = existing.some((entry) => entry.name.toLowerCase() === name.toLowerCase()) || (await getAllOrganizations(user)).some((entry) => entry.name.toLowerCase() === name.toLowerCase());

  if (duplicate) {
    redirectWithState(returnPath, "orgError", "duplicate");
  }

  if (organizationType === "campus_org") {
    if (community.communityType !== "campus" || !canUserCreateCampusOrg(user, communityId)) {
      redirectWithState(returnPath, "orgError", "campus-permissions");
    }

    const created = {
      id: `organization_${Date.now()}`,
      name,
      slug: slugify(name),
      description,
      organizationType,
      communityId,
      campusCommunityId: communityId,
      jurisdictionName: community.primaryJurisdictionName,
      founderUserId: user.id,
      issueTags,
      linkedEventIds: [],
      linkedDebateIds: [],
      linkedPetitionIds: [],
      createdAt: new Date().toISOString(),
    };
    const memberships: OrganizationMembershipSummary[] = [
      {
        id: `organization_membership_${Date.now()}`,
        organizationId: created.id,
        userId: user.id,
        userName: user.name,
        role: "founder",
        state: "approved",
        createdAt: new Date().toISOString(),
      },
      ...(await getStoredOrganizationMemberships()),
    ];

    await Promise.all([setStoredOrganizations([created, ...existing]), setStoredOrganizationMemberships(memberships)]);
    redirect(`/organizations/${created.id}?org=created`);
  }

  if (canUserDirectlyCreateCoalition(user)) {
    const created = {
      id: `organization_${Date.now()}`,
      name,
      slug: slugify(name),
      description,
      organizationType,
      communityId,
      campusCommunityId: null,
      jurisdictionName: community.primaryJurisdictionName,
      founderUserId: user.id,
      issueTags,
      linkedEventIds: [],
      linkedDebateIds: [],
      linkedPetitionIds: [],
      createdAt: new Date().toISOString(),
    };
    const memberships: OrganizationMembershipSummary[] = [
      {
        id: `organization_membership_${Date.now()}`,
        organizationId: created.id,
        userId: user.id,
        userName: user.name,
        role: "founder",
        state: "approved",
        createdAt: new Date().toISOString(),
      },
      ...(await getStoredOrganizationMemberships()),
    ];

    await Promise.all([setStoredOrganizations([created, ...existing]), setStoredOrganizationMemberships(memberships)]);
    redirect(`/organizations/${created.id}?org=created`);
  }

  if (!canUserRequestCoalition(user)) {
    redirectWithState(returnPath, "orgError", "coalition-permissions");
  }

  const requests = await getStoredOrganizationCreationRequests();
  const request: OrganizationCreationRequestSummary = {
    id: `organization_request_${Date.now()}`,
    organizationType,
    name,
    description,
    communityId,
    campusCommunityId: null,
    requestedByUserId: user.id,
    requestedByUserName: user.name,
    issueTags,
    createdAt: new Date().toISOString(),
  };
  await setStoredOrganizationCreationRequests([request, ...requests]);
  redirectWithState(returnPath, "org", "requested");
}

export async function approveOrganizationCreationRequest(formData: FormData) {
  const user = await getCurrentUser();
  const requestId = normalizeText(formData.get("requestId"));

  if (user.role !== "admin") {
    redirectWithState("/organizations", "orgError", "approval");
  }

  const requests = await getStoredOrganizationCreationRequests();
  const request = requests.find((entry) => entry.id === requestId);

  if (!request) {
    redirectWithState("/organizations", "orgError", "request");
  }

  const community = getCommunityById(request.communityId);

  if (!community) {
    redirectWithState("/organizations", "orgError", "community");
  }

  const created = {
    id: `organization_${Date.now()}`,
    name: request.name,
    slug: slugify(request.name),
    description: request.description,
    organizationType: request.organizationType,
    communityId: request.communityId,
    campusCommunityId: request.campusCommunityId ?? null,
    jurisdictionName: community.primaryJurisdictionName,
    founderUserId: request.requestedByUserId,
    issueTags: request.issueTags,
    linkedEventIds: [],
    linkedDebateIds: [],
    linkedPetitionIds: [],
    createdAt: new Date().toISOString(),
  };
  const [existingOrganizations, existingMemberships] = await Promise.all([getStoredOrganizations(), getStoredOrganizationMemberships()]);

  await Promise.all([
    setStoredOrganizations([created, ...existingOrganizations]),
    setStoredOrganizationMemberships([
      {
        id: `organization_membership_${Date.now()}`,
        organizationId: created.id,
        userId: request.requestedByUserId,
        userName: request.requestedByUserName,
        role: "founder",
        state: "approved",
        createdAt: new Date().toISOString(),
      },
      ...existingMemberships,
    ]),
    setStoredOrganizationCreationRequests(requests.filter((entry) => entry.id !== requestId)),
  ]);

  redirect(`/organizations/${created.id}?org=approved`);
}

export async function requestOrganizationMembership(formData: FormData) {
  const user = await getCurrentUser();
  const organizationId = normalizeText(formData.get("organizationId"));
  const returnPath = normalizeText(formData.get("returnPath")) || `/organizations/${organizationId}`;
  const [organization, memberships, allMemberships] = await Promise.all([
    getOrganizationById(organizationId, user),
    getStoredOrganizationMemberships(),
    getAllOrganizationMemberships(),
  ]);

  if (!organization) {
    redirectWithState(returnPath, "orgError", "membership");
  }

  if (
    organization.organizationType === "campus_org" &&
    (!organization.campusCommunityId || !isStudentVerifiedForCampusOrg(user, organization.campusCommunityId))
  ) {
    redirectWithState(returnPath, "orgError", "campus-membership");
  }

  if (allMemberships.some((entry) => entry.organizationId === organizationId && entry.userId === user.id)) {
    redirectWithState(returnPath, "org", "membership-exists");
  }

  await setStoredOrganizationMemberships([
    {
      id: `organization_membership_${Date.now()}`,
      organizationId,
      userId: user.id,
      userName: user.name,
      role: "member",
      state: "pending",
      createdAt: new Date().toISOString(),
    },
    ...memberships,
  ]);

  redirectWithState(returnPath, "org", "membership-requested");
}

export async function approveOrganizationMembership(formData: FormData) {
  const user = await getCurrentUser();
  const membershipId = normalizeText(formData.get("membershipId"));
  const returnPath = normalizeText(formData.get("returnPath")) || "/organizations";
  const memberships = await getStoredOrganizationMemberships();
  const allMemberships = await getAllOrganizationMemberships();
  const target = allMemberships.find((entry) => entry.id === membershipId);

  if (!target) {
    redirectWithState(returnPath, "orgError", "membership");
  }

  const managerMembership = allMemberships.find((entry) => entry.organizationId === target.organizationId && entry.userId === user.id);

  if (!isManager(managerMembership) && user.role !== "admin") {
    redirectWithState(returnPath, "orgError", "approval");
  }

  const next = [
    {
      ...target,
      state: "approved" as const,
    },
    ...memberships.filter((entry) => entry.id !== membershipId),
  ];

  await setStoredOrganizationMemberships(next);
  redirectWithState(returnPath, "org", "membership-approved");
}

export async function createOrganizationAnnouncement(formData: FormData) {
  const user = await getCurrentUser();
  const organizationId = normalizeText(formData.get("organizationId"));
  const title = normalizeText(formData.get("title"));
  const body = normalizeText(formData.get("body"));
  const returnPath = normalizeText(formData.get("returnPath")) || `/organizations/${organizationId}`;
  const [organization, allMemberships, announcements] = await Promise.all([
    getOrganizationById(organizationId, user),
    getAllOrganizationMemberships(),
    getStoredOrganizationAnnouncements(),
  ]);

  if (!organization || !organization.canManage) {
    redirectWithState(returnPath, "orgError", "manage");
  }

  if (title.length < 4 || body.length < 12) {
    redirectWithState(returnPath, "orgError", "announcement");
  }

  const announcement: OrganizationAnnouncementSummary = {
    id: `organization_announcement_${Date.now()}`,
    organizationId,
    title,
    body,
    createdByUserId: user.id,
    createdByUserName: user.name,
    createdAt: new Date().toISOString(),
  };

  await setStoredOrganizationAnnouncements([announcement, ...announcements]);

  const recipients = allMemberships
    .filter((entry) => entry.organizationId === organizationId && entry.state === "approved" && entry.userId !== user.id)
    .map((entry) => entry.userId);

  if (recipients.length) {
    await createNotifications(
      recipients.map((recipientId) => ({
        userId: recipientId,
        type: "organizationAnnouncement",
        title: `${organization.name} announcement`,
        body: title,
        entityId: organizationId,
        contextEntityId: announcement.id,
      })),
    );
  }

  redirectWithState(returnPath, "org", "announcement-sent");
}

export async function createOrganizationPlatformItem(formData: FormData) {
  const user = await getCurrentUser();
  const organizationId = normalizeText(formData.get("organizationId"));
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const issueTag = normalizeText(formData.get("issueTag"));
  const status = normalizeText(formData.get("status")) as OrganizationPlatformItemStatus;
  const returnPath = normalizeText(formData.get("returnPath")) || `/organizations/${organizationId}`;
  const organization = await getOrganizationById(organizationId, user);

  if (!organization || !organization.canManage) {
    redirectWithState(returnPath, "orgError", "manage");
  }

  if (title.length < 4 || description.length < 16 || !issueTag || !["draft", "active", "adopted"].includes(status)) {
    redirectWithState(returnPath, "orgError", "platform");
  }

  const items = await getStoredOrganizationPlatformItems();
  await setStoredOrganizationPlatformItems([
    {
      id: `organization_platform_${Date.now()}`,
      organizationId,
      title,
      description,
      issueTag,
      status,
      createdByUserId: user.id,
      createdByUserName: user.name,
      createdAt: new Date().toISOString(),
    },
    ...items,
  ]);

  redirectWithState(returnPath, "org", "platform-saved");
}

export async function voteOnOrganizationPlatformItem(formData: FormData) {
  const user = await getCurrentUser();
  const organizationId = normalizeText(formData.get("organizationId"));
  const platformItemId = normalizeText(formData.get("platformItemId"));
  const choice = normalizeText(formData.get("choice"));
  const returnPath = normalizeText(formData.get("returnPath")) || `/organizations/${organizationId}`;
  const organization = await getOrganizationById(organizationId, user);

  if (!organization || !organization.viewerMembershipRole) {
    redirectWithState(returnPath, "orgError", "vote");
  }

  if (choice !== "support" && choice !== "oppose") {
    redirectWithState(returnPath, "orgError", "vote");
  }

  const votes = await getStoredOrganizationVotes();
  const nextVote: OrganizationVoteSummary = {
    id: `organization_vote_${Date.now()}`,
    organizationId,
    platformItemId,
    userId: user.id,
    choice,
    createdAt: new Date().toISOString(),
  };

  await setStoredOrganizationVotes([nextVote, ...votes.filter((entry) => !(entry.platformItemId === platformItemId && entry.userId === user.id))]);
  redirectWithState(returnPath, "org", "vote-saved");
}

export async function saveOrganizationEndorsement(formData: FormData) {
  const user = await getCurrentUser();
  const organizationId = normalizeText(formData.get("organizationId"));
  const candidateCampaignId = normalizeText(formData.get("candidateCampaignId"));
  const statement = normalizeText(formData.get("statement")) || null;
  const returnPath = normalizeText(formData.get("returnPath")) || `/organizations/${organizationId}`;
  const [organization, endorsements, campaignOptions] = await Promise.all([
    getOrganizationById(organizationId, user),
    getStoredOrganizationEndorsements(),
    getOrganizationCampaignOptions(organizationId),
  ]);

  if (!organization || !organization.canManage) {
    redirectWithState(returnPath, "orgError", "manage");
  }

  const campaign = campaignOptions.find((entry) => entry.id === candidateCampaignId);

  if (!campaign) {
    redirectWithState(returnPath, "orgError", "endorsement");
  }

  await setStoredOrganizationEndorsements([
    {
      id: `organization_endorsement_${Date.now()}`,
      organizationId,
      organizationName: organization.name,
      organizationType: organization.organizationType,
      candidateCampaignId: campaign.id,
      electionId: campaign.electionId,
      electionTitle: campaign.electionTitle ?? campaign.jurisdictionName,
      candidateName: campaign.candidateName,
      officeSought: campaign.officeSought,
      statement,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    ...endorsements.filter((entry) => !(entry.organizationId === organizationId && entry.electionId === campaign.electionId)),
  ]);

  redirectWithState(returnPath, "org", "endorsement-saved");
}

export async function removeOrganizationEndorsement(formData: FormData) {
  const user = await getCurrentUser();
  const endorsementId = normalizeText(formData.get("endorsementId"));
  const returnPath = normalizeText(formData.get("returnPath")) || "/organizations";
  const endorsements = await getStoredOrganizationEndorsements();
  const target = endorsements.find((entry) => entry.id === endorsementId);
  const allOrganizations = await getAllOrganizations(user);
  const targetOrgId = target?.organizationId ?? null;
  const organization = targetOrgId ? allOrganizations.find((entry) => entry.id === targetOrgId) : null;

  if (!organization || !organization.canManage || !target) {
    redirectWithState(returnPath, "orgError", "manage");
  }

  await setStoredOrganizationEndorsements(endorsements.filter((entry) => entry.id !== endorsementId));
  redirectWithState(returnPath, "org", "endorsement-removed");
}
