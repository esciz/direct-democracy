import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { JurisdictionType, OfficeLevel, OfficialStatus, SourceSyncStatus, SourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, normalizeWhitespace, slugify } from "@/lib/public-meetings/shared";
import { surnameOf } from "@/lib/public-meetings/official-action-matcher";
import type {
  OfficialMeetingActionRecord,
  PublicBodyRecord,
  PublicMeetingItemRecord,
  PublicMeetingOfficialRosterReport,
  PublicMeetingOfficialRosterSeed,
  PublicMeetingRecord,
} from "@/lib/public-meetings/types";

async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const filePath = absolutePublicMeetingPath(relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJsonFile(relativePath: string, value: unknown) {
  const filePath = absolutePublicMeetingPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toJurisdictionType(value: PublicMeetingOfficialRosterSeed["jurisdictionType"]) {
  return JurisdictionType[value] ?? JurisdictionType.AGENCY;
}

function toOfficeLevel(value: PublicMeetingOfficialRosterSeed["officeLevel"]) {
  return OfficeLevel[value] ?? OfficeLevel.CITY;
}

function toOfficialStatus(value: string | null | undefined) {
  if (value === "FORMER") return OfficialStatus.FORMER;
  if (value === "ACTING") return OfficialStatus.ACTING;
  if (value === "ELECT") return OfficialStatus.ELECT;
  return OfficialStatus.CURRENT;
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function bodyMatchesSeed(body: PublicBodyRecord, seed: PublicMeetingOfficialRosterSeed) {
  const bodyText = normalizeWhitespace(`${body.name} ${body.jurisdiction}`).toLowerCase();
  const names = [seed.bodyName, seed.jurisdictionName, ...(seed.bodyAliases ?? [])].map((value) => normalizeWhitespace(value).toLowerCase()).filter(Boolean);
  return names.some((name) => bodyText.includes(name) || name.includes(body.name.toLowerCase()));
}

export async function getPublicMeetingOfficialRosterSeeds() {
  return readJsonFile<PublicMeetingOfficialRosterSeed[]>(PUBLIC_MEETING_PATHS.officialRosterSeeds, []);
}

export async function importPublicMeetingOfficialRosters() {
  const seeds = await getPublicMeetingOfficialRosterSeeds();
  let importedMembers = 0;

  for (const seed of seeds) {
    const jurisdiction = await prisma.jurisdiction.upsert({
      where: { slug: seed.jurisdictionSlug },
      create: {
        slug: seed.jurisdictionSlug,
        name: seed.jurisdictionName,
        type: toJurisdictionType(seed.jurisdictionType),
      },
      update: {
        name: seed.jurisdictionName,
        type: toJurisdictionType(seed.jurisdictionType),
      },
    });

    const source = await prisma.source.upsert({
      where: { slug: `public-meeting-roster-${slugify(seed.providerId)}-${slugify(seed.bodyName)}` },
      create: {
        slug: `public-meeting-roster-${slugify(seed.providerId)}-${slugify(seed.bodyName)}`,
        name: seed.sourceName,
        sourceType: SourceType.JSON,
        url: seed.sourceUrl,
        jurisdictionId: jurisdiction.id,
        adapterKey: "public-meeting-roster-seed",
        dataCategory: "official_roster",
        syncStatus: SourceSyncStatus.SUCCESS,
        lastSuccessAt: new Date(),
        lastSyncAt: new Date(),
        notes: seed.notes,
        metadata: {
          providerId: seed.providerId,
          bodyName: seed.bodyName,
          bodyAliases: seed.bodyAliases ?? [],
        },
      },
      update: {
        name: seed.sourceName,
        url: seed.sourceUrl,
        jurisdictionId: jurisdiction.id,
        syncStatus: SourceSyncStatus.SUCCESS,
        lastSuccessAt: new Date(),
        lastSyncAt: new Date(),
        notes: seed.notes,
        metadata: {
          providerId: seed.providerId,
          bodyName: seed.bodyName,
          bodyAliases: seed.bodyAliases ?? [],
        },
      },
    });

    const office = await prisma.office.upsert({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: `public-meeting-body:${seed.providerId}:${slugify(seed.bodyName)}`,
        },
      },
      create: {
        jurisdictionId: jurisdiction.id,
        sourceId: source.id,
        externalId: `public-meeting-body:${seed.providerId}:${slugify(seed.bodyName)}`,
        slug: `public-meeting-body-${slugify(seed.providerId)}-${slugify(seed.bodyName)}`,
        title: seed.officeTitle,
        level: toOfficeLevel(seed.officeLevel),
        selectionMethod: "UNKNOWN",
        seats: Math.max(seed.members.length, 1),
        description: `Roster seed for ${seed.bodyName}.`,
      },
      update: {
        title: seed.officeTitle,
        level: toOfficeLevel(seed.officeLevel),
        seats: Math.max(seed.members.length, 1),
        description: `Roster seed for ${seed.bodyName}.`,
      },
    });

    for (const member of seed.members) {
      await prisma.official.upsert({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: member.externalId,
          },
        },
        create: {
          sourceId: source.id,
          externalId: member.externalId,
          jurisdictionId: jurisdiction.id,
          officeId: office.id,
          fullName: member.fullName,
          status: toOfficialStatus(member.status),
          termStart: dateOrNull(member.termStart),
          termEnd: dateOrNull(member.termEnd),
        },
        update: {
          jurisdictionId: jurisdiction.id,
          officeId: office.id,
          fullName: member.fullName,
          status: toOfficialStatus(member.status),
          termStart: dateOrNull(member.termStart),
          termEnd: dateOrNull(member.termEnd),
        },
      });
      importedMembers += 1;
    }
  }

  return {
    seededRosterCount: seeds.length,
    seededMemberCount: seeds.reduce((total, seed) => total + seed.members.length, 0),
    importedMemberCount: importedMembers,
  };
}

function isSurnameOnly(value: string) {
  return normalizeWhitespace(value).split(/\s+/).filter(Boolean).length === 1;
}

export async function buildPublicMeetingRosterCoverageReport(extra?: { importedMemberCount?: number }) {
  const [seeds, bodies, meetings, items, actions, officials] = await Promise.all([
    getPublicMeetingOfficialRosterSeeds(),
    readJsonFile<PublicBodyRecord[]>(PUBLIC_MEETING_PATHS.bodies, []),
    readJsonFile<PublicMeetingRecord[]>(PUBLIC_MEETING_PATHS.meetings, []),
    readJsonFile<PublicMeetingItemRecord[]>(PUBLIC_MEETING_PATHS.meetingItems, []),
    readJsonFile<OfficialMeetingActionRecord[]>(PUBLIC_MEETING_PATHS.officialActions, []),
    prisma.official.findMany({
      include: { office: true, jurisdiction: true, source: true },
      take: 5000,
    }).catch(() => []),
  ]);
  const meetingsByBody = new Map<string, PublicMeetingRecord[]>();
  for (const meeting of meetings) meetingsByBody.set(meeting.public_body_id, [...(meetingsByBody.get(meeting.public_body_id) ?? []), meeting]);
  const bodyByMeetingId = new Map(meetings.map((meeting) => [meeting.id, meeting.public_body_id]));
  const itemByMeetingId = new Map<string, PublicMeetingItemRecord[]>();
  for (const item of items) itemByMeetingId.set(item.meeting_id, [...(itemByMeetingId.get(item.meeting_id) ?? []), item]);
  const actionsByBody = new Map<string, OfficialMeetingActionRecord[]>();
  for (const action of actions) {
    const bodyId = bodyByMeetingId.get(action.meeting_id);
    if (!bodyId) continue;
    actionsByBody.set(bodyId, [...(actionsByBody.get(bodyId) ?? []), action]);
  }

  const bodyReports = bodies.map((body) => {
    const bodyMeetings = meetingsByBody.get(body.id) ?? [];
    const bodyItems = bodyMeetings.flatMap((meeting) => itemByMeetingId.get(meeting.id) ?? []);
    const bodyActions = actionsByBody.get(body.id) ?? [];
    const surnameOnlyActions = [...new Set(bodyActions.filter((action) => isSurnameOnly(action.official_name_raw)).map((action) => action.official_name_raw))].sort();
    const matchingSeeds = seeds.filter((seed) => bodyMatchesSeed(body, seed));
    const seedSurnames = new Set(matchingSeeds.flatMap((seed) => seed.members.map((member) => member.surname.toLowerCase())));
    const dbOfficials = officials.filter((official) => {
      const bodyText = `${body.name} ${body.jurisdiction}`.toLowerCase();
      return bodyText.includes(official.jurisdiction.name.toLowerCase().split(",")[0]) || official.office.title.toLowerCase().includes(body.name.toLowerCase());
    });
    const dbSurnames = new Set(dbOfficials.map((official) => surnameOf(official.fullName)));
    const matchedSurnames = surnameOnlyActions.filter((surname) => seedSurnames.has(surname.toLowerCase()) || dbSurnames.has(surname.toLowerCase()));
    const missingSurnames = surnameOnlyActions.filter((surname) => !matchedSurnames.includes(surname));
    const rosterMemberCount = matchingSeeds.reduce((total, seed) => total + seed.members.length, 0) + dbOfficials.length;
    const coveragePercent = surnameOnlyActions.length ? Math.round((matchedSurnames.length / surnameOnlyActions.length) * 100) : rosterMemberCount ? 100 : 0;
    return {
      body_id: body.id,
      body_name: body.name,
      jurisdiction: body.jurisdiction,
      meeting_count: bodyMeetings.length,
      roll_call_review_items: bodyItems.filter((item) => item.roll_call_status === "needs_roll_call_review").length,
      surname_only_actions: surnameOnlyActions,
      roster_member_count: rosterMemberCount,
      matched_surnames: matchedSurnames,
      missing_surnames: missingSurnames,
      coverage_percent: coveragePercent,
      has_roster: rosterMemberCount > 0,
    };
  });

  const importedRosterMemberCount = officials.filter((official) => official.source?.adapterKey === "public-meeting-roster-seed").length;
  const report: PublicMeetingOfficialRosterReport = {
    generated_at: new Date().toISOString(),
    seeded_roster_count: seeds.length,
    seeded_member_count: seeds.reduce((total, seed) => total + seed.members.length, 0),
    imported_member_count: extra?.importedMemberCount ?? importedRosterMemberCount,
    body_reports: bodyReports,
  };
  await writeJsonFile(PUBLIC_MEETING_PATHS.officialRosterReport, report);
  return report;
}

export async function importAndReportPublicMeetingOfficialRosters() {
  const result = await importPublicMeetingOfficialRosters();
  const report = await buildPublicMeetingRosterCoverageReport({ importedMemberCount: result.importedMemberCount });
  return { ...result, report };
}
