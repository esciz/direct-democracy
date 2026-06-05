import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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
};

export async function getPublicOfficials(jurisdictionSlug?: string): Promise<PublicOfficialRow[]> {
  const officials = await prisma.official.findMany({
    where: jurisdictionSlug
      ? {
          jurisdiction: {
            slug: jurisdictionSlug,
          },
        }
      : undefined,
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

  return officials.map((official) => ({
    id: official.id,
    fullName: official.fullName,
    partyText: official.partyText,
    email: official.email,
    phone: official.phone,
    websiteUrl: official.websiteUrl,
    photoUrl: official.photoUrl,
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
  }));
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
