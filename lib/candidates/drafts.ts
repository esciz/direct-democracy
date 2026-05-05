import { cookies } from "next/headers";

import { getElectionById, getElectionSummaries } from "@/lib/server/elections-context";
import type { AuthUser, CampaignPromiseSummary, CandidateDraftSummary, RunForOfficeOpportunitySummary } from "@/types/domain";

const CANDIDATE_DRAFTS_COOKIE = "dd_candidate_drafts";

function isCampaignPromise(value: unknown): value is CampaignPromiseSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const promise = value as Record<string, unknown>;
  return (
    typeof promise.id === "string" &&
    typeof promise.title === "string" &&
    typeof promise.description === "string" &&
    (typeof promise.category === "undefined" || promise.category === null || typeof promise.category === "string")
  );
}

function isCandidateDraft(value: unknown): value is CandidateDraftSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const draft = value as Record<string, unknown>;
  return (
    typeof draft.id === "string" &&
    typeof draft.userId === "string" &&
    typeof draft.electionId === "string" &&
    typeof draft.officeSought === "string" &&
    typeof draft.electionTitle === "string" &&
    typeof draft.jurisdictionName === "string" &&
    typeof draft.electionDate === "string" &&
    (typeof draft.bio === "string" || draft.bio === null) &&
    Array.isArray(draft.campaignPromises) &&
    draft.campaignPromises.every(isCampaignPromise) &&
    typeof draft.isPublished === "boolean" &&
    (typeof draft.publishedCandidateProfileId === "undefined" ||
      draft.publishedCandidateProfileId === null ||
      typeof draft.publishedCandidateProfileId === "string") &&
    typeof draft.createdAt === "string" &&
    typeof draft.updatedAt === "string"
  );
}

export async function getStoredCandidateDrafts() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CANDIDATE_DRAFTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCandidateDraft) : [];
  } catch {
    return [];
  }
}

export async function setStoredCandidateDrafts(drafts: CandidateDraftSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(CANDIDATE_DRAFTS_COOKIE, JSON.stringify(drafts.slice(0, 24)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getCandidateDraftForUser(userId: string, electionId: string) {
  return (await getStoredCandidateDrafts()).find((draft) => draft.userId === userId && draft.electionId === electionId) ?? null;
}

export async function getLatestCandidateDraftForUser(userId: string) {
  return [...(await getStoredCandidateDrafts())]
    .filter((draft) => draft.userId === userId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null;
}

export async function upsertCandidateDraft(nextDraft: CandidateDraftSummary) {
  const drafts = await getStoredCandidateDrafts();
  const nextDrafts = [
    nextDraft,
    ...drafts.filter((draft) => !(draft.userId === nextDraft.userId && draft.electionId === nextDraft.electionId)),
  ];

  await setStoredCandidateDrafts(nextDrafts);
}

function electionMatchesUserCommunity(user: AuthUser, jurisdictionName: string) {
  return (
    jurisdictionName === user.jurisdictionName ||
    jurisdictionName === "Nevada" ||
    jurisdictionName === "United States"
  );
}

function getElectionBasicInfo(jurisdictionName: string, officeTitle: string) {
  if (jurisdictionName === "Nevada") {
    return `${officeTitle} is a statewide race that shapes policy across Nevada.`;
  }

  if (jurisdictionName === "United States") {
    return `${officeTitle} is a national race with broad public visibility and larger filing requirements.`;
  }

  return `${officeTitle} is a local race with direct impact on day-to-day issues in ${jurisdictionName}.`;
}

export async function getRunForOfficeOpportunities(user: AuthUser): Promise<RunForOfficeOpportunitySummary[]> {
  const [elections, drafts] = await Promise.all([getElectionSummaries(), getStoredCandidateDrafts()]);
  const relevant = elections.filter((election) => electionMatchesUserCommunity(user, election.jurisdictionName));
  const source = relevant.length ? relevant : elections;

  return source.map((election) => {
    const draft = drafts.find((entry) => entry.userId === user.id && entry.electionId === election.id);

    return {
      electionId: election.id,
      electionSlug: election.slug,
      title: election.title,
      officeTitle: election.officeTitle,
      jurisdictionName: election.jurisdictionName,
      electionDate: election.electionDate,
      electionType: election.electionType,
      electionStatus: election.electionStatus,
      basicInfo: getElectionBasicInfo(election.jurisdictionName, election.officeTitle),
      hasExistingDraft: Boolean(draft && !draft.isPublished),
      publishedCandidateProfileId: draft?.publishedCandidateProfileId ?? null,
    };
  });
}

export async function buildDefaultCandidateDraft(user: AuthUser, electionId: string): Promise<CandidateDraftSummary | null> {
  const existingDraft = await getCandidateDraftForUser(user.id, electionId);

  if (existingDraft) {
    return existingDraft;
  }

  const election = await getElectionById(electionId);

  if (!election) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: `candidate_draft_${user.id}_${election.id}`,
    userId: user.id,
    electionId: election.id,
    officeSought: election.officeTitle,
    electionTitle: election.title,
    jurisdictionName: election.jurisdictionName,
    electionDate: election.electionDate,
    bio: user.bio,
    campaignPromises: [],
    isPublished: false,
    publishedCandidateProfileId: null,
    createdAt: now,
    updatedAt: now,
  };
}
