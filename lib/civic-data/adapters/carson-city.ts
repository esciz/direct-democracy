import { DistrictType, JurisdictionType, OfficeLevel } from "@prisma/client";

import { buildOfficialsFoundation, officialsResult, type OfficialSeedRecord } from "@/lib/civic-data/adapters/foundation";
import { validateOfficialPages } from "@/lib/civic-data/adapters/official-page-records";
import type { CivicDataAdapter } from "@/lib/civic-data/types";

const CARSON_CONTACT_URL = "https://www.carsoncity.gov/government/board-of-supervisors/contact-us";

const baseRecord = {
  jurisdictionSlug: "carson-city",
  jurisdictionName: "Carson City",
  jurisdictionType: JurisdictionType.CITY,
  officeLevel: OfficeLevel.CITY,
  partyText: "Nonpartisan",
  websiteUrl: CARSON_CONTACT_URL,
  parentJurisdictionSlug: "nevada",
};

const records: OfficialSeedRecord[] = [
  {
    ...baseRecord,
    externalId: "carson-city-mayor",
    fullName: "Lori Bagwell",
    officeTitle: "Carson City Mayor",
    officeExternalId: "carson-city-office-mayor",
    phone: "(775) 283-7144",
  },
  {
    ...baseRecord,
    externalId: "carson-city-ward-1",
    fullName: "Stacey Giomi",
    officeTitle: "Carson City Supervisor Ward 1",
    officeExternalId: "carson-city-office-ward-1",
    districtExternalId: "carson-city-ward-1",
    districtName: "Carson City Ward 1",
    districtType: DistrictType.CITY_WARD,
    phone: "(775) 283-7582",
  },
  {
    ...baseRecord,
    externalId: "carson-city-ward-2",
    fullName: "Maurice \"Mo\" White",
    officeTitle: "Carson City Supervisor Ward 2",
    officeExternalId: "carson-city-office-ward-2",
    districtExternalId: "carson-city-ward-2",
    districtName: "Carson City Ward 2",
    districtType: DistrictType.CITY_WARD,
    phone: "(775) 283-7934",
  },
  {
    ...baseRecord,
    externalId: "carson-city-ward-3",
    fullName: "Curtis Horton",
    officeTitle: "Carson City Supervisor Ward 3",
    officeExternalId: "carson-city-office-ward-3",
    districtExternalId: "carson-city-ward-3",
    districtName: "Carson City Ward 3",
    districtType: DistrictType.CITY_WARD,
    phone: "(775) 283-7073",
  },
  {
    ...baseRecord,
    externalId: "carson-city-ward-4",
    fullName: "Lisa Schuette",
    officeTitle: "Carson City Supervisor Ward 4",
    officeExternalId: "carson-city-office-ward-4",
    districtExternalId: "carson-city-ward-4",
    districtName: "Carson City Ward 4",
    districtType: DistrictType.CITY_WARD,
    phone: "(775) 283-7933",
  },
];

export const carsonCityAdapter: CivicDataAdapter = {
  key: "carson-city",
  displayName: "Carson City",
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

