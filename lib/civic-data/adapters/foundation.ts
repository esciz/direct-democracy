import {
  DistrictType,
  JurisdictionType,
  OfficeLevel,
  OfficeSelectionMethod,
  OfficialStatus,
  SourceSyncStatus,
} from "@prisma/client";

import { createEmptyNormalizedCivicData } from "@/lib/civic-data/normalized";
import type {
  IngestionIssue,
  IngestionResult,
  NormalizedCivicData,
  NormalizedDistrict,
  NormalizedJurisdiction,
  NormalizedOffice,
  NormalizedOfficial,
} from "@/lib/civic-data/types";

export type OfficialSeedRecord = {
  externalId: string;
  fullName: string;
  officeTitle: string;
  jurisdictionSlug: string;
  jurisdictionName: string;
  jurisdictionType: JurisdictionType;
  officeExternalId?: string;
  districtExternalId?: string;
  districtName?: string;
  districtType?: DistrictType;
  officeLevel: OfficeLevel;
  partyText?: string;
  websiteUrl?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  termStart?: string;
  termEnd?: string;
  status?: OfficialStatus;
  parentJurisdictionSlug?: string;
};

export function buildOfficialsFoundation(records: OfficialSeedRecord[]): NormalizedCivicData {
  const data = createEmptyNormalizedCivicData();
  const jurisdictions = new Map<string, NormalizedJurisdiction>();
  const districts = new Map<string, NormalizedDistrict>();
  const offices = new Map<string, NormalizedOffice>();
  const officials = new Map<string, NormalizedOfficial>();

  for (const record of records) {
    jurisdictions.set(record.jurisdictionSlug, {
      externalId: record.jurisdictionSlug,
      name: record.jurisdictionName,
      slug: record.jurisdictionSlug,
      type: record.jurisdictionType,
      parentSlug: record.parentJurisdictionSlug,
    });

    const officeExternalId = record.officeExternalId ?? record.externalId;

    if (record.districtExternalId && record.districtName && record.districtType) {
      districts.set(record.districtExternalId, {
        externalId: record.districtExternalId,
        jurisdictionSlug: record.jurisdictionSlug,
        slug: record.districtExternalId,
        name: record.districtName,
        districtType: record.districtType,
      });
    }

    offices.set(officeExternalId, {
      externalId: officeExternalId,
      jurisdictionSlug: record.jurisdictionSlug,
      districtExternalId: record.districtExternalId,
      slug: officeExternalId,
      title: record.officeTitle,
      level: record.officeLevel,
      selectionMethod: OfficeSelectionMethod.ELECTED,
      seats: 1,
    });

    officials.set(record.externalId, {
      externalId: record.externalId,
      officeExternalId,
      jurisdictionSlug: record.jurisdictionSlug,
      districtExternalId: record.districtExternalId,
      fullName: record.fullName,
      partyText: record.partyText,
      email: record.email,
      phone: record.phone,
      websiteUrl: record.websiteUrl,
      photoUrl: record.photoUrl,
      status: record.status ?? OfficialStatus.CURRENT,
      termStart: record.termStart,
      termEnd: record.termEnd,
    });
  }

  data.jurisdictions = [...jurisdictions.values()];
  data.districts = [...districts.values()];
  data.offices = [...offices.values()];
  data.officials = [...officials.values()];

  return data;
}

export function officialsResult({
  sourceSlug,
  data,
  issues = [],
  cursor,
}: {
  sourceSlug: string;
  data: NormalizedCivicData;
  issues?: IngestionIssue[];
  cursor?: string | null;
}): IngestionResult {
  const recordsSeen = data.jurisdictions.length + data.districts.length + data.offices.length + data.officials.length;

  return {
    sourceSlug,
    status: SourceSyncStatus.SUCCESS,
    cursor: cursor ?? null,
    data,
    issues,
    recordsSeen,
    recordsChanged: 0,
  };
}
