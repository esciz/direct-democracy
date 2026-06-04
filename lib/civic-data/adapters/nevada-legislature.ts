import { DistrictType, JurisdictionType, OfficeLevel } from "@prisma/client";

import { buildOfficialsFoundation, officialsResult, type OfficialSeedRecord } from "@/lib/civic-data/adapters/foundation";
import { decodeCloudflareEmail, decodeHtml, fetchOfficialHtml, firstMatch, resolveOfficialUrl } from "@/lib/civic-data/adapters/html";
import type { CivicDataAdapter, IngestionIssue } from "@/lib/civic-data/types";

const LEGISLATURE_BASE_URL = "https://www.leg.state.nv.us";
const ASSEMBLY_URL = `${LEGISLATURE_BASE_URL}/App/Legislator/A/Assembly/Current`;
const SENATE_URL = `${LEGISLATURE_BASE_URL}/App/Legislator/A/Senate/Current`;

type LegislativeChamber = {
  chamber: "Assembly" | "Senate";
  url: string;
  expectedCount: number;
  districtType: DistrictType;
};

const chambers: LegislativeChamber[] = [
  { chamber: "Assembly", url: ASSEMBLY_URL, expectedCount: 42, districtType: DistrictType.STATE_ASSEMBLY },
  { chamber: "Senate", url: SENATE_URL, expectedCount: 21, districtType: DistrictType.STATE_SENATE },
];

function parseLegislatorRows(html: string, chamber: LegislativeChamber): OfficialSeedRecord[] {
  const rows = html.match(/<tr class="thisRow listRow[\s\S]*?<\/tr>\s*<tr class="thisRow">[\s\S]*?<\/tr>/g) ?? [];

  return rows.flatMap((row) => {
    const name = firstMatch(row, /<td data-order="([^"]+)" class="text-center">\s*<span[\s\S]*?<\/td>/);
    const partyText = firstMatch(row, /<td data-order="([^"]+)" class="text-center">\s*<a href="[^"]+">\1<\/a>\s*<\/td>\s*<td data-order="No\./);
    const districtNumber = firstMatch(row, /<td data-order="No\. ([^"]+)"/);
    const profilePath = row.match(/<a href="([^"]+Current\/[^"]+)"/)?.[1];
    const photoPath = row.match(/<img src="([^"]+)"/)?.[1];
    const termEndYear = firstMatch(row, /<span class="fieldName">Term Ends:<\/span>&nbsp;<span class="field">([^<]+)<\/span>/);
    const phone = firstMatch(row, /<span class="fieldName">Carson City Phone:<\/span> <span class="field">([^<]+)<\/span>/);
    const encodedEmail = row.match(/data-cfemail="([^"]+)"/)?.[1];
    const email = encodedEmail ? decodeCloudflareEmail(encodedEmail) : undefined;

    if (!name || !districtNumber || !profilePath) {
      return [];
    }

    const chamberSlug = chamber.chamber.toLowerCase();
    const districtExternalId = `nevada-${chamberSlug}-district-${districtNumber}`;
    const officeExternalId = `nevada-${chamberSlug}-office-${districtNumber}`;

    return [
      {
        externalId: `nevada-legislature-${chamberSlug}-${districtNumber}`,
        fullName: decodeHtml(name),
        officeTitle: `Nevada ${chamber.chamber} District ${districtNumber}`,
        jurisdictionSlug: "nevada",
        jurisdictionName: "Nevada",
        jurisdictionType: JurisdictionType.STATE,
        officeExternalId,
        districtExternalId,
        districtName: `${chamber.chamber} District ${districtNumber}`,
        districtType: chamber.districtType,
        officeLevel: OfficeLevel.STATE,
        partyText,
        websiteUrl: resolveOfficialUrl(chamber.url, profilePath),
        email,
        phone,
        photoUrl: photoPath ? resolveOfficialUrl(chamber.url, photoPath) : undefined,
        termEnd: termEndYear ? `${termEndYear}-12-31` : undefined,
        parentJurisdictionSlug: "united-states",
      },
    ];
  });
}

export const nevadaLegislatureAdapter: CivicDataAdapter = {
  key: "nevada-legislature",
  displayName: "Nevada Legislature",
  supportsIncremental: true,
  supportsScheduled: true,
  async sync(context) {
    const issues: IngestionIssue[] = [];
    const records: OfficialSeedRecord[] = [];

    for (const chamber of chambers) {
      const html = await fetchOfficialHtml(chamber.url);
      const chamberRecords = parseLegislatorRows(html, chamber);
      records.push(...chamberRecords);

      if (chamberRecords.length !== chamber.expectedCount) {
        issues.push({
          severity: "warning",
          message: `${chamber.chamber} importer expected ${chamber.expectedCount} officials and parsed ${chamberRecords.length}.`,
        });
      }
    }

    return officialsResult({
      sourceSlug: context.source.slug,
      cursor: new Date().toISOString(),
      data: buildOfficialsFoundation(records),
      issues,
    });
  },
};

