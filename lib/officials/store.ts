import { getPublicOfficials, type PublicOfficialRow } from "@/lib/civic-data/public";
import type { OfficialProfileDetail, OfficialProfileSummary } from "@/types/domain";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type CurrentOfficialRuntimeRecord = {
  id: string;
  name: string;
  title?: string | null;
  office?: string | null;
  jurisdiction?: string | null;
  district?: string | null;
  party?: string | null;
  source_url?: string | null;
  source_label?: string | null;
  profile_url?: string | null;
  confidence?: number | null;
  review_status?: string | null;
};

function getDisplayJurisdictionName(slug: string, name: string) {
  if (slug === "reno") return "Reno, Nevada";
  if (slug === "washoe-county") return "Washoe County, Nevada";
  if (slug === "carson-city") return "Carson City, Nevada";
  if (slug === "united-states") return "United States";
  return name;
}

export function mapImportedOfficialToProfile(official: PublicOfficialRow): OfficialProfileSummary {
    const jurisdictionName = getDisplayJurisdictionName(official.jurisdiction.slug, official.jurisdiction.name);

    return {
      id: official.id,
      claimedByUserId: null,
      name: official.fullName,
      officeTitle: official.office.title,
      jurisdictionName,
      party: official.partyText ?? "Nonpartisan",
      bio: official.websiteEnrichment?.shortBio ?? null,
      profileImageUrl: official.photoUrl,
      platformSummary: null,
      websiteUrl: official.websiteUrl,
      email: official.email,
      phone: official.phone,
      districtName: official.district?.name ?? null,
      sourceLabel: official.source?.name ?? "Imported Nevada beta data",
      sourceUrl: official.source?.url ?? null,
      isClaimed: true,
      followerCount: 0,
      followThroughScore: null,
      truthScore: {
        media: null,
        moderators: null,
        citizens: null,
      },
    };
}

async function getImportedOfficials(): Promise<OfficialProfileSummary[]> {
  return (await getPublicOfficials()).map((official) => mapImportedOfficialToProfile(official));
}

async function getOfficialProfilesFallback(): Promise<OfficialProfileSummary[]> {
  const { getOfficials: getOfficialProfiles } = await import("@/lib/server/elections-context");
  return getOfficialProfiles();
}

function getGeneratedCurrentOfficialById(id: string): OfficialProfileSummary | null {
  const filePath = path.join(process.cwd(), "data", "generated", "nevada-community-officials.json");
  if (!existsSync(filePath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as { records?: CurrentOfficialRuntimeRecord[] } | CurrentOfficialRuntimeRecord[];
    const records = Array.isArray(parsed) ? parsed : parsed.records ?? [];
    const official = records.find((record) => record.id === id);

    if (!official) return null;

    const officeTitle = official.title ?? official.office ?? "Officeholder";
    const jurisdictionName = official.jurisdiction ?? "Nevada";
    const sourceLabel = official.source_label ?? "Generated Nevada current-officeholder source";
    const sourceUrl = official.source_url ?? official.profile_url ?? null;

    return {
      id: official.id,
      claimedByUserId: null,
      name: official.name,
      officeTitle,
      jurisdictionName,
      party: official.party ?? "Nonpartisan",
      bio: `${official.name} is listed as ${officeTitle} for ${jurisdictionName} in the generated Nevada current-officeholder index.`,
      profileImageUrl: null,
      platformSummary: "Source-backed current-officeholder profile. Additional accountability activity appears as meeting, vote, and issue links are reviewed.",
      donationUrl: null,
      websiteUrl: official.profile_url ?? sourceUrl,
      email: null,
      phone: null,
      districtName: official.district ?? null,
      sourceLabel,
      sourceUrl,
      isClaimed: true,
      followerCount: 0,
      followThroughScore: official.confidence ?? null,
      truthScore: {
        media: null,
        moderators: null,
        citizens: null,
      },
    };
  } catch (error) {
    console.error("[officials-store] generated current official fallback failed", error);
    return null;
  }
}

export async function getOfficials(options: { allowDemoFallback?: boolean } = {}): Promise<OfficialProfileSummary[]> {
  const allowDemoFallback = options.allowDemoFallback ?? false;

  try {
    const importedOfficials = await getImportedOfficials();

    if (importedOfficials.length > 0) {
      return importedOfficials;
    }
  } catch (error) {
    console.error("[officials-store] imported officials fallback", error);
  }

  return allowDemoFallback ? getOfficialProfilesFallback() : [];
}

export async function getOfficialById(id: string): Promise<OfficialProfileDetail | null> {
  const official = (await getOfficials()).find((entry) => entry.id === id) ?? getGeneratedCurrentOfficialById(id);

  if (official) {
    return {
      ...official,
      recentPosts: [],
      linkedUserId: official.claimedByUserId,
      followingCount: 0,
      viewerIsFollowing: false,
      viewerCanFollow: false,
      campaignPromises: [],
      officialActions: [],
    };
  }

  return null;
}
