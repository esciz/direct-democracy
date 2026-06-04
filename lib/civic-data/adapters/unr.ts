import { JurisdictionType, OfficeLevel } from "@prisma/client";

import { buildOfficialsFoundation, officialsResult, type OfficialSeedRecord } from "@/lib/civic-data/adapters/foundation";
import { validateOfficialPages } from "@/lib/civic-data/adapters/official-page-records";
import type { CivicDataAdapter } from "@/lib/civic-data/types";

const records: OfficialSeedRecord[] = [
  {
    externalId: "unr-president",
    fullName: "Brian Sandoval",
    officeTitle: "President of the University of Nevada, Reno",
    jurisdictionSlug: "unr",
    jurisdictionName: "University of Nevada, Reno",
    jurisdictionType: JurisdictionType.CAMPUS,
    officeExternalId: "unr-office-president",
    officeLevel: OfficeLevel.CAMPUS,
    websiteUrl: "https://www.unr.edu/president/biography",
    termStart: "2020-09-17",
    parentJurisdictionSlug: "nevada",
  },
];

export const unrAdapter: CivicDataAdapter = {
  key: "unr",
  displayName: "University of Nevada, Reno",
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

