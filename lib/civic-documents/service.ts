import { DocumentFieldReviewStatus, DocumentReviewIssueStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getAdminDocumentIntakeSummary() {
  const [totalDocuments, pendingFields, openIssues, recentDocuments] = await Promise.all([
    prisma.civicDocument.count(),
    prisma.documentExtractedField.count({ where: { reviewStatus: DocumentFieldReviewStatus.PENDING_REVIEW } }),
    prisma.documentReviewIssue.count({ where: { status: DocumentReviewIssueStatus.OPEN } }),
    prisma.civicDocument.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        extractionRuns: { orderBy: { startedAt: "desc" }, take: 1 },
        extractedFields: { take: 6, orderBy: { createdAt: "asc" } },
        reviewIssues: { where: { status: DocumentReviewIssueStatus.OPEN }, take: 4, orderBy: { createdAt: "desc" } },
      },
    }),
  ]);

  return { totalDocuments, pendingFields, openIssues, recentDocuments };
}

export async function getAdminDocumentReviewQueue() {
  return prisma.civicDocument.findMany({
    where: {
      OR: [
        { extractedFields: { some: { reviewStatus: DocumentFieldReviewStatus.PENDING_REVIEW } } },
        { reviewIssues: { some: { status: DocumentReviewIssueStatus.OPEN } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      extractionRuns: { orderBy: { startedAt: "desc" }, take: 1 },
      extractedFields: { orderBy: { confidenceScore: "asc" }, take: 12 },
      reviewIssues: { where: { status: DocumentReviewIssueStatus.OPEN }, orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
}

export async function getCivicDocumentDetail(documentId: string) {
  return prisma.civicDocument.findUnique({
    where: { id: documentId },
    include: {
      extractionRuns: { orderBy: { startedAt: "desc" } },
      extractedFields: { orderBy: [{ reviewStatus: "asc" }, { fieldName: "asc" }] },
      reviewIssues: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
    },
  });
}
