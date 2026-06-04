import { JurisdictionType, OfficeLevel, OfficialStatus } from "@prisma/client";

import { buildOfficialsFoundation, officialsResult, type OfficialSeedRecord } from "@/lib/civic-data/adapters/foundation";
import { decodeHtml, fetchOfficialHtml } from "@/lib/civic-data/adapters/html";
import type { CivicDataAdapter, IngestionIssue } from "@/lib/civic-data/types";

const ASUN_ELECTION_RESULTS_URL = "https://nevadaasun.com/asun-2026-elections-results/";

function parseAsunElectionResults(html: string): OfficialSeedRecord[] {
  const presidentMatch = html.match(/ASUN President-Elect \(1\)[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  const vicePresidentMatch = html.match(/ASUN Vice President-Elect \(1\)[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  const baseRecord = {
    jurisdictionSlug: "asun",
    jurisdictionName: "Associated Students of the University of Nevada",
    jurisdictionType: JurisdictionType.STUDENT_GOVERNMENT,
    officeLevel: OfficeLevel.STUDENT_GOVERNMENT,
    partyText: "Nonpartisan",
    websiteUrl: ASUN_ELECTION_RESULTS_URL,
    status: OfficialStatus.ELECT,
    parentJurisdictionSlug: "unr",
  };

  const records: OfficialSeedRecord[] = [];

  const presidentName = presidentMatch?.[1] ? decodeHtml(presidentMatch[1]).split(/–|-|&#8211;/)[0]?.trim() : undefined;
  const vicePresidentName = vicePresidentMatch?.[1] ? decodeHtml(vicePresidentMatch[1]).split(/–|-|&#8211;/)[0]?.trim() : undefined;

  if (presidentName) {
    records.push({
      ...baseRecord,
      externalId: "asun-president-elect-2026",
      fullName: presidentName,
      officeTitle: "ASUN President-Elect",
      officeExternalId: "asun-office-president",
    });
  }

  if (vicePresidentName) {
    records.push({
      ...baseRecord,
      externalId: "asun-vice-president-elect-2026",
      fullName: vicePresidentName,
      officeTitle: "ASUN Vice President-Elect",
      officeExternalId: "asun-office-vice-president",
    });
  }

  return records;
}

export const asunAdapter: CivicDataAdapter = {
  key: "asun",
  displayName: "Associated Students of the University of Nevada",
  supportsIncremental: true,
  supportsScheduled: true,
  async sync(context) {
    const html = await fetchOfficialHtml(ASUN_ELECTION_RESULTS_URL);
    const records = parseAsunElectionResults(html);
    const issues: IngestionIssue[] = [];

    if (records.length === 0) {
      issues.push({
        severity: "warning",
        message: "ASUN election results page was fetched, but no president-elect or vice-president-elect records were parsed.",
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
