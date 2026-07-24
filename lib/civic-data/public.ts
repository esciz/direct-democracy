import { prisma } from "@/lib/prisma";
import { JurisdictionType, type Prisma } from "@prisma/client";
import { getApprovedCandidateKnowledge, type PublicCandidateKnowledgeSection } from "@/lib/enrichment/candidate-knowledge";
import { getValidatedProfileImageUrl } from "@/lib/profile/media-validation";

const publicOfficialJurisdictionTypes = [
  JurisdictionType.COUNTRY,
  JurisdictionType.STATE,
  JurisdictionType.COUNTY,
  JurisdictionType.CITY,
  JurisdictionType.DISTRICT,
  JurisdictionType.CAMPUS,
  JurisdictionType.AGENCY,
];

export type PublicOfficialRow = {
  id: string;
  fullName: string;
  partyText: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
  status: string;
  termStart: Date | null;
  termEnd: Date | null;
  office: {
    title: string;
    level: string;
  };
  jurisdiction: {
    name: string;
    slug: string;
    type: string;
  };
  district: {
    name: string;
    type: string;
  } | null;
  source: {
    name: string;
    url: string;
  } | null;
  websiteEnrichment: {
    officialWebsiteUrl: string | null;
    headshotUrl: string | null;
    shortBio: string | null;
    publicContactEmail: string | null;
    publicContactPhone: string | null;
    sourceName: string | null;
    sourceUrl: string;
  } | null;
};

export async function getPublicOfficials(jurisdictionSlug?: string): Promise<PublicOfficialRow[]> {
  const officials = await prisma.official.findMany({
    where: {
      jurisdiction: {
        ...(jurisdictionSlug ? { slug: jurisdictionSlug } : {}),
        type: { in: publicOfficialJurisdictionTypes },
      },
    },
    include: {
      office: {
        select: {
          title: true,
          level: true,
        },
      },
      jurisdiction: {
        select: {
          name: true,
          slug: true,
          type: true,
        },
      },
      district: {
        select: {
          name: true,
          districtType: true,
        },
      },
      source: {
        select: {
          name: true,
          url: true,
        },
      },
    },
    orderBy: [{ jurisdiction: { name: "asc" } }, { office: { level: "asc" } }, { fullName: "asc" }],
    take: 250,
  });

  const enrichmentRows = officials.length
    ? await prisma.profileWebsiteEnrichment.findMany({
        where: {
          targetType: "OFFICIAL",
          targetId: { in: officials.map((official) => official.id) },
          reviewStatus: { in: ["APPROVED", "VERIFIED"] },
        },
        orderBy: [{ reviewStatus: "desc" }, { lastEnrichedAt: "desc" }, { fetchedAt: "desc" }],
      })
    : [];
  const enrichmentByOfficialId = new Map<string, NonNullable<PublicOfficialRow["websiteEnrichment"]>>();
  for (const row of enrichmentRows) {
    const current = enrichmentByOfficialId.get(row.targetId);
    const headshotUrl = getValidatedProfileImageUrl(row.headshotUrl);
    if (!current) {
      enrichmentByOfficialId.set(row.targetId, {
        officialWebsiteUrl: row.officialWebsiteUrl,
        headshotUrl,
        shortBio: row.shortBio,
        publicContactEmail: row.publicContactEmail,
        publicContactPhone: row.publicContactPhone,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
      });
    } else if (!current.headshotUrl && headshotUrl) {
      current.headshotUrl = headshotUrl;
    }
  }

  return officials.map((official) => {
    const enrichment = enrichmentByOfficialId.get(official.id) ?? null;
    return {
      id: official.id,
      fullName: official.fullName,
      partyText: official.partyText,
      email: enrichment?.publicContactEmail ?? official.email,
      phone: enrichment?.publicContactPhone ?? official.phone,
      websiteUrl: enrichment?.officialWebsiteUrl ?? official.websiteUrl,
      photoUrl: enrichment?.headshotUrl ?? getValidatedProfileImageUrl(official.photoUrl),
      status: official.status,
      termStart: official.termStart,
      termEnd: official.termEnd,
      office: {
        title: official.office.title,
        level: official.office.level,
      },
      jurisdiction: {
        name: official.jurisdiction.name,
        slug: official.jurisdiction.slug,
        type: official.jurisdiction.type,
      },
      district: official.district
        ? {
            name: official.district.name,
            type: official.district.districtType,
          }
        : null,
      source: official.source,
      websiteEnrichment: enrichment
        ? {
            ...enrichment,
          }
        : null,
    };
  });
}

export type PublicImportedElectionRow = {
  id: string;
  slug: string;
  title: string;
  officeTitle: string;
  electionDate: Date;
  electionType: string;
  status: string;
  jurisdiction: {
    name: string;
    slug: string;
  };
  source: {
    name: string;
    url: string;
  } | null;
  candidateCount: number;
  ballotMeasureCount: number;
};

export type PublicImportedCandidateRow = {
  id: string;
  fullName: string;
  ballotName: string | null;
  partyText: string | null;
  status: string;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  campaignStatement: string | null;
  sourceUrl: string | null;
  filingStatus: string | null;
  filingDate: Date | null;
  electionId: string;
  electionSlug: string;
  electionTitle: string;
  electionDate: Date;
  officeTitle: string | null;
  districtName: string | null;
  jurisdictionName: string;
  jurisdictionSlug: string;
  source: {
    name: string;
    url: string;
  } | null;
  websiteEnrichment: {
    campaignWebsiteUrl: string | null;
    officialWebsiteUrl: string | null;
    headshotUrl: string | null;
    shortBio: string | null;
    longBioSourceUrl: string | null;
    socialLinks: string[];
    publicContactEmail: string | null;
    publicContactPhone: string | null;
    sourceName: string | null;
    sourceUrl: string;
    lastEnrichedAt: Date | null;
    enrichmentStatus: string;
    reviewStatus: string;
  } | null;
  knowledgeEnrichments: PublicCandidateKnowledgeSection[];
};

export type PublicBallotMeasureRow = {
  id: string;
  slug: string;
  title: string;
  questionNumber: string | null;
  summary: string | null;
  questionType: string;
  petitionStatus: string;
  passed: boolean | null;
  fullTextUrl: string | null;
  electionTitle: string;
  electionDate: Date;
  jurisdictionName: string;
  source: {
    name: string;
    url: string;
  } | null;
};

type PublicBallotQuestionRecord = Prisma.BallotQuestionGetPayload<{
  include: {
    election: { select: { title: true; electionDate: true } };
    jurisdiction: { select: { name: true } };
    source: { select: { name: true; url: true } };
  };
}>;

export async function getPublicImportedElections(): Promise<PublicImportedElectionRow[]> {
  const ballotInitiativeDelegate = prisma.ballotInitiative;
  const [elections, ballotMeasureCounts] = await Promise.all([
    prisma.election.findMany({
      include: {
        jurisdiction: { select: { name: true, slug: true } },
        source: { select: { name: true, url: true } },
        _count: {
          select: {
            candidates: true,
            ballotInitiatives: true,
          },
        },
      },
      orderBy: [{ electionDate: "desc" }, { title: "asc" }],
      take: 100,
    }),
    ballotInitiativeDelegate
      ? ballotInitiativeDelegate.groupBy({
          by: ["electionId"],
          _count: {
            _all: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const ballotMeasureCountByElectionId = new Map(ballotMeasureCounts.map((entry) => [entry.electionId, entry._count._all]));

  return elections.map((election) => ({
    id: election.id,
    slug: election.slug,
    title: election.title,
    officeTitle: election.officeTitle,
    electionDate: election.electionDate,
    electionType: election.electionType,
    status: election.status,
    jurisdiction: election.jurisdiction,
    source: election.source,
    candidateCount: election._count.candidates,
    ballotMeasureCount: ballotMeasureCountByElectionId.get(election.id) ?? election._count.ballotInitiatives,
  }));
}

export async function getPublicImportedCandidates(): Promise<PublicImportedCandidateRow[]> {
  const candidates = await prisma.candidate.findMany({
    include: {
      election: { select: { id: true, slug: true, title: true, electionDate: true } },
      office: { select: { title: true } },
      district: { select: { name: true } },
      jurisdiction: { select: { name: true, slug: true } },
      source: { select: { name: true, url: true } },
    },
    orderBy: [{ election: { electionDate: "desc" } }, { office: { title: "asc" } }, { fullName: "asc" }],
    take: 300,
  });
  let enrichmentRows: Awaited<ReturnType<typeof prisma.profileWebsiteEnrichment.findMany>> = [];

  if (candidates.length) {
    try {
      const enrichmentDelegate = (prisma as typeof prisma & {
        profileWebsiteEnrichment?: typeof prisma.profileWebsiteEnrichment;
      }).profileWebsiteEnrichment;

      enrichmentRows = enrichmentDelegate?.findMany
        ? await enrichmentDelegate.findMany({
            where: {
              targetType: "CANDIDATE",
              targetId: { in: candidates.map((candidate) => candidate.id) },
              reviewStatus: { in: ["APPROVED", "VERIFIED"] },
            },
            orderBy: [{ reviewStatus: "desc" }, { lastEnrichedAt: "desc" }, { fetchedAt: "desc" }],
          })
        : [];
    } catch (error) {
      console.warn("[civic-data] Candidate website enrichment is unavailable; rendering imported candidates without enrichment.", error);
      enrichmentRows = [];
    }
  }
  const enrichmentByCandidateId = new Map<string, NonNullable<PublicImportedCandidateRow["websiteEnrichment"]>>();
  for (const row of enrichmentRows) {
    const current = enrichmentByCandidateId.get(row.targetId);
    const headshotUrl = getValidatedProfileImageUrl(row.headshotUrl);
    if (!current) {
      enrichmentByCandidateId.set(row.targetId, {
        campaignWebsiteUrl: row.campaignWebsiteUrl,
        officialWebsiteUrl: row.officialWebsiteUrl,
        headshotUrl,
        shortBio: row.shortBio,
        longBioSourceUrl: row.longBioSourceUrl,
        socialLinks: Array.isArray(row.socialLinks) ? row.socialLinks.filter((link): link is string => typeof link === "string") : [],
        publicContactEmail: row.publicContactEmail,
        publicContactPhone: row.publicContactPhone,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        lastEnrichedAt: row.lastEnrichedAt,
        enrichmentStatus: row.enrichmentStatus,
        reviewStatus: row.reviewStatus,
      });
    } else if (!current.headshotUrl && headshotUrl) {
      current.headshotUrl = headshotUrl;
    }
  }
  const knowledgeByCandidateId = await getApprovedCandidateKnowledge(candidates.map((candidate) => candidate.id));

  return candidates.map((candidate) => ({
    id: candidate.id,
    fullName: candidate.fullName,
    ballotName: candidate.ballotName,
    partyText: candidate.partyText,
    status: candidate.status,
    websiteUrl: candidate.websiteUrl,
    email: candidate.email,
    phone: candidate.phone,
    photoUrl: candidate.photoUrl,
    campaignStatement: candidate.campaignStatement,
    sourceUrl: candidate.sourceUrl,
    filingStatus: candidate.filingStatus,
    filingDate: candidate.filingDate,
    electionId: candidate.election.id,
    electionSlug: candidate.election.slug,
    electionTitle: candidate.election.title,
    electionDate: candidate.election.electionDate,
    officeTitle: candidate.office?.title ?? null,
    districtName: candidate.district?.name ?? null,
    jurisdictionName: candidate.jurisdiction.name,
    jurisdictionSlug: candidate.jurisdiction.slug,
    source: candidate.source,
    websiteEnrichment: enrichmentByCandidateId.get(candidate.id) ?? null,
    knowledgeEnrichments: knowledgeByCandidateId.get(candidate.id) ?? [],
  }));
}

export async function getPublicBallotMeasures(): Promise<PublicBallotMeasureRow[]> {
  const ballotQuestionDelegate = prisma.ballotQuestion;
  if (!ballotQuestionDelegate) {
    console.warn("[civic-data] BallotQuestion Prisma delegate is unavailable. Run npx prisma generate.");
    return [];
  }

  let questions: PublicBallotQuestionRecord[];
  try {
    questions = await ballotQuestionDelegate.findMany({
      include: {
        election: { select: { title: true, electionDate: true } },
        jurisdiction: { select: { name: true } },
        source: { select: { name: true, url: true } },
      },
      orderBy: [{ election: { electionDate: "desc" } }, { questionNumber: "asc" }],
      take: 150,
    });
  } catch (error) {
    console.warn("[civic-data] Failed to load public ballot measures.", error);
    return [];
  }

  return questions.map((question) => ({
    id: question.id,
    slug: question.slug,
    title: question.title,
    questionNumber: question.questionNumber,
    summary: question.summary,
    questionType: question.questionType,
    petitionStatus: question.petitionStatus,
    passed: question.passed,
    fullTextUrl: question.fullTextUrl,
    electionTitle: question.election.title,
    electionDate: question.election.electionDate,
    jurisdictionName: question.jurisdiction.name,
    source: question.source,
  }));
}
