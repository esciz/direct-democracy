import { readFile } from "node:fs/promises";

import {
  PrismaClient,
  ProfileEnrichmentReviewStatus,
  ProfileEnrichmentStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const MANIFEST_PATH = new URL("../data/manual-sources/profile-media/validated-public-figure-photos.json", import.meta.url);
const BLOCKED_TERMS = ["badge", "banner", "default", "favicon", "icon", "logo", "outline", "placeholder", "seal", "share-your-thoughts", "symbol", "trout"];

function normalizeName(value) {
  const reordered = value.includes(",")
    ? `${value.split(",").slice(1).join(" ")} ${value.split(",")[0]}`
    : value;
  return reordered
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 1)
    .filter((part) => !/^[a-z]$/.test(part));
}

function namesMatch(recordName, manifestName) {
  const recordParts = new Set(normalizeName(recordName));
  const manifestParts = normalizeName(manifestName);
  return manifestParts.length >= 2 && manifestParts.every((part) => recordParts.has(part));
}

function validatedImageUrl(value) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) throw new Error(`Unsupported image protocol: ${value}`);
  const searchable = decodeURIComponent(`${url.hostname}${url.pathname}`).toLowerCase();
  if (searchable.endsWith(".svg") || BLOCKED_TERMS.some((term) => searchable.includes(term))) {
    throw new Error(`Rejected non-portrait image URL: ${value}`);
  }
  return url.toString();
}

async function validateRemoteImage(value) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(value, {
      headers: { "user-agent": "DirectDemocracyBot/0.1 validated-profile-media-import" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Image request failed with ${response.status}: ${value}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) throw new Error(`Expected an image but received ${contentType || "unknown content"}: ${value}`);
    const bytes = (await response.arrayBuffer()).byteLength;
    if (bytes < 5000) throw new Error(`Image is unexpectedly small (${bytes} bytes): ${value}`);
    return { contentType, bytes };
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertEnrichment({ targetType, target, photo, photoUrl, now }) {
  const proposedFields = {
    headshotImageUrl: photoUrl,
    websiteUrl: photo.officialWebsiteUrl,
    sourceType: "human_validated_official_portrait",
    validationNote: photo.validationNote,
  };
  return prisma.profileWebsiteEnrichment.upsert({
    where: {
      targetType_targetId_sourceUrl: {
        targetType,
        targetId: target.id,
        sourceUrl: photo.sourceUrl,
      },
    },
    create: {
      targetType,
      targetId: target.id,
      targetName: target.fullName,
      sourceUrl: photo.sourceUrl,
      sourceName: photo.sourceName,
      officialWebsiteUrl: photo.officialWebsiteUrl,
      headshotUrl: photoUrl,
      socialLinks: [],
      lastEnrichedAt: now,
      enrichmentStatus: ProfileEnrichmentStatus.FETCHED,
      fetchedAt: now,
      proposedFields,
      fieldSources: {
        headshotImageUrl: [photo.sourceUrl],
        websiteUrl: [photo.sourceUrl],
      },
      confidenceScore: 0.99,
      reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
      reviewNotes: `Human-validated public-figure portrait. ${photo.validationNote}`,
      reviewedAt: now,
    },
    update: {
      targetName: target.fullName,
      sourceName: photo.sourceName,
      officialWebsiteUrl: photo.officialWebsiteUrl,
      headshotUrl: photoUrl,
      lastEnrichedAt: now,
      enrichmentStatus: ProfileEnrichmentStatus.FETCHED,
      fetchedAt: now,
      proposedFields,
      fieldSources: {
        headshotImageUrl: [photo.sourceUrl],
        websiteUrl: [photo.sourceUrl],
      },
      confidenceScore: 0.99,
      reviewStatus: ProfileEnrichmentReviewStatus.VERIFIED,
      reviewNotes: `Human-validated public-figure portrait. ${photo.validationNote}`,
      reviewedAt: now,
      errorLog: null,
    },
  });
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const now = new Date();
  const audit = {
    manifestPhotos: manifest.photos.length,
    remoteImagesValidated: 0,
    candidateRecordsUpdated: 0,
    officialRecordsUpdated: 0,
    enrichmentsUpserted: 0,
    suspectEnrichmentsRejected: 0,
    unmatchedTargets: [],
  };

  const suspectRows = await prisma.profileWebsiteEnrichment.findMany({
    where: { headshotUrl: { not: null }, reviewStatus: { in: ["APPROVED", "VERIFIED"] } },
    select: { id: true, headshotUrl: true },
  });
  const suspectIds = suspectRows
    .filter((row) => {
      try {
        validatedImageUrl(row.headshotUrl);
        return false;
      } catch {
        return true;
      }
    })
    .map((row) => row.id);
  if (suspectIds.length) {
    const result = await prisma.profileWebsiteEnrichment.updateMany({
      where: { id: { in: suspectIds } },
      data: {
        reviewStatus: ProfileEnrichmentReviewStatus.REJECTED,
        reviewNotes: "Rejected by validated profile-media import: image URL is a logo, seal, banner, placeholder, or other non-portrait asset.",
        reviewedAt: now,
      },
    });
    audit.suspectEnrichmentsRejected = result.count;
  }

  for (const photo of manifest.photos) {
    const photoUrl = validatedImageUrl(photo.photoUrl);
    await validateRemoteImage(photoUrl);
    audit.remoteImagesValidated += 1;

    for (const targetType of photo.targetTypes) {
      const delegate = targetType === "CANDIDATE" ? prisma.candidate : prisma.official;
      const records = await delegate.findMany({ select: { id: true, fullName: true } });
      const targets = records.filter((record) => namesMatch(record.fullName, photo.name));
      if (!targets.length) {
        audit.unmatchedTargets.push({ name: photo.name, targetType });
        continue;
      }

      for (const target of targets) {
        await delegate.update({
          where: { id: target.id },
          data: { photoUrl },
        });
        await upsertEnrichment({ targetType, target, photo, photoUrl, now });
        if (targetType === "CANDIDATE") audit.candidateRecordsUpdated += 1;
        else audit.officialRecordsUpdated += 1;
        audit.enrichmentsUpserted += 1;
      }
    }
  }

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
