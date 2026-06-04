import { JurisdictionType, OfficeLevel } from "@prisma/client";

import { buildOfficialsFoundation, officialsResult, type OfficialSeedRecord } from "@/lib/civic-data/adapters/foundation";
import { validateOfficialPages } from "@/lib/civic-data/adapters/official-page-records";
import type { CivicDataAdapter } from "@/lib/civic-data/types";

const records: OfficialSeedRecord[] = [
  {
    externalId: "nevada-governor",
    fullName: "Joe Lombardo",
    officeTitle: "Governor of Nevada",
    jurisdictionSlug: "nevada",
    jurisdictionName: "Nevada",
    jurisdictionType: JurisdictionType.STATE,
    officeLevel: OfficeLevel.STATE,
    partyText: "Republican",
    websiteUrl: "https://gov.nv.gov/",
    phone: "(775) 684-5670",
    termStart: "2023-01-02",
    termEnd: "2027-01-04",
    parentJurisdictionSlug: "united-states",
  },
  {
    externalId: "nevada-lieutenant-governor",
    fullName: "Stavros Anthony",
    officeTitle: "Lieutenant Governor of Nevada",
    jurisdictionSlug: "nevada",
    jurisdictionName: "Nevada",
    jurisdictionType: JurisdictionType.STATE,
    officeLevel: OfficeLevel.STATE,
    partyText: "Republican",
    websiteUrl: "https://ltgov.nv.gov/",
    termStart: "2023-01-02",
    termEnd: "2027-01-04",
    parentJurisdictionSlug: "united-states",
  },
  {
    externalId: "nevada-secretary-of-state",
    fullName: "Cisco Aguilar",
    officeTitle: "Nevada Secretary of State",
    jurisdictionSlug: "nevada",
    jurisdictionName: "Nevada",
    jurisdictionType: JurisdictionType.STATE,
    officeLevel: OfficeLevel.STATE,
    partyText: "Democratic",
    websiteUrl: "https://www.nvsos.gov/sos",
    phone: "(775) 684-5708",
    termStart: "2023-01-02",
    termEnd: "2027-01-04",
    parentJurisdictionSlug: "united-states",
  },
  {
    externalId: "nevada-attorney-general",
    fullName: "Aaron D. Ford",
    officeTitle: "Nevada Attorney General",
    jurisdictionSlug: "nevada",
    jurisdictionName: "Nevada",
    jurisdictionType: JurisdictionType.STATE,
    officeLevel: OfficeLevel.STATE,
    partyText: "Democratic",
    websiteUrl: "https://ag.nv.gov/About/Attorney_General_Aaron_D__Ford/",
    phone: "(775) 684-1100",
    termStart: "2023-01-02",
    termEnd: "2027-01-04",
    parentJurisdictionSlug: "united-states",
  },
  {
    externalId: "nevada-treasurer",
    fullName: "Zach Conine",
    officeTitle: "Nevada State Treasurer",
    jurisdictionSlug: "nevada",
    jurisdictionName: "Nevada",
    jurisdictionType: JurisdictionType.STATE,
    officeLevel: OfficeLevel.STATE,
    partyText: "Democratic",
    websiteUrl: "https://www.nevadatreasurer.gov/",
    phone: "(775) 684-5600",
    termStart: "2023-01-02",
    termEnd: "2027-01-04",
    parentJurisdictionSlug: "united-states",
  },
  {
    externalId: "nevada-controller",
    fullName: "Andy Matthews",
    officeTitle: "Nevada State Controller",
    jurisdictionSlug: "nevada",
    jurisdictionName: "Nevada",
    jurisdictionType: JurisdictionType.STATE,
    officeLevel: OfficeLevel.STATE,
    partyText: "Republican",
    websiteUrl: "https://controller.nv.gov/",
    phone: "(775) 684-5750",
    termStart: "2023-01-02",
    termEnd: "2027-01-04",
    parentJurisdictionSlug: "united-states",
  },
];

export const nevadaStateGovernmentAdapter: CivicDataAdapter = {
  key: "nevada-state-government",
  displayName: "State of Nevada Constitutional Officers",
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

