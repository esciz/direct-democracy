#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  CandidateKnowledgeSourceType,
  CivicRecordReviewStatus,
  PrismaClient,
  ProfileEnrichmentReviewStatus,
  ProfileEnrichmentStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const DEFAULT_FILE = "data/manual-sources/candidate-profiles/2026-nevada-governor.json";

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
    .replace(/\bmike\b/g, "michael")
    .replace(/\b(jr|sr|ii|iii|iv|governor|gov)\b\.?/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 1)
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

function validateManifest(manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.profiles) || !manifest.profiles.length) {
    throw new Error("Reviewed candidate profile manifest must use version 1 and contain profiles.");
  }
  for (const profile of manifest.profiles) {
    if (!profile.key || !profile.candidate?.aliases?.length || !profile.candidate.officeContains || !profile.candidate.electionYear) {
      throw new Error(`Profile ${profile.key ?? "unknown"} is missing candidate matching fields.`);
    }
    if (profile.profile?.bioSource && !["official", "campaign", "position"].includes(profile.profile.bioSource)) {
      throw new Error(`Profile ${profile.key} has an invalid biography source.`);
    }
    for (const source of [profile.profile?.officialSource, profile.profile?.campaignSource, profile.profile?.positionSource].filter(Boolean)) {
      if (!source.name || !source.slug) throw new Error(`Profile ${profile.key} has an incomplete source definition.`);
      source.url = assertUrl(source.url, `${profile.key} source URL`);
      if (source.homeUrl) source.homeUrl = assertUrl(source.homeUrl, `${profile.key} source home URL`);
      if (source.headshotUrl) source.headshotUrl = assertUrl(source.headshotUrl, `${profile.key} headshot URL`);
    }
    for (const position of profile.positions ?? []) {
      if (!position.issueText || !position.issueSlug || !position.summary || !["official", "campaign", "position"].includes(position.source)) {
        throw new Error(`Profile ${profile.key} has an invalid issue position.`);
      }
      if (position.evidenceUrl) position.evidenceUrl = assertUrl(position.evidenceUrl, `${profile.key} position evidence URL`);
    }
  }
}

function sourceForKey(profile, sourceKey) {
  if (sourceKey === "campaign") return profile.profile.campaignSource;
  if (sourceKey === "position") return profile.profile.positionSource;
  return profile.profile.officialSource;
}

function biographySource(profile) {
  return sourceForKey(profile, profile.profile.bioSource ?? "official");
}

function matchesAlias(value, aliases) {
  const normalized = normalizeName(value);
  return aliases.some((alias) => normalizeName(alias) === normalized);
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
  const matchedCandidates = candidates.filter((candidate) =>
    [candidate.fullName, candidate.ballotName].filter(Boolean).some((name) => matchesAlias(name, profile.candidate.aliases)),
  );
  if (!matchedCandidates.length) throw new Error(`No candidate matched ${profile.key}.`);

  let official = null;
  if (profile.official) {
    const officials = await prisma.official.findMany({
      where: {
        status: "CURRENT",
        office: { title: { contains: profile.official.officeContains, mode: "insensitive" } },
      },
      include: { office: true, jurisdiction: true },
    });
    const officialMatches = officials.filter((row) => matchesAlias(row.fullName, profile.official.aliases));
    if (officialMatches.length > 1) throw new Error(`Multiple officials matched ${profile.key}.`);
    official = officialMatches[0] ?? null;
  }
  return { candidates: matchedCandidates, official };
}

async function upsertSource(definition, jurisdictionId, batchName) {
  const now = new Date();
  const government = new URL(definition.url).hostname.endsWith(".gov") || new URL(definition.url).hostname.includes("nv.gov");
  return prisma.source.upsert({
    where: { slug: definition.slug },
    create: {
      name: definition.name,
      slug: definition.slug,
      sourceType: government ? "GOVERNMENT_PORTAL" : "HTML",
      url: definition.url,
      jurisdictionId,
      adapterKey: "manual-reviewed-candidate-profile-batch",
      dataCategory: "candidate_profile",
      accessMethod: "html",
      refreshFrequency: "monthly during election season",
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastSyncAt: now,
      syncStatus: "SUCCESS",
      notes: `Human-reviewed source imported from ${batchName}.`,
    },
    update: {
      name: definition.name,
      url: definition.url,
      jurisdictionId,
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastSyncAt: now,
      syncStatus: "SUCCESS",
      errorLog: null,
      notes: `Human-reviewed source imported from ${batchName}.`,
    },
  });
}

async function upsertProfileEnrichment({ targetType, targetId, targetName, source, profile, official, includeBio }) {
  const now = new Date();
  const isCampaign = Boolean(profile.campaignSource && source.slug === profile.campaignSource.slug);
  const sourceBio = includeBio ? profile.bioSummary ?? null : null;
  const sourceHeadshot = includeBio ? source.headshotUrl ?? null : null;
  const proposedFields = {
    shortBioSummary: sourceBio,
    websiteUrl: source.homeUrl ?? source.url,
    headshotImageUrl: sourceHeadshot,
    officeTitle: official?.office.title ?? null,
    districtOrJurisdiction: official?.jurisdiction.name ?? null,
    sourceType: isCampaign ? "reviewed_campaign_source" : "official_government_profile",
  };
  await prisma.profileWebsiteEnrichment.upsert({
    where: { targetType_targetId_sourceUrl: { targetType, targetId, sourceUrl: source.url } },
    create: {
      targetType,
      targetId,
      targetName,
      sourceUrl: source.url,
      sourceName: source.name,
      campaignWebsiteUrl: isCampaign ? source.homeUrl ?? source.url : null,
      officialWebsiteUrl: isCampaign ? null : source.homeUrl ?? source.url,
      headshotUrl: sourceHeadshot,
      shortBio: sourceBio,
      longBioSourceUrl: sourceBio ? source.url : null,
      socialLinks: [],
      publicContactEmail: official?.email ?? null,
      publicContactPhone: official?.phone ?? null,
      lastEnrichedAt: now,
      enrichmentStatus: ProfileEnrichmentStatus.FETCHED,
      fetchedAt: now,
      proposedFields: json(proposedFields),
      fieldSources: json(Object.fromEntries(Object.keys(proposedFields).map((field) => [field, [source.url]]))),
      confidenceScore: 0.97,
      reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
      reviewNotes: "Human-reviewed source manifest. Summaries are paraphrases and issue positions are tied to direct evidence URLs.",
      reviewedAt: now,
    },
    update: {
      targetName,
      sourceName: source.name,
      campaignWebsiteUrl: isCampaign ? source.homeUrl ?? source.url : null,
      officialWebsiteUrl: isCampaign ? null : source.homeUrl ?? source.url,
      headshotUrl: sourceHeadshot,
      shortBio: sourceBio,
      longBioSourceUrl: sourceBio ? source.url : null,
      publicContactEmail: official?.email ?? null,
      publicContactPhone: official?.phone ?? null,
      lastEnrichedAt: now,
      enrichmentStatus: ProfileEnrichmentStatus.FETCHED,
      fetchedAt: now,
      proposedFields: json(proposedFields),
      fieldSources: json(Object.fromEntries(Object.keys(proposedFields).map((field) => [field, [source.url]]))),
      confidenceScore: 0.97,
      reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
      reviewNotes: "Human-reviewed source manifest. Summaries are paraphrases and issue positions are tied to direct evidence URLs.",
      reviewedAt: now,
      errorLog: null,
    },
  });
}

async function upsertKnowledge(candidate, profile) {
  const now = new Date();
  const bioSource = biographySource(profile);
  if (bioSource && profile.profile.bioSummary) {
    const sourceType = new URL(bioSource.url).hostname.endsWith(".gov") || new URL(bioSource.url).hostname.includes("nv.gov")
      ? CandidateKnowledgeSourceType.OFFICIAL_WEBSITE
      : CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE;
    const sourceLabel = sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? "official government biography" : "candidate campaign biography";
    await prisma.candidateKnowledgeEnrichment.upsert({
      where: { candidateId_sourceUrl: { candidateId: candidate.id, sourceUrl: bioSource.url } },
      create: {
        candidateId: candidate.id,
        sourceUrl: bioSource.url,
        sourceName: bioSource.name,
        sourceType,
        sourcePriority: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? 1 : 2,
        title: bioSource.name,
        aboutSummary: profile.profile.bioSummary,
        ownWordsSummary: null,
        issues: [],
        experienceSummary: profile.profile.experienceSummary ?? null,
        financeContext: null,
        newsItems: [],
        socialLinks: [],
        sourceAttribution: json([{ sourceName: bioSource.name, sourceUrl: bioSource.url, sourceType }]),
        confidenceScore: 0.97,
        reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
        reviewNotes: `Human-reviewed paraphrase of a ${sourceLabel}.`,
        fetchedAt: now,
        lastUpdatedAt: now,
        reviewedAt: now,
      },
      update: {
        sourceName: bioSource.name,
        sourceType,
        sourcePriority: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? 1 : 2,
        title: bioSource.name,
        aboutSummary: profile.profile.bioSummary,
        experienceSummary: profile.profile.experienceSummary ?? null,
        sourceAttribution: json([{ sourceName: bioSource.name, sourceUrl: bioSource.url, sourceType }]),
        confidenceScore: 0.97,
        reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
        reviewNotes: `Human-reviewed paraphrase of a ${sourceLabel}.`,
        fetchedAt: now,
        lastUpdatedAt: now,
        reviewedAt: now,
        errorLog: null,
      },
    });
  }

  const grouped = new Map();
  for (const position of profile.positions ?? []) {
    const source = position.source === "campaign" ? profile.profile.campaignSource : position.source === "position" ? profile.profile.positionSource : profile.profile.officialSource;
    if (!source) throw new Error(`Position ${position.issueSlug} in ${profile.key} references a missing source.`);
    const values = grouped.get(source.slug) ?? { source, positions: [] };
    values.positions.push(position);
    grouped.set(source.slug, values);
  }

  for (const { source, positions } of grouped.values()) {
    const sourceType = new URL(source.url).hostname.endsWith(".gov") || new URL(source.url).hostname.includes("nv.gov")
      ? CandidateKnowledgeSourceType.OFFICIAL_WEBSITE
      : CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE;
    await prisma.candidateKnowledgeEnrichment.upsert({
      where: { candidateId_sourceUrl: { candidateId: candidate.id, sourceUrl: source.url } },
      create: {
        candidateId: candidate.id,
        sourceUrl: source.url,
        sourceName: source.name,
        sourceType,
        sourcePriority: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? 1 : 2,
        title: source.name,
        aboutSummary: null,
        ownWordsSummary: sourceType === CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE ? `The campaign identifies ${positions.map((position) => position.issueText).join(", ")} as policy priorities.` : null,
        issues: json(positions.map((position) => ({ label: position.issueText, summary: position.summary, sourceUrl: position.evidenceUrl ?? source.url }))),
        experienceSummary: null,
        financeContext: null,
        newsItems: [],
        socialLinks: [],
        sourceAttribution: json([{ sourceName: source.name, sourceUrl: source.url, sourceType }]),
        confidenceScore: 0.96,
        reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
        reviewNotes: "Human-reviewed issue summaries tied to the direct source page.",
        fetchedAt: now,
        lastUpdatedAt: now,
        reviewedAt: now,
      },
      update: {
        sourceName: source.name,
        sourceType,
        sourcePriority: sourceType === CandidateKnowledgeSourceType.OFFICIAL_WEBSITE ? 1 : 2,
        title: source.name,
        ownWordsSummary: sourceType === CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE ? `The campaign identifies ${positions.map((position) => position.issueText).join(", ")} as policy priorities.` : null,
        issues: json(positions.map((position) => ({ label: position.issueText, summary: position.summary, sourceUrl: position.evidenceUrl ?? source.url }))),
        sourceAttribution: json([{ sourceName: source.name, sourceUrl: source.url, sourceType }]),
        confidenceScore: 0.96,
        reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
        reviewNotes: "Human-reviewed issue summaries tied to the direct source page.",
        fetchedAt: now,
        lastUpdatedAt: now,
        reviewedAt: now,
        errorLog: null,
      },
    });
  }
}

async function upsertPosition(target, position, profile, sources) {
  const sourceDefinition = position.source === "campaign" ? profile.profile.campaignSource : position.source === "position" ? profile.profile.positionSource : profile.profile.officialSource;
  const source = sources.get(sourceDefinition.slug);
  const evidenceUrl = position.evidenceUrl ?? sourceDefinition.url;
  const where = {
    ...(target.type === "candidate" ? { candidateId: target.id } : { officialId: target.id }),
    issueSlug: position.issueSlug,
    evidenceUrl,
  };
  const data = {
    ...where,
    issueText: position.issueText,
    stance: position.stance,
    derivation: "OFFICIAL",
    summary: position.summary,
    evidenceTitle: position.evidenceTitle,
    evidenceSourceName: sourceDefinition.name,
    sourceId: source.id,
    confidenceScore: 0.96,
    reviewStatus: CivicRecordReviewStatus.verified,
    verificationStatus: CivicRecordReviewStatus.verified,
    lastObservedAt: new Date(),
  };
  const existing = await prisma.issuePosition.findFirst({ where, select: { id: true } });
  if (existing) return prisma.issuePosition.update({ where: { id: existing.id }, data });
  return prisma.issuePosition.create({ data });
}

async function upsertAttribution({ entityType, entityId, fieldName, source, sourceRow, fieldsDerived }) {
  const now = new Date();
  await prisma.sourceAttribution.upsert({
    where: { entityType_entityId_fieldName_sourceUrl: { entityType, entityId, fieldName, sourceUrl: source.url } },
    create: {
      entityType,
      entityId,
      fieldName,
      sourceId: sourceRow.id,
      sourceName: source.name,
      sourceUrl: source.url,
      fieldsDerived: json(fieldsDerived),
      confidenceScore: 0.97,
      reviewStatus: CivicRecordReviewStatus.verified,
      lastImportedAt: now,
      verifiedAt: now,
      metadata: json({ importMethod: "reviewed_candidate_profile_manifest_v1" }),
    },
    update: {
      sourceId: sourceRow.id,
      sourceName: source.name,
      fieldsDerived: json(fieldsDerived),
      confidenceScore: 0.97,
      reviewStatus: CivicRecordReviewStatus.verified,
      lastImportedAt: now,
      verifiedAt: now,
      metadata: json({ importMethod: "reviewed_candidate_profile_manifest_v1" }),
    },
  });
}

async function resolveQualityIssues(recordType, recordIds, issueTypes, batchName) {
  if (!recordIds.length || !issueTypes.length) return;
  const resolvedAt = new Date();
  await prisma.dataQualityIssue.updateMany({
    where: { recordType, recordId: { in: recordIds }, issueType: { in: issueTypes }, status: { in: ["open", "in_review"] } },
    data: { status: "resolved", resolvedAt, notes: `Resolved by human-reviewed source batch: ${batchName}.` },
  });
}

async function importProfile(profile, batchName) {
  const { candidates, official } = await findTargets(profile);
  const jurisdictionId = candidates[0].jurisdictionId;
  const bioSource = biographySource(profile);
  if (profile.profile.bioSummary && !bioSource) {
    throw new Error(`Profile ${profile.key} has a biography but its selected biography source is missing.`);
  }
  const sourceDefinitions = [profile.profile.officialSource, profile.profile.campaignSource, profile.profile.positionSource].filter(Boolean);
  const sources = new Map();
  for (const definition of sourceDefinitions) {
    sources.set(definition.slug, await upsertSource(definition, jurisdictionId, batchName));
  }

  for (const candidate of candidates) {
    const update = {};
    if (profile.profile.campaignSource?.homeUrl) update.websiteUrl = profile.profile.campaignSource.homeUrl;
    if (bioSource?.headshotUrl) update.photoUrl = bioSource.headshotUrl;
    if (Object.keys(update).length) await prisma.candidate.update({ where: { id: candidate.id }, data: update });

    if (profile.profile.officialSource) {
      await upsertProfileEnrichment({ targetType: "CANDIDATE", targetId: candidate.id, targetName: candidate.ballotName ?? candidate.fullName, source: profile.profile.officialSource, profile: profile.profile, official, includeBio: bioSource?.slug === profile.profile.officialSource.slug });
    }
    if (profile.profile.campaignSource) {
      await upsertProfileEnrichment({ targetType: "CANDIDATE", targetId: candidate.id, targetName: candidate.ballotName ?? candidate.fullName, source: profile.profile.campaignSource, profile: profile.profile, official: null, includeBio: bioSource?.slug === profile.profile.campaignSource.slug });
      await upsertAttribution({ entityType: "CANDIDATE", entityId: candidate.id, fieldName: "campaign_website", source: profile.profile.campaignSource, sourceRow: sources.get(profile.profile.campaignSource.slug), fieldsDerived: ["campaign website URL"] });
    }
    if (bioSource) {
      await upsertAttribution({ entityType: "CANDIDATE", entityId: candidate.id, fieldName: "bio", source: bioSource, sourceRow: sources.get(bioSource.slug), fieldsDerived: ["reviewed biography", "experience summary"] });
      if (bioSource.headshotUrl) {
        await upsertAttribution({ entityType: "CANDIDATE", entityId: candidate.id, fieldName: "profile_image", source: bioSource, sourceRow: sources.get(bioSource.slug), fieldsDerived: ["reviewed headshot URL"] });
      }
    }
    await upsertKnowledge(candidate, profile);
    for (const position of profile.positions ?? []) await upsertPosition({ type: "candidate", id: candidate.id }, position, profile, sources);
    const positionSource = profile.profile.positionSource ?? profile.profile.campaignSource ?? profile.profile.officialSource;
    if (positionSource && profile.positions?.length) {
      await upsertAttribution({ entityType: "CANDIDATE", entityId: candidate.id, fieldName: "issue_positions", source: positionSource, sourceRow: sources.get(positionSource.slug), fieldsDerived: profile.positions.map((position) => position.issueSlug) });
    }
  }

  if (official && profile.profile.officialSource) {
    await prisma.official.update({
      where: { id: official.id },
      data: { websiteUrl: profile.profile.officialSource.homeUrl ?? profile.profile.officialSource.url, photoUrl: profile.profile.officialSource.headshotUrl ?? official.photoUrl },
    });
    const officialBioSelected = bioSource?.slug === profile.profile.officialSource.slug;
    await upsertProfileEnrichment({ targetType: "OFFICIAL", targetId: official.id, targetName: official.fullName, source: profile.profile.officialSource, profile: profile.profile, official, includeBio: officialBioSelected });
    if (officialBioSelected) {
      await upsertAttribution({ entityType: "OFFICIAL", entityId: official.id, fieldName: "bio", source: profile.profile.officialSource, sourceRow: sources.get(profile.profile.officialSource.slug), fieldsDerived: ["reviewed biography", "experience summary"] });
    }
  }
  if (official && profile.applyPositionsToOfficial === true) {
    for (const position of profile.positions ?? []) await upsertPosition({ type: "official", id: official.id }, position, profile, sources);
  }

  const resolvedCandidateIssues = [];
  if (profile.profile.bioSummary) resolvedCandidateIssues.push("missing_bio");
  if (profile.profile.campaignSource) resolvedCandidateIssues.push("missing_campaign_site");
  if (profile.positions?.length) resolvedCandidateIssues.push("missing_issue_positions");
  await resolveQualityIssues("CANDIDATE", candidates.map((candidate) => candidate.id), resolvedCandidateIssues, batchName);
  if (official && profile.applyPositionsToOfficial === true && profile.positions?.length) {
    await resolveQualityIssues("OFFICIAL", [official.id], ["missing_issue_positions"], batchName);
  }

  return {
    key: profile.key,
    candidateIds: candidates.map((candidate) => candidate.id),
    officialId: official?.id ?? null,
    sources: sourceDefinitions.map((source) => source.url),
    positions: profile.positions?.length ?? 0,
  };
}

async function main() {
  const filePath = path.resolve(process.cwd(), argValue("file", DEFAULT_FILE));
  const manifest = JSON.parse(await fs.readFile(filePath, "utf8"));
  validateManifest(manifest);
  const imported = [];
  for (const profile of manifest.profiles) imported.push(await importProfile(profile, manifest.batch.name));
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
