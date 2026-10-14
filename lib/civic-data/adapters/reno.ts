import { DistrictType, JurisdictionType, OfficeLevel } from "@prisma/client";

import { buildOfficialsFoundation, officialsResult, type OfficialSeedRecord } from "@/lib/civic-data/adapters/foundation";
import { validateOfficialPages } from "@/lib/civic-data/adapters/official-page-records";
import type { CivicDataAdapter } from "@/lib/civic-data/types";

const RENO_COUNCIL_URL = "https://www.reno.gov/government/city-council";

const baseRecord = {
  jurisdictionSlug: "reno",
  jurisdictionName: "Reno",
  jurisdictionType: JurisdictionType.CITY,
  officeLevel: OfficeLevel.CITY,
  partyText: "Nonpartisan",
  websiteUrl: RENO_COUNCIL_URL,
  phone: "(775) 334-4636",
  parentJurisdictionSlug: "washoe-county",
} satisfies Partial<OfficialSeedRecord>;

const records: OfficialSeedRecord[] = [
  {
    ...baseRecord,
    externalId: "reno-mayor",
    fullName: "Hillary Schieve",
    officeTitle: "Reno Mayor",
    officeExternalId: "reno-office-mayor",
    email: "schieveh@reno.gov",
  },
  {
    ...baseRecord,
    externalId: "reno-ward-1",
    fullName: "Kathleen Taylor",
    officeTitle: "Reno City Council Ward 1",
    officeExternalId: "reno-office-ward-1",
    districtExternalId: "reno-ward-1",
    districtName: "Reno Ward 1",
    districtType: DistrictType.CITY_WARD,
    email: "taylork@reno.gov",
  },
  {
    ...baseRecord,
    externalId: "reno-ward-2",
    fullName: "Naomi Duerr",
    officeTitle: "Reno City Council Ward 2",
    officeExternalId: "reno-office-ward-2",
    districtExternalId: "reno-ward-2",
    districtName: "Reno Ward 2",
    districtType: DistrictType.CITY_WARD,
    email: "duerrn@reno.gov",
  },
  {
    ...baseRecord,
    externalId: "reno-ward-3",
    fullName: "Miguel Martinez",
    officeTitle: "Reno City Council Ward 3",
    officeExternalId: "reno-office-ward-3",
    districtExternalId: "reno-ward-3",
    districtName: "Reno Ward 3",
    districtType: DistrictType.CITY_WARD,
    email: "martinezm@reno.gov",
  },
  {
    ...baseRecord,
    externalId: "reno-ward-4",
    fullName: "Meghan Ebert",
    officeTitle: "Reno City Council Ward 4",
    officeExternalId: "reno-office-ward-4",
    districtExternalId: "reno-ward-4",
    districtName: "Reno Ward 4",
    districtType: DistrictType.CITY_WARD,
    email: "ebertm@reno.gov",
  },
  {
    ...baseRecord,
    externalId: "reno-ward-5",
    fullName: "Devon Reese",
    officeTitle: "Reno City Council Ward 5",
    officeExternalId: "reno-office-ward-5",
    districtExternalId: "reno-ward-5",
    districtName: "Reno Ward 5",
    districtType: DistrictType.CITY_WARD,
    email: "reesed@reno.gov",
  },
  {
    ...baseRecord,
    externalId: "reno-ward-6",
    fullName: "Brandi Anderson",
    officeTitle: "Reno City Council Ward 6",
    officeExternalId: "reno-office-ward-6",
    districtExternalId: "reno-ward-6",
    districtName: "Reno Ward 6",
    districtType: DistrictType.CITY_WARD,
    email: "andersonb@reno.gov",
  },
];

export const renoAdapter: CivicDataAdapter = {
  key: "reno",
  displayName: "Reno",
  supportsIncremental: true,
  supportsScheduled: true,
  async sync(context) {
    const issues = await validateOfficialPages(records);

    return officialsResult({
      sourceSlug: context.source.slug,
      cursor: new Date().toISOString(),
      data: buildOfficialsFoundation(records),
      issues,
    });
  },
};
