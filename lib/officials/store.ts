import { getPublicOfficials, type PublicOfficialRow } from "@/lib/civic-data/public";
import type { OfficialProfileDetail, OfficialProfileSummary } from "@/types/domain";

function getDisplayJurisdictionName(slug: string, name: string) {
  if (slug === "reno") return "Reno, Nevada";
  if (slug === "washoe-county") return "Washoe County, Nevada";
  if (slug === "carson-city") return "Carson City, Nevada";
  if (slug === "united-states") return "United States";
  return name;
}

function getOfficialBio({
  name,
  officeTitle,
  jurisdictionName,
  districtName,
  partyText,
}: {
  name: string;
  officeTitle: string;
  jurisdictionName: string;
  districtName?: string | null;
  partyText?: string | null;
}) {
  const district = districtName ? ` representing ${districtName}` : "";
  const party = partyText ? ` Party: ${partyText}.` : "";
  return `${name} is listed in the Nevada beta official importer as ${officeTitle}${district} for ${jurisdictionName}.${party}`;
}

export function mapImportedOfficialToProfile(official: PublicOfficialRow): OfficialProfileSummary {
    const jurisdictionName = getDisplayJurisdictionName(official.jurisdiction.slug, official.jurisdiction.name);
    const bio = getOfficialBio({
      name: official.fullName,
      officeTitle: official.office.title,
      jurisdictionName,
      districtName: official.district?.name,
      partyText: official.partyText,
    });

    return {
      id: official.id,
      claimedByUserId: null,
      name: official.fullName,
      officeTitle: official.office.title,
      jurisdictionName,
      party: official.partyText ?? "Nonpartisan",
      bio,
      profileImageUrl: official.photoUrl,
      platformSummary: "Imported Nevada beta data from official government sources. Accountability activity will appear as this profile is claimed or linked to platform actions.",
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

export async function getOfficials(options: { allowDemoFallback?: boolean } = {}): Promise<OfficialProfileSummary[]> {
  const allowDemoFallback = options.allowDemoFallback ?? true;

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
  const official = (await getOfficials()).find((entry) => entry.id === id);

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

  const { getOfficialById: getOfficialProfileById } = await import("@/lib/server/elections-context");
  return getOfficialProfileById(id);
}
