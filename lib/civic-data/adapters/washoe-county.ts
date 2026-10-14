import { DistrictType, JurisdictionType, OfficeLevel } from "@prisma/client";

import { buildOfficialsFoundation, officialsResult, type OfficialSeedRecord } from "@/lib/civic-data/adapters/foundation";
import { decodeHtml, fetchOfficialHtml, resolveOfficialUrl } from "@/lib/civic-data/adapters/html";
import type { CivicDataAdapter, IngestionIssue } from "@/lib/civic-data/types";

const WASHOE_PROFILE_URL = "https://www.washoecounty.gov/bcc/profile/index.php";

function toIsoDate(value: string) {
  const [month, day, year] = value.split("/");
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cleanCommissionerName(value: string) {
  return decodeHtml(value)
    .replace(/^Chair\s+/i, "")
    .replace(/^Vice Chair\s+/i, "")
    .replace(/^Commissioner\s+/i, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCommissioners(html: string): OfficialSeedRecord[] {
  const profileItems = html.match(/<li class="(?:profile|first)">[\s\S]*?<\/li>/g) ?? [];

  return profileItems.flatMap((item) => {
    const href = item.match(/<a href="([^"]+)">\s*<img/)?.[1];
    const imagePath = item.match(/<img[^>]+src="([^"]+)"/)?.[1];
    const linkedName = item.match(/<a href="[^"]+">([^<]+)<\/a><br\/>/)?.[1];
    const districtNumber = item.match(/District\s+(\d+)/)?.[1];
    const term = item.match(/Current Term:<\/h6>\s*([0-9/]+)\s*-\s*([0-9/]+)/);

    if (!linkedName || !districtNumber) {
      return [];
    }

    const districtExternalId = `washoe-county-commission-district-${districtNumber}`;

    return [
      {
        externalId: `washoe-county-commissioner-${districtNumber}`,
        fullName: cleanCommissionerName(linkedName),
        officeTitle: `Washoe County Commissioner District ${districtNumber}`,
        jurisdictionSlug: "washoe-county",
        jurisdictionName: "Washoe County",
        jurisdictionType: JurisdictionType.COUNTY,
        officeExternalId: `washoe-county-office-commissioner-${districtNumber}`,
        districtExternalId,
        districtName: `Washoe County Commission District ${districtNumber}`,
        districtType: DistrictType.COUNTY_COMMISSION,
        officeLevel: OfficeLevel.COUNTY,
        partyText: "Nonpartisan",
        websiteUrl: href ? resolveOfficialUrl(WASHOE_PROFILE_URL, href) : WASHOE_PROFILE_URL,
        photoUrl: imagePath ? resolveOfficialUrl(WASHOE_PROFILE_URL, imagePath) : undefined,
        termStart: term?.[1] ? toIsoDate(term[1]) : undefined,
        termEnd: term?.[2] ? toIsoDate(term[2]) : undefined,
        phone: "311 or (775) 328-2003",
        parentJurisdictionSlug: "nevada",
      },
    ];
  });
}

export const washoeCountyAdapter: CivicDataAdapter = {
  key: "washoe-county",
  displayName: "Washoe County",
  supportsIncremental: true,
  supportsScheduled: true,
  async sync(context) {
    const html = await fetchOfficialHtml(WASHOE_PROFILE_URL);
    const records = parseCommissioners(html);
    const issues: IngestionIssue[] = [];

    if (records.length !== 5) {
      issues.push({
        severity: "warning",
        message: `Washoe County importer expected 5 commissioners and parsed ${records.length}.`,
      });
    }

    return officialsResult({
      sourceSlug: context.source.slug,
      cursor: new Date().toISOString(),
      data: buildOfficialsFoundation(records),
      issues,
    });
  },
};
