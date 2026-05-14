"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getCreatedPosts, setCreatedPosts } from "@/lib/feed/posts";
import { createFolloweeNotificationsForMajorAction, createPetitionProgressNotifications } from "@/lib/notifications/store";
import { getOfficials } from "@/lib/officials/store";
import { getOrganizationById } from "@/lib/organizations/store";
import { startDraftingForPetition } from "@/lib/petitions/drafting";
import { ensureIssueReferenceForUser } from "@/lib/server/issues";
import {
  getAllPetitionSignatures,
  getPetitionById,
  getStoredPetitions,
  getStoredSignatures,
  setStoredPetitions,
  setStoredSignatures,
} from "@/lib/petitions/store";
import { getStoredSponsorshipRequests, setStoredSponsorshipRequests } from "@/lib/petitions/sponsorships";
import type { PetitionSignatureSummary, PetitionSummary, PostSummary, SponsorshipRequestSummary } from "@/types/domain";

function redirectWithError(path: string, error: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${error}`);
}

export async function createPetition(formData: FormData) {
  const user = await getCurrentUser();

  if (!user.isVerifiedVoter) {
    redirectWithError("/petitions", "verification");
  }

  const title = formData.get("title");
  const summary = formData.get("summary");
  const body = formData.get("body");
  const issueTag = formData.get("issueTag");
  const organizationIdEntry = formData.get("organizationId");
  const organizationId = typeof organizationIdEntry === "string" ? organizationIdEntry.trim() || null : null;

  if (typeof title !== "string" || title.trim().length < 8) {
    redirectWithError("/petitions/create", "title");
  }

  if (typeof summary !== "string" || summary.trim().length < 20) {
    redirectWithError("/petitions/create", "summary");
  }

  if (typeof body !== "string" || body.trim().length < 40) {
    redirectWithError("/petitions/create", "body");
  }

  const sanitizedTitle = title.trim();
  const sanitizedSummary = summary.trim();
  const sanitizedBody = body.trim();
  const sanitizedIssueTag = typeof issueTag === "string" ? issueTag.trim() : "";
  const organization = organizationId ? await getOrganizationById(organizationId, user) : null;
  const linkedIssue = sanitizedIssueTag ? await ensureIssueReferenceForUser(user, sanitizedIssueTag) : null;

  if (organizationId && (!organization || !organization.canManage || organization.organizationType === "campus_org")) {
    redirectWithError("/petitions/create", "organization");
  }

  const createdPetition: PetitionSummary = {
    id: `petition_created_${Date.now()}`,
    creatorId: user.id,
    organizationId: organization?.id ?? null,
    title: sanitizedTitle,
    summary: sanitizedSummary,
    body: sanitizedBody,
    issueTags: linkedIssue ? [linkedIssue.issueText] : undefined,
    jurisdictionName: user.jurisdictionName,
    creatorName: organization?.name ?? user.name,
    status: "ACTIVE",
    signatureCount: 0,
    signatureGoal: 5000,
    eligibleForCosponsorship: false,
    createdAt: new Date().toISOString(),
  };

  const existing = await getStoredPetitions();
  await setStoredPetitions([createdPetition, ...existing]);
  await createFolloweeNotificationsForMajorAction(
    user.id,
    user.name,
    createdPetition.id,
    "started a petition",
    `New petition: ${createdPetition.title}`,
  );

  redirect(`/petitions/${createdPetition.id}`);
}

export async function signPetition(formData: FormData) {
  const user = await getCurrentUser();
  const petitionId = formData.get("petitionId");

  if (typeof petitionId !== "string") {
    redirectWithError("/petitions", "petition");
  }

  const safePetitionId: string = petitionId;
  const petition = await getPetitionById(safePetitionId, user);

  if (!petition) {
    redirectWithError("/petitions", "petition");
  }

  if (!user.isVerifiedVoter) {
    redirectWithError(`/petitions/${safePetitionId}`, "verification");
  }

  if (!petition.jurisdictionMatches) {
    redirectWithError(`/petitions/${safePetitionId}`, "jurisdiction");
  }

  if (petition.hasSigned) {
    redirect(`/petitions/${safePetitionId}?signed=already`);
  }

  const existing = [...(await getStoredSignatures()), ...((await getPetitionById(safePetitionId, user))?.recentSignatures ?? [])];
  const alreadySigned = existing.some(
    (signature) => signature.petitionId === safePetitionId && signature.signerId === user.id && signature.status === "VALID",
  );

  if (alreadySigned) {
    redirect(`/petitions/${safePetitionId}?signed=already`);
  }

  const newSignature: PetitionSignatureSummary = {
    id: `signature_created_${Date.now()}`,
    petitionId: safePetitionId,
    signerId: user.id,
    signerName: user.name,
    jurisdictionName: user.jurisdictionName,
    status: "VALID",
    signedAt: new Date().toISOString(),
  };

  const storedSignatures = await getStoredSignatures();
  await setStoredSignatures([newSignature, ...storedSignatures]);
  const reachedThreshold = !petition.eligibleForCosponsorship && petition.signatureCount + 1 >= petition.signatureGoal;

  if (reachedThreshold) {
    const signerIds = (await getAllPetitionSignatures())
      .filter((signature) => signature.petitionId === safePetitionId && signature.status === "VALID")
      .map((signature) => signature.signerId);

    await createPetitionProgressNotifications({
      userIds: signerIds,
      type: "petitionSeekingSponsor",
      petitionId: safePetitionId,
      petitionTitle: petition.title,
    });
  }

  redirect(`/petitions/${safePetitionId}?signed=success`);
}

export async function supportPetitionFromFeed(petitionId: string) {
  const user = await getCurrentUser();
  const petition = await getPetitionById(petitionId, user);

  if (!petition) {
    return {
      ok: false,
      message: "That petition is no longer available.",
    };
  }

  if (!user.isVerifiedVoter) {
    return {
      ok: false,
      message: "Voter verification is required before supporting a petition.",
    };
  }

  if (!petition.jurisdictionMatches) {
    return {
      ok: false,
      message: "You can only support petitions in your jurisdiction.",
    };
  }

  if (petition.hasSigned) {
    return {
      ok: true,
      hasSigned: true,
      signatureCount: petition.signatureCount,
    };
  }

  const storedSignatures = await getStoredSignatures();
  const alreadySigned = [...storedSignatures, ...petition.recentSignatures].some(
    (signature) => signature.petitionId === petitionId && signature.signerId === user.id && signature.status === "VALID",
  );

  if (alreadySigned) {
    return {
      ok: true,
      hasSigned: true,
      signatureCount: petition.signatureCount,
    };
  }

  const newSignature: PetitionSignatureSummary = {
    id: `signature_created_${Date.now()}`,
    petitionId,
    signerId: user.id,
    signerName: user.name,
    jurisdictionName: user.jurisdictionName,
    status: "VALID",
    signedAt: new Date().toISOString(),
  };

  await setStoredSignatures([newSignature, ...storedSignatures]);

  return {
    ok: true,
    hasSigned: true,
    signatureCount: petition.signatureCount + 1,
  };
}

export async function requestPetitionSponsorship(formData: FormData) {
  const user = await getCurrentUser();
  const petitionId = formData.get("petitionId");

  if (typeof petitionId !== "string") {
    redirectWithError("/petitions", "petition");
  }

  const petition = await getPetitionById(petitionId, user);

  if (!petition) {
    redirectWithError("/petitions", "petition");
  }

  const existingRequests = await getStoredSponsorshipRequests();
  const alreadyRequested = existingRequests.some((request) => request.petitionId === petitionId && request.requesterId === user.id);

  if (alreadyRequested) {
    redirect(`/petitions/${petitionId}?sponsorship=already`);
  }

  const targetedOfficials = (await getOfficials())
    .filter((official) => official.jurisdictionName === petition.jurisdictionName)
    .slice(0, 3);

  const request: SponsorshipRequestSummary = {
    id: `sponsorship_request_${Date.now()}`,
    petitionId,
    requesterId: user.id,
    requesterName: user.name,
    targetedOfficialIds: targetedOfficials.map((official) => official.id),
    targetedOfficialNames: targetedOfficials.map((official) => official.name),
    createdAt: new Date().toISOString(),
  };
  const derivedCommunityId =
    user.primaryCommunityId ?? petition.jurisdictionName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const requestPost: PostSummary = {
    id: `post_sponsorship_${Date.now()}`,
    title: `Sponsorship request for ${petition.title}`,
    authorId: user.id,
    authorName: user.name,
    authorRole: user.role,
    jurisdictionName: petition.jurisdictionName,
    content: targetedOfficials.length
      ? `${user.name} publicly requested sponsorship for "${petition.title}" from ${targetedOfficials.map((official) => official.name).join(", ")}.`
      : `${user.name} publicly requested sponsorship for "${petition.title}".`,
    perspectiveType: "petition_update",
    attachments: [
      {
        type: "petition",
        id: petition.id,
        label: petition.title,
        jurisdictionId: derivedCommunityId,
      },
      {
        type: "community",
        id: derivedCommunityId,
        label: petition.jurisdictionName,
        jurisdictionId: derivedCommunityId,
      },
    ],
    visibilityScope: "petition",
    jurisdictionScope: [derivedCommunityId],
    stance: "explain",
    moderationStatus: "published",
    postType: "TEXT",
    contentType: "announcementUpdate",
    createdAt: new Date().toISOString(),
    reactionTotals: {
      up: 0,
      down: 0,
    },
    truthScore: {
      media: null,
      moderators: null,
      citizens: null,
    },
    petitionId,
    targetedOfficialIds: request.targetedOfficialIds,
  };

  const createdPosts = await getCreatedPosts();
  await setCreatedPosts([requestPost, ...createdPosts]);
  await setStoredSponsorshipRequests([request, ...existingRequests]);
  await createFolloweeNotificationsForMajorAction(
    user.id,
    user.name,
    petitionId,
    "requested sponsorship for a petition",
    `Sponsorship request: ${petition.title}`,
  );
  const signerIds = (await getAllPetitionSignatures())
    .filter((signature) => signature.petitionId === petitionId && signature.status === "VALID")
    .map((signature) => signature.signerId);

  await createPetitionProgressNotifications({
    userIds: signerIds,
    type: "petitionSponsorFound",
    petitionId,
    petitionTitle: petition.title,
  });

  redirect(`/petitions/${petitionId}?sponsorship=success`);
}

export async function startPetitionDrafting(formData: FormData) {
  const user = await getCurrentUser();
  const petitionId = formData.get("petitionId");

  if (typeof petitionId !== "string") {
    redirectWithError("/petitions", "petition");
  }

  if (user.role !== "official" && user.role !== "admin") {
    redirectWithError(`/petitions/${petitionId}`, "permissions");
  }

  const petition = await getPetitionById(petitionId, user);

  if (!petition) {
    redirectWithError("/petitions", "petition");
  }

  if (!petition.sponsorshipRequests.length) {
    redirectWithError(`/petitions/${petitionId}`, "sponsorship");
  }

  await startDraftingForPetition(petitionId);
  const signerIds = (await getAllPetitionSignatures())
    .filter((signature) => signature.petitionId === petitionId && signature.status === "VALID")
    .map((signature) => signature.signerId);

  await createPetitionProgressNotifications({
    userIds: signerIds,
    type: "petitionDrafting",
    petitionId,
    petitionTitle: petition.title,
  });

  redirect(`/petitions/${petitionId}?drafting=started`);
}
