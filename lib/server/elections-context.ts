import "server-only";

import { cookies } from "next/headers";

import {
  getAdminManagedProfiles as getAdminManagedProfilesBase,
  getAllCandidateCampaigns as getAllCandidateCampaignsBase,
  getAllOfficialPositions as getAllOfficialPositionsBase,
  getAllPublicProfiles as getAllPublicProfilesBase,
  getCandidateProfileById as getCandidateProfileByIdBase,
  getCandidateProfiles as getCandidateProfilesBase,
  getElectionById as getElectionByIdBase,
  getElectionSummaries as getElectionSummariesBase,
  getOfficialById as getOfficialByIdBase,
  getOfficials as getOfficialsBase,
  isStoredCandidateCampaign,
  isStoredOfficialPosition,
  isStoredPublicProfile,
  type ElectionsStoreContext,
} from "@/lib/elections/store";
import type {
  AdminManagedProfileSummary,
  CandidateCampaignSummary,
  CandidateProfileDetail,
  ElectionSummary,
  OfficialPositionSummary,
  OfficialProfileDetail,
  OfficialProfileSummary,
  PublicProfileSummary,
} from "@/types/domain";

const PUBLIC_PROFILES_COOKIE = "dd_public_profiles";
const CANDIDATE_CAMPAIGNS_COOKIE = "dd_candidate_campaigns";
const OFFICIAL_POSITIONS_COOKIE = "dd_official_positions";

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

export async function getStoredPublicProfiles() {
  return readCookieArray(PUBLIC_PROFILES_COOKIE, isStoredPublicProfile);
}

export async function setStoredPublicProfiles(profiles: PublicProfileSummary[]) {
  await writeCookieArray(PUBLIC_PROFILES_COOKIE, profiles.slice(0, 60));
}

export async function getStoredCandidateCampaigns() {
  return readCookieArray(CANDIDATE_CAMPAIGNS_COOKIE, isStoredCandidateCampaign);
}

export async function setStoredCandidateCampaigns(campaigns: CandidateCampaignSummary[]) {
  await writeCookieArray(CANDIDATE_CAMPAIGNS_COOKIE, campaigns.slice(0, 60));
}

export async function getStoredOfficialPositions() {
  return readCookieArray(OFFICIAL_POSITIONS_COOKIE, isStoredOfficialPosition);
}

export async function setStoredOfficialPositions(positions: OfficialPositionSummary[]) {
  await writeCookieArray(OFFICIAL_POSITIONS_COOKIE, positions.slice(0, 60));
}

async function getElectionsStoreContext(): Promise<ElectionsStoreContext> {
  const [storedProfiles, storedCampaigns, storedPositions] = await Promise.all([
    getStoredPublicProfiles(),
    getStoredCandidateCampaigns(),
    getStoredOfficialPositions(),
  ]);

  return {
    storedProfiles,
    storedCampaigns,
    storedPositions,
  };
}

export async function getAllPublicProfiles(): Promise<PublicProfileSummary[]> {
  const context = await getElectionsStoreContext();
  return getAllPublicProfilesBase(context.storedProfiles);
}

export async function getAllCandidateCampaigns(): Promise<CandidateCampaignSummary[]> {
  const context = await getElectionsStoreContext();
  return getAllCandidateCampaignsBase(context.storedCampaigns);
}

export async function getAllOfficialPositions(): Promise<OfficialPositionSummary[]> {
  const context = await getElectionsStoreContext();
  return getAllOfficialPositionsBase(context.storedPositions);
}

export async function getElectionSummaries(viewerId?: string): Promise<ElectionSummary[]> {
  return getElectionSummariesBase(viewerId, await getElectionsStoreContext());
}

export async function getElectionById(id: string, viewerId?: string): Promise<ElectionSummary | null> {
  return getElectionByIdBase(id, viewerId, await getElectionsStoreContext());
}

export async function getCandidateProfileById(id: string): Promise<CandidateProfileDetail | null> {
  return getCandidateProfileByIdBase(id, await getElectionsStoreContext());
}

export async function getCandidateProfiles() {
  return getCandidateProfilesBase(await getElectionsStoreContext());
}

export async function getOfficials(): Promise<OfficialProfileSummary[]> {
  return getOfficialsBase(await getElectionsStoreContext());
}

export async function getOfficialById(id: string): Promise<OfficialProfileDetail | null> {
  return getOfficialByIdBase(id, await getElectionsStoreContext());
}

export async function getAdminManagedProfiles(): Promise<AdminManagedProfileSummary[]> {
  return getAdminManagedProfilesBase(await getElectionsStoreContext());
}
