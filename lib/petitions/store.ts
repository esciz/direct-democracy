import { cookies } from "next/headers";
import { cache } from "react";

import { getPetitionLifecycle } from "@/lib/community/lifecycle";
import { canonicalizeIssueTags } from "@/lib/issues/utils";
import { getDraftingPetitionIds } from "@/lib/petitions/drafting";
import { getAllSponsorshipRequests } from "@/lib/petitions/sponsorships";
import type { FeedViewerContext } from "@/lib/auth/session";
import type {
  AuthUser,
  PetitionDetail,
  PetitionSignatureSummary,
  PetitionSummary,
  UserCivicPetitionActivitySummary,
} from "@/types/domain";

const CREATED_PETITIONS_COOKIE = "dd_mock_petitions";
const PETITION_SIGNATURES_COOKIE = "dd_mock_petition_signatures";
const COSPONSORSHIP_THRESHOLD = 5000;

export type FeedPetitionPreview = PetitionSummary & {
  viewerHasSigned: boolean;
  viewerCanSign: boolean;
};

type StoredPetitionSeed = Omit<PetitionSummary, "signatureCount" | "eligibleForCosponsorship" | "status"> & {
  signatureCount?: number;
};

function isPetitionSummary(value: unknown): value is PetitionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const petition = value as Record<string, unknown>;

  return (
    typeof petition.id === "string" &&
    typeof petition.title === "string" &&
    typeof petition.summary === "string" &&
    typeof petition.jurisdictionName === "string" &&
    typeof petition.creatorName === "string" &&
    typeof petition.createdAt === "string"
  );
}

function isPetitionSignatureSummary(value: unknown): value is PetitionSignatureSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const signature = value as Record<string, unknown>;

  return (
    typeof signature.id === "string" &&
    typeof signature.petitionId === "string" &&
    typeof signature.signerId === "string" &&
    typeof signature.signerName === "string" &&
    typeof signature.jurisdictionName === "string" &&
    typeof signature.status === "string" &&
    typeof signature.signedAt === "string"
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

async function writeCookieArray<T>(cookieName: string, data: T[]) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, JSON.stringify(data), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

function computePetitionState(petition: StoredPetitionSeed, signatures: PetitionSignatureSummary[]): PetitionSummary {
  const validSignatures = signatures.filter((signature) => signature.status === "VALID");
  const signatureCount = validSignatures.length + (petition.signatureCount ?? 0);
  const eligibleForCosponsorship = signatureCount >= COSPONSORSHIP_THRESHOLD;

  return {
    ...petition,
    issueTags: canonicalizeIssueTags(petition.issueTags ?? []),
    body: petition.body,
    signatureCount,
    eligibleForCosponsorship,
    status: eligibleForCosponsorship ? "ELIGIBLE_FOR_COSPONSORSHIP" : "ACTIVE",
  };
}

export async function getStoredPetitions(): Promise<PetitionSummary[]> {
  return readCookieArray(CREATED_PETITIONS_COOKIE, isPetitionSummary);
}

export async function setStoredPetitions(petitions: PetitionSummary[]) {
  await writeCookieArray(CREATED_PETITIONS_COOKIE, petitions.slice(0, 20));
}

export async function getStoredSignatures(): Promise<PetitionSignatureSummary[]> {
  return readCookieArray(PETITION_SIGNATURES_COOKIE, isPetitionSignatureSummary);
}

export async function setStoredSignatures(signatures: PetitionSignatureSummary[]) {
  await writeCookieArray(PETITION_SIGNATURES_COOKIE, signatures.slice(0, 80));
}

export async function getAllPetitions(): Promise<PetitionSummary[]> {
  const createdPetitions = await getStoredPetitions();
  const signatures = await getStoredSignatures();

  return createdPetitions
    .map((petition) =>
      computePetitionState(
        petition,
        signatures.filter((signature) => signature.petitionId === petition.id),
      ),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

const getFeedPetitionPreviewsCached = cache(
  async (
    jurisdictionKey: string,
    viewerId: string | undefined,
    viewerJurisdictionName: string | undefined,
    viewerIsVerifiedVoter: boolean,
    limit: number,
  ): Promise<FeedPetitionPreview[]> => {
    const [createdPetitions, storedSignatures] = await Promise.all([getStoredPetitions(), getStoredSignatures()]);
    const jurisdictionNames = jurisdictionKey ? jurisdictionKey.split("|").filter(Boolean) : null;
    const allowedJurisdictions = jurisdictionNames ? new Set(jurisdictionNames) : null;
    const signatureCountByPetition = new Map<string, number>();
    const allSignatures = storedSignatures;

    for (const signature of allSignatures) {
      if (signature.status !== "VALID") {
        continue;
      }

      signatureCountByPetition.set(
        signature.petitionId,
        (signatureCountByPetition.get(signature.petitionId) ?? 0) + 1,
      );
    }

    const petitions = createdPetitions
      .filter((petition) => (allowedJurisdictions ? allowedJurisdictions.has(petition.jurisdictionName) : true))
      .map((petition) => ({
        ...petition,
        issueTags: canonicalizeIssueTags(petition.issueTags ?? []),
        signatureCount: Math.max(petition.signatureCount, signatureCountByPetition.get(petition.id) ?? 0),
        viewerHasSigned: Boolean(
          viewerId &&
            allSignatures.some(
              (signature) => signature.petitionId === petition.id && signature.signerId === viewerId && signature.status === "VALID",
            ),
        ),
        viewerCanSign: Boolean(
          viewerId &&
            viewerIsVerifiedVoter &&
            viewerJurisdictionName === petition.jurisdictionName &&
            !allSignatures.some(
              (signature) => signature.petitionId === petition.id && signature.signerId === viewerId && signature.status === "VALID",
            ),
        ),
      }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    return limit > 0 ? petitions.slice(0, limit) : petitions;
  },
);

export async function getFeedPetitionPreviews(options?: { jurisdictionNames?: string[]; limit?: number; viewer?: FeedViewerContext }) {
  const jurisdictionKey = options?.jurisdictionNames?.length ? [...options.jurisdictionNames].sort().join("|") : "";
  return getFeedPetitionPreviewsCached(
    jurisdictionKey,
    options?.viewer?.id,
    options?.viewer?.jurisdictionName,
    options?.viewer?.isVerifiedVoter ?? false,
    options?.limit ?? -1,
  );
}

export async function getAllPetitionSignatures() {
  return (await getStoredSignatures()).sort((a, b) => Date.parse(b.signedAt) - Date.parse(a.signedAt));
}

export async function getPetitionById(petitionId: string, user?: AuthUser): Promise<PetitionDetail | null> {
  const petitions = await getAllPetitions();
  const petition = petitions.find((entry) => entry.id === petitionId);

  if (!petition) {
    return null;
  }

  const allSignatures = (await getAllPetitionSignatures())
    .filter((signature) => signature.petitionId === petitionId)
    .sort((a, b) => Date.parse(b.signedAt) - Date.parse(a.signedAt));
  const sponsorshipRequests = (await getAllSponsorshipRequests())
    .filter((request) => request.petitionId === petitionId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const draftingPetitionIds = await getDraftingPetitionIds();
  const isDrafting = draftingPetitionIds.includes(petitionId);

  const hasSigned = user ? allSignatures.some((signature) => signature.signerId === user.id && signature.status === "VALID") : false;
  const userIsVerified = Boolean(user?.isVerifiedVoter);
  const jurisdictionMatches = user ? user.jurisdictionName === petition.jurisdictionName : false;
  const canStartDrafting = Boolean(
    user &&
      (user.role === "official" || user.role === "admin") &&
      sponsorshipRequests.length > 0 &&
      !isDrafting,
  );

  return {
    ...petition,
    body: petition.body ?? petition.summary,
    canSign: Boolean(user && userIsVerified && jurisdictionMatches && !hasSigned),
    hasSigned,
    userIsVerified,
    jurisdictionMatches,
    isDrafting,
    canStartDrafting,
    recentSignatures: allSignatures.slice(0, 5),
    lifecycle: getPetitionLifecycle(petition, sponsorshipRequests, isDrafting),
    sponsorshipRequests: sponsorshipRequests.slice(0, 5),
  };
}

function mapLifecycleToProgressStatus(
  petition: PetitionSummary,
  sponsorName?: string | null,
): UserCivicPetitionActivitySummary["status"] {
  if (petition.status === "DRAFT") {
    return "Drafting";
  }

  if (sponsorName) {
    return "Sponsor Found";
  }

  if (petition.eligibleForCosponsorship || petition.status === "ELIGIBLE_FOR_COSPONSORSHIP") {
    return "Seeking Sponsor";
  }

  return "Active";
}

export async function getUserCivicPetitionActivity(userId: string): Promise<{
  signedPetitions: UserCivicPetitionActivitySummary[];
  progressingPetitions: UserCivicPetitionActivitySummary[];
}> {
  const [petitions, sponsorshipRequests, storedSignatures, draftingPetitionIds] = await Promise.all([
    getAllPetitions(),
    getAllSponsorshipRequests(),
    getStoredSignatures(),
    getDraftingPetitionIds(),
  ]);

  const signatures = storedSignatures
    .filter((signature) => signature.signerId === userId && signature.status === "VALID")
    .sort((a, b) => Date.parse(b.signedAt) - Date.parse(a.signedAt));

  const signedPetitions = signatures.flatMap((signature) => {
    const petition = petitions.find((entry) => entry.id === signature.petitionId);

    if (!petition) {
      return [];
    }

    const sponsorName = sponsorshipRequests.find((request) => request.petitionId === petition.id)?.targetedOfficialNames[0] ?? null;
    const isDrafting = draftingPetitionIds.includes(petition.id);

    return [
      {
        petitionId: petition.id,
        title: petition.title,
        summary: petition.summary,
        status: isDrafting ? "Drafting" : mapLifecycleToProgressStatus(petition, sponsorName),
        sponsorName,
        signedAt: signature.signedAt,
      },
    ];
  });

  return {
    signedPetitions,
    progressingPetitions: signedPetitions.filter((petition) => petition.status !== "Active"),
  };
}
