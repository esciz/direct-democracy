#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { CandidateStatus, CivicRecordReviewStatus, ElectionResultStatus, ElectionStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_FILE = "data/manual-sources/election-results/2026-nevada-statewide-primary.json";

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg === `--${name}` || arg.startsWith(prefix));
  if (!found) return fallback;
  return found === `--${name}` ? "true" : found.slice(prefix.length);
}

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\bjoe\b/g, "joseph")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 1)
    .sort()
    .join(" ");
}

function matchesAlias(value, aliases) {
  const normalized = normalizeName(value);
  return aliases.some((alias) => normalizeName(alias) === normalized);
}

function assertHttps(value, label) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error(`${label} must use HTTPS.`);
  return parsed.toString();
}

function validateManifest(manifest) {
  if (manifest?.version !== 1 || !manifest.primaryElectionSlug || !manifest.generalElectionSlug || !manifest.contests?.length) {
    throw new Error("Reviewed election result manifest must use version 1 and include election slugs and contests.");
  }
  if (!Object.values(ElectionResultStatus).includes(manifest.resultStatus)) {
    throw new Error(`Unsupported election result status: ${manifest.resultStatus}`);
  }
  for (const source of [manifest.sources?.results, manifest.sources?.officialIndex]) {
    if (!source?.name || !source.slug || !source.url) throw new Error("Result source definitions are incomplete.");
    source.url = assertHttps(source.url, source.name);
  }
  manifest.sources.officialStatewidePortalUrl = assertHttps(manifest.sources.officialStatewidePortalUrl, "Official statewide portal");
  manifest.sources.crossCheckUrl = assertHttps(manifest.sources.crossCheckUrl, "Cross-check URL");
  for (const contest of manifest.contests) {
    if (!contest.key || !contest.officeContains || !contest.partyText || !contest.winnerAliases?.length || !Number.isInteger(contest.winnerVotes) || !Number.isInteger(contest.contestVotes)) {
      throw new Error(`Contest ${contest.key ?? "unknown"} is incomplete.`);
    }
    if (contest.winnerVotes < 0 || contest.contestVotes <= 0 || contest.winnerVotes > contest.contestVotes) {
      throw new Error(`Contest ${contest.key} has invalid vote totals.`);
    }
  }
}

async function upsertSource(definition, jurisdictionId, { sourceType, notes }) {
  const now = new Date();
  return prisma.source.upsert({
    where: { slug: definition.slug },
    create: {
      name: definition.name,
      slug: definition.slug,
      sourceType,
      url: definition.url,
      jurisdictionId,
      adapterKey: "manual-reviewed-election-result-bridge",
      dataCategory: "election_results",
      accessMethod: "html",
      refreshFrequency: "after each election update",
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastSyncAt: now,
      syncStatus: "SUCCESS",
      notes,
    },
    update: {
      name: definition.name,
      sourceType,
      url: definition.url,
      jurisdictionId,
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastSyncAt: now,
      syncStatus: "SUCCESS",
      errorLog: null,
      notes,
    },
  });
}

async function upsertAttribution({ candidateId, fieldName, source, sourceRow, manifest, contest }) {
  const now = new Date();
  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: "CANDIDATE",
        entityId: candidateId,
        fieldName,
        sourceUrl: source.url,
      },
    },
    create: {
      entityType: "CANDIDATE",
      entityId: candidateId,
      fieldName,
      sourceId: sourceRow.id,
      sourceName: source.name,
      sourceUrl: source.url,
      fieldsDerived: json(["primary winner status", "winner vote total", "general-election advancement"]),
      confidenceScore: 0.94,
      reviewStatus: CivicRecordReviewStatus.verified,
      lastImportedAt: now,
      verifiedAt: now,
      metadata: json({
        importMethod: "reviewed_election_result_manifest_v1",
        contestKey: contest.key,
        resultStatus: manifest.resultStatus,
        officialIndexUrl: manifest.sources.officialIndex.url,
        officialStatewidePortalUrl: manifest.sources.officialStatewidePortalUrl,
        crossCheckUrl: manifest.sources.crossCheckUrl,
        certificationArtifactStored: false,
      }),
    },
    update: {
      sourceId: sourceRow.id,
      sourceName: source.name,
      fieldsDerived: json(["primary winner status", "winner vote total", "general-election advancement"]),
      confidenceScore: 0.94,
      reviewStatus: CivicRecordReviewStatus.verified,
      lastImportedAt: now,
      verifiedAt: now,
      metadata: json({
        importMethod: "reviewed_election_result_manifest_v1",
        contestKey: contest.key,
        resultStatus: manifest.resultStatus,
        officialIndexUrl: manifest.sources.officialIndex.url,
        officialStatewidePortalUrl: manifest.sources.officialStatewidePortalUrl,
        crossCheckUrl: manifest.sources.crossCheckUrl,
        certificationArtifactStored: false,
      }),
    },
  });
}

async function flagCertificationPending(candidateId, sourceId, manifest) {
  const note = `General-election advancement is supported by reviewed primary results, but the statewide certification artifact has not been stored. Official portal: ${manifest.sources.officialStatewidePortalUrl}`;
  const existing = await prisma.dataQualityIssue.findFirst({
    where: {
      recordType: "CANDIDATE",
      recordId: candidateId,
      issueType: "missing_required_field",
      status: { in: ["open", "in_review"] },
      notes: { contains: "statewide certification artifact" },
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.dataQualityIssue.update({ where: { id: existing.id }, data: { sourceId, severity: "warning", notes: note } });
    return;
  }
  await prisma.dataQualityIssue.create({
    data: {
      sourceId,
      recordType: "CANDIDATE",
      recordId: candidateId,
      issueType: "missing_required_field",
      severity: "warning",
      status: "open",
      notes: note,
    },
  });
}

async function copyCandidateAttributions(fromCandidateId, toCandidateId, fieldNames) {
  const rows = await prisma.sourceAttribution.findMany({
    where: {
      entityType: "CANDIDATE",
      entityId: fromCandidateId,
      fieldName: { in: fieldNames },
      sourceUrl: { not: null },
    },
  });
  const now = new Date();
  for (const row of rows) {
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? { ...row.metadata, copiedFromCandidateId: fromCandidateId, copyReason: "primary_winner_promoted_to_general" }
      : { copiedFromCandidateId: fromCandidateId, copyReason: "primary_winner_promoted_to_general" };
    const data = {
      sourceId: row.sourceId,
      sourceName: row.sourceName,
      fieldsDerived: row.fieldsDerived ?? undefined,
      confidenceScore: row.confidenceScore,
      reviewStatus: row.reviewStatus,
      lastImportedAt: now,
      verifiedAt: row.verifiedAt,
      metadata: json(metadata),
    };
    await prisma.sourceAttribution.upsert({
      where: {
        entityType_entityId_fieldName_sourceUrl: {
          entityType: "CANDIDATE",
          entityId: toCandidateId,
          fieldName: row.fieldName,
          sourceUrl: row.sourceUrl,
        },
      },
      create: {
        entityType: "CANDIDATE",
        entityId: toCandidateId,
        fieldName: row.fieldName,
        sourceUrl: row.sourceUrl,
        ...data,
      },
      update: data,
    });
  }
}

async function promoteWinner({ winner, generalElection, resultSource, manifest, contest }) {
  const generalCandidates = await prisma.candidate.findMany({
    where: {
      electionId: generalElection.id,
      officeId: winner.officeId,
      partyText: contest.partyText,
    },
  });
  const existing = generalCandidates.find((candidate) => matchesAlias(candidate.ballotName ?? candidate.fullName, contest.winnerAliases));
  const data = {
    electionId: generalElection.id,
    officeId: winner.officeId,
    jurisdictionId: winner.jurisdictionId,
    districtId: winner.districtId,
    publicProfileId: winner.publicProfileId,
    sourceId: resultSource.id,
    fullName: winner.fullName,
    partyText: winner.partyText,
    ballotName: winner.ballotName,
    websiteUrl: winner.websiteUrl,
    email: winner.email,
    phone: winner.phone,
    photoUrl: winner.photoUrl,
    campaignStatement: winner.campaignStatement,
    socialLinks: winner.socialLinks ?? undefined,
    sourceUrl: manifest.sources.results.url,
    filingStatus: "Advanced from 2026 primary; statewide certification artifact pending",
    status: CandidateStatus.QUALIFIED,
    isIncumbent: winner.isIncumbent,
  };
  if (existing) return prisma.candidate.update({ where: { id: existing.id }, data });
  return prisma.candidate.create({
    data: {
      ...data,
      externalId: `reviewed-2026-primary-winner-${contest.key}`,
    },
  });
}

async function importContest({ contest, primaryElection, generalElection, resultSource, officialIndexSource, manifest }) {
  const candidates = await prisma.candidate.findMany({
    where: {
      electionId: primaryElection.id,
      partyText: contest.partyText,
      office: { title: { contains: contest.officeContains, mode: "insensitive" } },
    },
    include: { office: true },
  });
  if (!candidates.length) throw new Error(`No primary candidates found for ${contest.key}.`);
  const winners = candidates.filter((candidate) => matchesAlias(candidate.ballotName ?? candidate.fullName, contest.winnerAliases));
  if (winners.length !== 1) throw new Error(`Expected one winner match for ${contest.key}; found ${winners.length}.`);
  const winner = winners[0];

  await prisma.candidate.updateMany({
    where: { id: { in: candidates.filter((candidate) => candidate.id !== winner.id).map((candidate) => candidate.id) } },
    data: { status: CandidateStatus.LOST },
  });
  await prisma.candidate.update({ where: { id: winner.id }, data: { status: CandidateStatus.WON } });

  const votePercentage = Math.round((contest.winnerVotes / contest.contestVotes) * 10000) / 100;
  const result = await prisma.electionResult.upsert({
    where: { sourceId_externalId: { sourceId: resultSource.id, externalId: contest.key } },
    create: {
      electionId: primaryElection.id,
      candidateId: winner.id,
      sourceId: resultSource.id,
      externalId: contest.key,
      jurisdictionId: primaryElection.jurisdictionId,
      reportingArea: "Nevada statewide",
      resultStatus: manifest.resultStatus,
      votes: contest.winnerVotes,
      votePercentage,
      rank: 1,
      isWinner: true,
    },
    update: {
      candidateId: winner.id,
      resultStatus: manifest.resultStatus,
      votes: contest.winnerVotes,
      votePercentage,
      rank: 1,
      isWinner: true,
    },
  });

  const generalCandidate = await promoteWinner({ winner, generalElection, resultSource, manifest, contest });
  await copyCandidateAttributions(winner.id, generalCandidate.id, ["campaign_finance"]);
  await upsertAttribution({ candidateId: winner.id, fieldName: "primary_result", source: manifest.sources.results, sourceRow: resultSource, manifest, contest });
  await upsertAttribution({ candidateId: generalCandidate.id, fieldName: "general_ballot_advancement", source: manifest.sources.results, sourceRow: resultSource, manifest, contest });
  await upsertAttribution({ candidateId: generalCandidate.id, fieldName: "official_result_index", source: manifest.sources.officialIndex, sourceRow: officialIndexSource, manifest, contest });
  await flagCertificationPending(generalCandidate.id, resultSource.id, manifest);

  return {
    contest: contest.key,
    winnerId: winner.id,
    winnerName: winner.ballotName ?? winner.fullName,
    generalCandidateId: generalCandidate.id,
    votes: result.votes,
    votePercentage: result.votePercentage,
    resultStatus: result.resultStatus,
  };
}

async function main() {
  const filePath = path.resolve(process.cwd(), argValue("file", DEFAULT_FILE));
  const manifest = JSON.parse(await fs.readFile(filePath, "utf8"));
  validateManifest(manifest);

  const [primaryElection, generalElection] = await Promise.all([
    prisma.election.findUnique({ where: { slug: manifest.primaryElectionSlug } }),
    prisma.election.findUnique({ where: { slug: manifest.generalElectionSlug } }),
  ]);
  if (!primaryElection || !generalElection) throw new Error("Primary or general election record is missing.");
  if (primaryElection.jurisdictionId !== generalElection.jurisdictionId) throw new Error("Election jurisdictions do not match.");

  const resultSource = await upsertSource(manifest.sources.results, primaryElection.jurisdictionId, {
    sourceType: "HTML",
    notes: "Human-reviewed statewide result feed. Winner totals are cross-checked, but records remain UNOFFICIAL until a Nevada certification artifact is stored.",
  });
  const officialIndexSource = await upsertSource(manifest.sources.officialIndex, primaryElection.jurisdictionId, {
    sourceType: "COUNTY_PORTAL",
    notes: "Official county election index linking county results and the Nevada statewide result portal.",
  });

  await prisma.election.update({ where: { id: primaryElection.id }, data: { status: ElectionStatus.COMPLETED } });
  const imported = [];
  for (const contest of manifest.contests) {
    imported.push(await importContest({ contest, primaryElection, generalElection, resultSource, officialIndexSource, manifest }));
  }
  console.log(JSON.stringify({ filePath, batch: manifest.batch, imported }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
