#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  CampaignFinanceContributorType,
  CampaignFinanceFilingType,
  CivicEntityType,
  CivicRecordReviewStatus,
  DataQualityIssueType,
  PrismaClient,
  SourceType,
} from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_FILE = "data/manual-sources/campaign-finance/2026-nevada-statewide-executive.json";
const DEFAULT_HISTORY_FILE = "data/manual-sources/campaign-finance/2017-2026-nevada-statewide-history.json";

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
    .replace(/\bcisco\b/g, "francisco")
    .replace(/\bjoe\b/g, "joseph")
    .replace(/\bjim\b/g, "james")
    .replace(/\bandy\b/g, "andrew")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 1 && !["jeanette"].includes(part))
    .sort()
    .join(" ");
}

function assertUrl(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("must use HTTPS");
    return url.toString();
  } catch (error) {
    throw new Error(`${label} is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assertMoney(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
}

function formatDateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function cyclePeriodStart(cycleYear) {
  return `${cycleYear - 1}-01-01`;
}

function validateManifest(manifest, historyManifest) {
  if (manifest?.version !== 1 || !manifest.batch || !manifest.source || !Array.isArray(manifest.profiles) || !manifest.profiles.length) {
    throw new Error("Reviewed campaign-finance manifest must use version 1 and contain batch, source, and profiles.");
  }
  if (historyManifest?.version !== 1 || !historyManifest.batch || !historyManifest.source || !Array.isArray(historyManifest.profiles)) {
    throw new Error("Campaign-finance history manifest must use version 1 and contain batch, source, and profiles.");
  }
  manifest.source.url = assertUrl(manifest.source.url, "source URL");
  manifest.source.officialUrl = assertUrl(manifest.source.officialUrl, "official source URL");
  manifest.source.crossCheckUrl = assertUrl(manifest.source.crossCheckUrl, "cross-check URL");
  historyManifest.source.url = assertUrl(historyManifest.source.url, "history source URL");
  historyManifest.source.officialUrl = assertUrl(historyManifest.source.officialUrl, "history official source URL");
  if (!manifest.batch.periodStart || !manifest.batch.periodEnd || !manifest.batch.retrievedAt) {
    throw new Error("Campaign-finance batch is missing reporting dates.");
  }

  const historyByKey = new Map(historyManifest.profiles.map((profile) => [profile.key, profile]));
  for (const profile of manifest.profiles) {
    if (!profile.key || !profile.candidate?.aliases?.length || !profile.candidate.officeContains || !profile.candidate.electionYear) {
      throw new Error(`Profile ${profile.key ?? "unknown"} is missing candidate matching fields.`);
    }
    profile.candidateSourceUrl = assertUrl(profile.candidateSourceUrl, `${profile.key} candidate source URL`);
    profile.raceSourceUrl = assertUrl(profile.raceSourceUrl, `${profile.key} race source URL`);
    assertMoney(profile.totalRaised, `${profile.key} totalRaised`);
    assertMoney(profile.totalSpent, `${profile.key} totalSpent`);
    if (!Array.isArray(profile.topContributors)) throw new Error(`${profile.key} is missing topContributors.`);
    for (const contributor of profile.topContributors) {
      if (!contributor.name || !["INDIVIDUAL", "ENTITY"].includes(contributor.type)) {
        throw new Error(`${profile.key} has an invalid contributor.`);
      }
      assertMoney(contributor.amount, `${profile.key} contributor amount`);
    }

    const history = historyByKey.get(profile.key);
    if (!history?.allReported || !Array.isArray(history.cycles) || !history.cycles.length) {
      throw new Error(`Profile ${profile.key} is missing reviewed cycle history.`);
    }
    history.allReported.sourceUrl = assertUrl(history.allReported.sourceUrl, `${profile.key} all-reported source URL`);
    assertMoney(history.allReported.totalRaised, `${profile.key} allReported.totalRaised`);
    assertMoney(history.allReported.totalSpent, `${profile.key} allReported.totalSpent`);
    const cycleYears = new Set();
    for (const cycle of history.cycles) {
      if (!Number.isInteger(cycle.cycleYear) || cycle.cycleYear < 2018 || cycle.cycleYear % 2 !== 0 || cycleYears.has(cycle.cycleYear)) {
        throw new Error(`${profile.key} has an invalid or duplicate cycle year.`);
      }
      cycleYears.add(cycle.cycleYear);
      cycle.sourceUrl = assertUrl(cycle.sourceUrl, `${profile.key} ${cycle.cycleYear} source URL`);
      assertMoney(cycle.totalRaised, `${profile.key} ${cycle.cycleYear} totalRaised`);
      assertMoney(cycle.totalSpent, `${profile.key} ${cycle.cycleYear} totalSpent`);
    }
    const currentCycle = history.cycles.find((cycle) => cycle.cycleYear === profile.candidate.electionYear);
    if (
      !currentCycle ||
      Math.abs(currentCycle.totalRaised - profile.totalRaised) > 0.01 ||
      Math.abs(currentCycle.totalSpent - profile.totalSpent) > 0.01
    ) {
      throw new Error(`${profile.key} current-cycle history does not match the reviewed current totals.`);
    }
    const summedRaised = history.cycles.reduce((sum, cycle) => sum + cycle.totalRaised, 0);
    const summedSpent = history.cycles.reduce((sum, cycle) => sum + cycle.totalSpent, 0);
    if (
      Math.abs(summedRaised - history.allReported.totalRaised) > 0.02 ||
      Math.abs(summedSpent - history.allReported.totalSpent) > 0.02
    ) {
      throw new Error(`${profile.key} all-reported totals do not match the listed non-zero cycles.`);
    }
  }

  return historyByKey;
}

function matchesAlias(value, aliases) {
  const normalized = normalizeName(value);
  return aliases.some((alias) => normalizeName(alias) === normalized);
}

function contributorType(contributor) {
  if (contributor.type === "INDIVIDUAL") return CampaignFinanceContributorType.individual;
  const name = contributor.name.toLowerCase();
  if (/\b(union|workers|ibew|afscme|ccea|federation)\b/.test(name)) return CampaignFinanceContributorType.union;
  if (/\b(pac|committee|party|leadership)\b/.test(name)) return CampaignFinanceContributorType.pac;
  return CampaignFinanceContributorType.business;
}

function officialSearchUrl(candidateName) {
  const search = new URL("https://www.nvsos.gov/elections/aurora-public-search");
  search.searchParams.set("search", candidateName);
  return search.toString();
}

async function findTargets(profile) {
  const yearStart = new Date(`${profile.candidate.electionYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${profile.candidate.electionYear}-12-31T23:59:59.999Z`);
  const candidates = await prisma.candidate.findMany({
    where: {
      office: { title: { contains: profile.candidate.officeContains, mode: "insensitive" } },
      election: { electionDate: { gte: yearStart, lte: yearEnd } },
    },
    include: { election: true, office: true, jurisdiction: true },
  });
  const matches = candidates.filter((candidate) =>
    [candidate.fullName, candidate.ballotName].filter(Boolean).some((name) => matchesAlias(name, profile.candidate.aliases)),
  );
  if (!matches.length) throw new Error(`No candidate matched ${profile.key}.`);
  return matches;
}

async function upsertSource(manifest, jurisdictionId) {
  const checkedAt = new Date(manifest.batch.retrievedAt);
  return prisma.source.upsert({
    where: { slug: manifest.source.slug },
    create: {
      name: manifest.source.name,
      slug: manifest.source.slug,
      sourceType: SourceType.HTML,
      url: manifest.source.url,
      jurisdictionId,
      adapterKey: "manual-reviewed-campaign-finance",
      dataCategory: "campaign_finance_cycle_totals",
      accessMethod: "html",
      refreshFrequency: "after each Nevada campaign-finance reporting deadline",
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastSyncAt: checkedAt,
      syncStatus: "SUCCESS",
      notes: manifest.source.notes,
      metadata: json({
        derivedFrom: manifest.source.derivedFrom,
        officialUrl: manifest.source.officialUrl,
        reportingPeriodEnd: manifest.batch.periodEnd,
      }),
    },
    update: {
      name: manifest.source.name,
      url: manifest.source.url,
      jurisdictionId,
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      lastSyncAt: checkedAt,
      syncStatus: "SUCCESS",
      errorLog: null,
      notes: manifest.source.notes,
      metadata: json({
        derivedFrom: manifest.source.derivedFrom,
        officialUrl: manifest.source.officialUrl,
        reportingPeriodEnd: manifest.batch.periodEnd,
      }),
    },
  });
}

async function upsertSummary(candidate, profile, manifest) {
  const reportingPeriod = `${manifest.batch.periodStartLabel} through ${manifest.batch.periodEndLabel}`;
  const data = {
    candidateId: candidate.id,
    totalRaised: profile.totalRaised,
    totalSpent: profile.totalSpent,
    cashOnHand: null,
    reportingPeriod,
    sourceName: manifest.source.name,
    sourceUrl: profile.candidateSourceUrl,
    reviewStatus: CivicRecordReviewStatus.approved,
    lastUpdated: new Date(manifest.batch.retrievedAt),
  };
  const existing = await prisma.campaignFinanceSummary.findFirst({
    where: {
      candidateId: candidate.id,
      sourceUrl: profile.candidateSourceUrl,
      reportingPeriod,
    },
    select: { id: true },
  });
  if (existing) return prisma.campaignFinanceSummary.update({ where: { id: existing.id }, data });
  return prisma.campaignFinanceSummary.create({ data });
}

async function upsertCycleAggregate(candidate, profile, manifest, source, cycle) {
  const periodStart = cyclePeriodStart(cycle.cycleYear);
  const periodStartLabel = formatDateLabel(periodStart);
  const periodEndLabel = formatDateLabel(cycle.periodEnd);
  const externalId = `reviewed-cycle-summary:${profile.key}:${candidate.id}:${cycle.periodEnd}`;
  const reportingPeriod = `${periodStartLabel} through ${periodEndLabel}`;
  const filingName = `${cycle.cycleYear - 1}-${cycle.cycleYear} cycle totals through ${periodEndLabel}`;
  const isCurrentCycle = cycle.cycleYear === profile.candidate.electionYear;
  return prisma.campaignFinanceFiling.upsert({
    where: { sourceId_externalId: { sourceId: source.id, externalId } },
    create: {
      jurisdictionId: candidate.jurisdictionId,
      candidateId: candidate.id,
      sourceId: source.id,
      externalId,
      filingType: CampaignFinanceFilingType.OTHER,
      filerName: candidate.ballotName ?? candidate.fullName,
      periodStart: new Date(`${periodStart}T00:00:00.000Z`),
      periodEnd: new Date(`${cycle.periodEnd}T23:59:59.999Z`),
      amountRaised: cycle.totalRaised,
      amountSpent: cycle.totalSpent,
      filingUrl: cycle.sourceUrl,
      rawData: json({
        recordKind: "reviewed_cycle_aggregate",
        cycleYear: cycle.cycleYear,
        cycleDisplayLabel: `${cycle.cycleYear - 1}-${cycle.cycleYear} cycle`,
        isCurrentCycle,
        filingName,
        reportingPeriod,
        aggregationMethod: "Transparency USA candidate totals derived from Nevada Secretary of State campaign-finance records",
        sourceCandidateUrl: cycle.sourceUrl,
        sourceRaceUrl: isCurrentCycle ? profile.raceSourceUrl : null,
        officialSearchUrl: officialSearchUrl(candidate.ballotName ?? candidate.fullName),
        cashOnHandAvailable: false,
        reviewedAt: manifest.batch.retrievedAt,
      }),
    },
    update: {
      candidateId: candidate.id,
      jurisdictionId: candidate.jurisdictionId,
      periodStart: new Date(`${periodStart}T00:00:00.000Z`),
      periodEnd: new Date(`${cycle.periodEnd}T23:59:59.999Z`),
      amountRaised: cycle.totalRaised,
      amountSpent: cycle.totalSpent,
      filingUrl: cycle.sourceUrl,
      rawData: json({
        recordKind: "reviewed_cycle_aggregate",
        cycleYear: cycle.cycleYear,
        cycleDisplayLabel: `${cycle.cycleYear - 1}-${cycle.cycleYear} cycle`,
        isCurrentCycle,
        filingName,
        reportingPeriod,
        aggregationMethod: "Transparency USA candidate totals derived from Nevada Secretary of State campaign-finance records",
        sourceCandidateUrl: cycle.sourceUrl,
        sourceRaceUrl: isCurrentCycle ? profile.raceSourceUrl : null,
        officialSearchUrl: officialSearchUrl(candidate.ballotName ?? candidate.fullName),
        cashOnHandAvailable: false,
        reviewedAt: manifest.batch.retrievedAt,
      }),
    },
  });
}

async function upsertAllReportedAggregate(candidate, profile, manifest, source, history) {
  const periodStartLabel = formatDateLabel(history.allReported.periodStart);
  const periodEndLabel = formatDateLabel(history.allReported.periodEnd);
  const reportingPeriod = `${periodStartLabel} through ${periodEndLabel}`;
  const externalId = `reviewed-all-reported:${profile.key}:${candidate.id}:${history.allReported.periodEnd}`;
  const data = {
    candidateId: candidate.id,
    jurisdictionId: candidate.jurisdictionId,
    periodStart: new Date(`${history.allReported.periodStart}T00:00:00.000Z`),
    periodEnd: new Date(`${history.allReported.periodEnd}T23:59:59.999Z`),
    amountRaised: history.allReported.totalRaised,
    amountSpent: history.allReported.totalSpent,
    filingUrl: history.allReported.sourceUrl,
    rawData: json({
      recordKind: "reviewed_all_reported_aggregate",
      filingName: `All reported Nevada campaign activity since ${periodStartLabel}`,
      reportingPeriod,
      cycleCount: history.cycles.length,
      aggregationMethod: "Published all-cycle total from the linked source; the individual cycle records above are shown for verification.",
      sourceCandidateUrl: history.allReported.sourceUrl,
      officialSearchUrl: officialSearchUrl(candidate.ballotName ?? candidate.fullName),
      cashOnHandAvailable: false,
      reviewedAt: manifest.batch.retrievedAt,
    }),
  };
  return prisma.campaignFinanceFiling.upsert({
    where: { sourceId_externalId: { sourceId: source.id, externalId } },
    create: {
      ...data,
      sourceId: source.id,
      externalId,
      filingType: CampaignFinanceFilingType.OTHER,
      filerName: candidate.ballotName ?? candidate.fullName,
    },
    update: data,
  });
}

async function replaceTopContributors(candidate, profile, manifest) {
  const reportId = `reviewed-top-contributors:${profile.key}:${manifest.batch.periodEnd}`;
  await prisma.campaignFinanceContribution.deleteMany({ where: { candidateId: candidate.id, reportId } });
  if (!profile.topContributors.length) return 0;
  await prisma.campaignFinanceContribution.createMany({
    data: profile.topContributors.map((contributor) => ({
      candidateId: candidate.id,
      contributorName: contributor.name,
      contributorType: contributorType(contributor),
      amount: contributor.amount,
      reportId,
      sourceName: manifest.source.name,
      sourceUrl: profile.candidateSourceUrl,
      reviewStatus: CivicRecordReviewStatus.approved,
      confidenceScore: 0.92,
    })),
  });
  return profile.topContributors.length;
}

async function upsertAttribution(candidate, profile, manifest, source, history) {
  const now = new Date(manifest.batch.retrievedAt);
  const candidateName = candidate.ballotName ?? candidate.fullName;
  const officialUrl = officialSearchUrl(candidateName);
  const reportingPeriod = `${manifest.batch.periodStartLabel} through ${manifest.batch.periodEndLabel}`;
  const metadata = {
    importMethod: "reviewed_campaign_finance_manifest_v1",
    cycleTotalsAvailable: true,
    campaignHistoryAvailable: true,
    reportingPeriod,
    directCampaignOnly: true,
    cashOnHandAvailable: false,
    filingSummaries: [
      {
        name: `Cycle-to-date totals through ${manifest.batch.periodEndLabel}`,
        filedAt: `${manifest.batch.periodEnd}T00:00:00.000Z`,
        url: profile.candidateSourceUrl,
      },
    ],
    sourceLinks: [
      { label: "Candidate finance detail", url: profile.candidateSourceUrl, note: "Cycle-to-date candidate totals and contributor aggregates" },
      { label: "All reported cycles", url: history.allReported.sourceUrl, note: `Candidate totals across ${history.cycles.length} non-zero cycle records since 2017` },
      { label: "Race finance comparison", url: profile.raceSourceUrl, note: "Side-by-side 2026 race totals" },
      { label: "Nevada SOS Aurora search", url: officialUrl, note: "Official campaign-finance search by candidate name" },
      { label: "Nevada Independent Q2 cross-check", url: manifest.source.crossCheckUrl, note: "Independent reporting on the June 30 disclosure period" },
    ],
    campaignReportedSummary: `Current-cycle direct-campaign totals cover ${reportingPeriod}. Historical totals cover ${history.cycles.length} non-zero Nevada cycle record${history.cycles.length === 1 ? "" : "s"} since 2017. Affiliated PACs and independent expenditures are not included. Cash on hand is not published in the source aggregates and is not estimated.`,
    donorExtractionStatus: `${profile.topContributors.length} top-contributor aggregate${profile.topContributors.length === 1 ? "" : "s"} reviewed through ${manifest.batch.periodEndLabel}; the source link contains the broader itemized record.`,
  };
  await prisma.sourceAttribution.upsert({
    where: {
      entityType_entityId_fieldName_sourceUrl: {
        entityType: CivicEntityType.CANDIDATE,
        entityId: candidate.id,
        fieldName: "campaign_finance",
        sourceUrl: profile.candidateSourceUrl,
      },
    },
    create: {
      entityType: CivicEntityType.CANDIDATE,
      entityId: candidate.id,
      fieldName: "campaign_finance",
      sourceId: source.id,
      sourceName: manifest.source.name,
      sourceUrl: profile.candidateSourceUrl,
      fieldsDerived: json(["current-cycle contributions", "current-cycle expenditures", "historical cycle totals", "all-reported totals", "top contributor aggregates", "reporting period"]),
      confidenceScore: 0.93,
      reviewStatus: CivicRecordReviewStatus.approved,
      lastImportedAt: now,
      metadata: json(metadata),
    },
    update: {
      sourceId: source.id,
      sourceName: manifest.source.name,
      fieldsDerived: json(["current-cycle contributions", "current-cycle expenditures", "historical cycle totals", "all-reported totals", "top contributor aggregates", "reporting period"]),
      confidenceScore: 0.93,
      reviewStatus: CivicRecordReviewStatus.approved,
      lastImportedAt: now,
      verifiedAt: null,
      metadata: json(metadata),
    },
  });
}

async function resolveFinanceGap(candidateId, batchName) {
  await prisma.dataQualityIssue.updateMany({
    where: {
      recordType: "CANDIDATE",
      recordId: candidateId,
      issueType: DataQualityIssueType.missing_campaign_finance,
      status: { in: ["open", "in_review"] },
    },
    data: {
      status: "resolved",
      resolvedAt: new Date(),
      notes: `Resolved by reviewed campaign-finance batch: ${batchName}.`,
    },
  });
}

async function main() {
  const filePath = path.resolve(process.cwd(), argValue("file", DEFAULT_FILE));
  const historyFilePath = path.resolve(process.cwd(), argValue("history-file", DEFAULT_HISTORY_FILE));
  const [manifest, historyManifest] = await Promise.all([
    fs.readFile(filePath, "utf8").then(JSON.parse),
    fs.readFile(historyFilePath, "utf8").then(JSON.parse),
  ]);
  const historyByKey = validateManifest(manifest, historyManifest);
  const imported = [];

  for (const profile of manifest.profiles) {
    const history = historyByKey.get(profile.key);
    const candidates = await findTargets(profile);
    const source = await upsertSource(manifest, candidates[0].jurisdictionId);
    const candidateResults = [];
    for (const candidate of candidates) {
      await upsertSummary(candidate, profile, manifest);
      for (const cycle of history.cycles) {
        await upsertCycleAggregate(candidate, profile, manifest, source, cycle);
      }
      await upsertAllReportedAggregate(candidate, profile, manifest, source, history);
      const contributors = await replaceTopContributors(candidate, profile, manifest);
      await upsertAttribution(candidate, profile, manifest, source, history);
      await resolveFinanceGap(candidate.id, manifest.batch.name);
      candidateResults.push({
        id: candidate.id,
        name: candidate.ballotName ?? candidate.fullName,
        election: candidate.election.title,
        raised: profile.totalRaised,
        spent: profile.totalSpent,
        contributors,
        historicalCycles: history.cycles.length,
        allReportedRaised: history.allReported.totalRaised,
        allReportedSpent: history.allReported.totalSpent,
      });
    }
    imported.push({ key: profile.key, candidates: candidateResults });
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    filePath,
    historyFilePath,
    batch: manifest.batch,
    historyBatch: historyManifest.batch,
    source: manifest.source,
    imported,
  };
  await fs.writeFile(path.resolve(process.cwd(), "data/generated/reviewed-campaign-finance-import-audit.json"), `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify(audit, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
