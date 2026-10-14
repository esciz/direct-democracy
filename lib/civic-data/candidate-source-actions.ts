"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { CandidateKnowledgeSourceType, ProfileEnrichmentReviewStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

const SOURCE_TYPE_MAP: Record<string, CandidateKnowledgeSourceType> = {
  campaign_site: CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE,
  official_site: CandidateKnowledgeSourceType.OFFICIAL_WEBSITE,
  ballotpedia: CandidateKnowledgeSourceType.BALLOTPEDIA,
  news: CandidateKnowledgeSourceType.NEWS_ARTICLE,
  social: CandidateKnowledgeSourceType.SOCIAL_PROFILE,
  candidate_statement: CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA,
  campaign_finance: CandidateKnowledgeSourceType.CAMPAIGN_FINANCE,
  other: CandidateKnowledgeSourceType.OTHER,
};

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }
  return value.trim();
}

function sourcePriority(sourceType: CandidateKnowledgeSourceType) {
  switch (sourceType) {
    case CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE:
    case CandidateKnowledgeSourceType.OFFICIAL_WEBSITE:
      return 1;
    case CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA:
      return 2;
    case CandidateKnowledgeSourceType.BALLOTPEDIA:
      return 3;
    case CandidateKnowledgeSourceType.CAMPAIGN_FINANCE:
      return 5;
    case CandidateKnowledgeSourceType.NEWS_ARTICLE:
      return 6;
    case CandidateKnowledgeSourceType.SOCIAL_PROFILE:
      return 7;
    default:
      return 8;
  }
}

function defaultSourceName(sourceType: CandidateKnowledgeSourceType) {
  switch (sourceType) {
    case CandidateKnowledgeSourceType.CAMPAIGN_WEBSITE:
      return "Campaign website source";
    case CandidateKnowledgeSourceType.OFFICIAL_WEBSITE:
      return "Official website source";
    case CandidateKnowledgeSourceType.BALLOTPEDIA:
      return "Ballotpedia reference source";
    case CandidateKnowledgeSourceType.NEWS_ARTICLE:
      return "News article source";
    case CandidateKnowledgeSourceType.SOCIAL_PROFILE:
      return "Official public social profile";
    case CandidateKnowledgeSourceType.SOS_PUBLIC_MEDIA:
      return "Candidate statement source";
    case CandidateKnowledgeSourceType.CAMPAIGN_FINANCE:
      return "Campaign finance source";
    default:
      return "Candidate source";
  }
}

export async function addCandidateSourceForReviewAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "admin") {
    throw new Error("Admin access is required.");
  }

  const candidateId = readRequiredString(formData, "candidateId");
  const sourceUrl = readRequiredString(formData, "sourceUrl");
  const rawSourceType = readRequiredString(formData, "sourceType");
  const sourceType = SOURCE_TYPE_MAP[rawSourceType] ?? CandidateKnowledgeSourceType.OTHER;
  const notesValue = formData.get("notes");
  const notes = typeof notesValue === "string" && notesValue.trim() ? notesValue.trim() : null;

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, fullName: true, ballotName: true },
  });

  if (!candidate) {
    throw new Error("Candidate was not found.");
  }

  await prisma.candidateKnowledgeEnrichment.upsert({
    where: { candidateId_sourceUrl: { candidateId, sourceUrl } },
    create: {
      candidateId,
      sourceUrl,
      sourceName: defaultSourceName(sourceType),
      sourceType,
      sourcePriority: sourcePriority(sourceType),
      title: "Admin-added source pending extraction",
      issues: [],
      newsItems: [],
      socialLinks: [],
      sourceAttribution: {
        addedByUserId: user.id,
        addedFrom: "admin_candidate_knowledge_add_source",
        notes,
        extractionStatus: "pending",
      },
      confidenceScore: 0.5,
      reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      reviewNotes: notes,
    },
    update: {
      sourceType,
      sourcePriority: sourcePriority(sourceType),
      sourceName: defaultSourceName(sourceType),
      reviewStatus: ProfileEnrichmentReviewStatus.PENDING_REVIEW,
      reviewNotes: notes,
      sourceAttribution: {
        addedByUserId: user.id,
        addedFrom: "admin_candidate_knowledge_add_source",
        notes,
        extractionStatus: "pending",
      },
      lastUpdatedAt: new Date(),
    },
  });

  revalidatePath("/admin/data-factory/candidate-knowledge");
  revalidatePath("/admin/data-factory/candidate-knowledge/add-source");
  revalidatePath(`/candidates/${candidateId}`);
  redirect(`/admin/data-factory/candidate-knowledge/add-source?candidateId=${candidateId}&added=1`);
}
