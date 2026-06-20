import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { Prisma, VoteAnswer } from "@prisma/client";

import { getCommunityById } from "@/lib/community/communities";
import { generateVoteQuestionsFromApprovedIssuePositions } from "@/lib/issue-positions/store";
import { prisma } from "@/lib/prisma";
import { appendTaxCostContext } from "@/lib/public-meetings/financial-impact";
import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath } from "@/lib/public-meetings/shared";
import type { MeetingVotingCardRecord } from "@/lib/public-meetings/types";
import { getVoteObjectType } from "@/lib/votes/presentation";
import type {
  AuthUser,
  PublicQuestionType,
  VoteQuestionContextSource,
  VoteQuestionCardSummary,
  VotingLibraryFilters,
  VoteQuestionSummary,
  VoteResponseSummary,
} from "@/types/domain";

const DAILY_VOTE_ALLOTMENT = 20;
const PUBLIC_REVIEW_STATUSES = ["approved", "verified"] as const;

type PublicReviewStatus = (typeof PUBLIC_REVIEW_STATUSES)[number];

type SourceLike = {
  id?: string | null;
  name?: string | null;
  url?: string | null;
  updatedAt?: Date | null;
};

type RealQuestionSeed = {
  generationKey: string;
  questionText: string;
  jurisdictionId: string;
  scope: "local" | "state" | "national";
  civicEntityType:
    | "OFFICIAL"
    | "CANDIDATE"
    | "ISSUE_POSITION"
    | "ELECTION"
    | "BALLOT_MEASURE"
    | "BILL"
    | "LEGISLATIVE_VOTE"
    | "AGENDA_ITEM"
    | "REGISTRATION_TURNOUT";
  civicEntityId: string;
  civicEntityName: string;
  civicQuestionType:
    | "OFFICIAL_APPROVAL"
    | "OFFICIAL_RESPONSIVENESS"
    | "CANDIDATE_SUPPORT"
    | "ISSUE_POSITION_REVIEW"
    | "BILL_SUPPORT"
    | "LEGISLATIVE_VOTE_REVIEW"
    | "BALLOT_MEASURE_SUPPORT"
    | "ELECTION_ISSUE_PRIORITY"
    | "REGISTRATION_POLICY"
    | "TURNOUT_CONCERN";
  sourceId?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  sourceLastUpdatedAt?: Date | null;
  contextSummary?: string | null;
  yesEffectSummary?: string | null;
  noEffectSummary?: string | null;
  fiscalImpactSummary?: string | null;
  supporterArguments?: string[];
  opponentArguments?: string[];
  historicalContext?: string | null;
  neutralDecisionSummary?: string | null;
  priorityOptions?: string[];
  sourceLinks?: VoteQuestionContextSource[];
  affectedGroups?: string[];
  introducedBy?: string | null;
  introducedByRole?: string | null;
  officialBody?: string | null;
  officialPositionSummary?: string | null;
  officialVoteSummary?: string | null;
};

const questionInclude = {
  jurisdiction: true,
  source: true,
  responses: true,
} satisfies Prisma.VoteQuestionInclude;

type QuestionWithRelations = Prisma.VoteQuestionGetPayload<{ include: typeof questionInclude }>;
type QuestionWithUserResponse = Prisma.VoteQuestionGetPayload<{
  include: {
    jurisdiction: true;
    source: true;
    responses: true;
  };
}>;

function sourceName(source: SourceLike | null | undefined, fallback = "Imported public civic data") {
  return source?.name ?? fallback;
}

function sourceUrl(source: SourceLike | null | undefined, fallback?: string | null) {
  return fallback ?? source?.url ?? null;
}

function sourceLastUpdated(source: SourceLike | null | undefined, fallback?: Date | null) {
  return fallback ?? source?.updatedAt ?? null;
}

function isPublicStatus(status: string | null | undefined): status is PublicReviewStatus {
  return status === "approved" || status === "verified";
}

function getScopeForJurisdiction(jurisdictionSlug: string | null | undefined): "local" | "state" | "national" {
  if (jurisdictionSlug === "nevada") return "state";
  return "local";
}

function getCommunityLabel(question: VoteQuestionSummary) {
  if (question.scope === "national") return "National vote";
  if (question.scope === "state") return `${question.jurisdictionName} vote`;
  return `${question.jurisdictionName} vote`;
}

function getScopePriority(question: VoteQuestionSummary, user: AuthUser) {
  if (question.jurisdictionName === user.jurisdictionName) return 3;
  if (question.scope === "local") return 2;
  if (question.scope === "state") return 1;
  return 0;
}

function isRelevantQuestion(question: VoteQuestionSummary, user: AuthUser, communityId?: string) {
  const community = communityId ? getCommunityById(communityId) : null;

  if (community) {
    return community.jurisdictionMatches.includes(question.jurisdictionName);
  }

  if (question.scope === "national" || question.jurisdictionName === "Nevada") {
    return true;
  }

  return question.jurisdictionName === user.jurisdictionName;
}

function getObjectPriority(question: VoteQuestionSummary) {
  const objectType = getVoteObjectType(question);

  if (objectType === "representative") return 4;
  if (objectType === "decision") return 3;
  if (objectType === "case") return 2;
  return 1;
}

function getQuestionObjectType(entityType: string | null | undefined): VoteQuestionSummary["objectType"] {
  if (entityType === "OFFICIAL" || entityType === "CANDIDATE") return "representative";
  if (entityType === "ISSUE_POSITION") return "representative";
  if (entityType === "ELECTION" || entityType === "REGISTRATION_TURNOUT") return "community";
  return "decision";
}

function getQuestionVoteType(entityType: string | null | undefined): VoteQuestionSummary["voteType"] {
  if (entityType === "OFFICIAL" || entityType === "CANDIDATE") return "representativeVote";
  if (entityType === "ISSUE_POSITION") return "publicVote";
  if (entityType === "BALLOT_MEASURE") return "ballotMeasure";
  if (entityType === "BILL" || entityType === "LEGISLATIVE_VOTE") return "legislation";
  return "publicVote";
}

function inferPublicQuestionType(
  questionType: string | null | undefined,
  questionText = "",
  entityType?: string | null,
): PublicQuestionType {
  if (questionType === "BALLOT_MEASURE_SUPPORT" || entityType === "BALLOT_MEASURE") return "BALLOT_MEASURE_DECISION";
  if (questionType === "BILL_SUPPORT" || questionType === "LEGISLATIVE_VOTE_REVIEW" || entityType === "BILL" || entityType === "LEGISLATIVE_VOTE") {
    return "LEGISLATION_DECISION";
  }
  if (questionType === "CANDIDATE_SUPPORT" || entityType === "CANDIDATE") return "CANDIDATE_PERFORMANCE";
  if (questionType === "OFFICIAL_APPROVAL" || questionType === "OFFICIAL_RESPONSIVENESS" || entityType === "OFFICIAL") return "ELECTED_OFFICIAL_PERFORMANCE";
  if (questionType === "ELECTION_ISSUE_PRIORITY" || /\b(which issue|most important|top concern|priority|priorities)\b/i.test(questionText)) {
    return "COMMUNITY_PRIORITY_POLL";
  }

  return "GENERAL_SENTIMENT";
}

function getPriorityOptions(questionText: string, fallbackJurisdiction?: string | null) {
  if (/\b(which issue|most important|top concern|priority|priorities)\b/i.test(questionText)) {
    return [
      "Economy / cost of living",
      "Education / public services",
      "Housing / public safety",
    ];
  }

  return [
    fallbackJurisdiction ? `${fallbackJurisdiction} services` : "Local services",
    "Taxes / affordability",
    "Another priority",
  ];
}

function getResponseLabels(
  questionType: string | null | undefined,
  questionText = "",
  entityType?: string | null,
  jurisdictionName?: string | null,
): VoteQuestionSummary["responseLabels"] {
  const publicQuestionType = inferPublicQuestionType(questionType, questionText, entityType);

  if (publicQuestionType === "COMMUNITY_PRIORITY_POLL") {
    const options = getPriorityOptions(questionText, jurisdictionName);
    return { yes: options[0], no: options[1], skip: options[2] };
  }

  if (publicQuestionType === "BALLOT_MEASURE_DECISION") {
    return { yes: "Vote yes", skip: "Undecided", no: "Vote no" };
  }

  if (publicQuestionType === "LEGISLATION_DECISION") {
    return { yes: "Support", skip: "Undecided", no: "Oppose" };
  }

  if (publicQuestionType === "CANDIDATE_PERFORMANCE" || publicQuestionType === "ELECTED_OFFICIAL_PERFORMANCE") {
    return { yes: "Approve", skip: "Unsure", no: "Disapprove" };
  }

  if (questionType === "OFFICIAL_APPROVAL" || questionType === "OFFICIAL_RESPONSIVENESS") {
    return { yes: "Approve", skip: "Mixed", no: "Disapprove" };
  }

  if (questionType === "CANDIDATE_SUPPORT") {
    return { yes: "Support", skip: "Unsure", no: "Oppose" };
  }

  if (questionType === "ISSUE_POSITION_REVIEW") {
    return { yes: "Agree", skip: "Need more context", no: "Disagree" };
  }

  if (questionType === "BALLOT_MEASURE_SUPPORT") {
    return { yes: "Vote yes", skip: "Undecided", no: "Vote no" };
  }

  return { yes: "Support", skip: "Undecided", no: "Oppose" };
}

function isNevadaQuestion1(questionNumber?: string | null, title?: string | null, entityName?: string | null) {
  const haystack = [questionNumber, title, entityName].filter(Boolean).join(" ").toLowerCase();
  return /\b(question\s*)?1\b/.test(haystack) && /regents|higher education|state university/.test(haystack);
}

function getNevadaQuestion1Context(sourceUrl?: string | null): Pick<
  VoteQuestionSummary,
  | "plainLanguageSummary"
  | "yesEffectSummary"
  | "noEffectSummary"
  | "fiscalImpactSummary"
  | "affectedGroups"
  | "supporterArguments"
  | "opponentArguments"
  | "historicalContext"
  | "neutralDecisionSummary"
  | "sourceLinks"
> {
  return {
    plainLanguageSummary:
      "Question 1 would remove the Board of Regents' constitutional status and require the Legislature to provide by law for governance of Nevada's public higher education system. Existing statutes creating the Board of Regents and its election process would not automatically disappear, but future legislatures could change the governance structure more easily.",
    yesEffectSummary:
      "A YES vote removes constitutional provisions governing the Board of Regents' election, duties, and control over State University affairs and funds; requires the Legislature to provide by law for higher education governance; requires biennial audits of public higher education institutions; and makes future governance changes possible through ordinary legislation.",
    noEffectSummary:
      "A NO vote keeps the Board of Regents' current constitutional status, preserves the current constitutional language governing the Board's role, and keeps major structural changes harder because they would still require constitutional amendment or existing legal limits.",
    fiscalImpactSummary:
      "Financial impact cannot be determined with reasonable certainty. Future legislative governance changes are unknown; biennial audits would have a state cost depending on scope; and the land grant fund language clarification does not change the federally required purpose or use of those funds.",
    affectedGroups: ["Nevada System of Higher Education", "Board of Regents", "Nevada Legislature", "public higher education students, staff, and institutions"],
    supporterArguments: [
      "More legislative oversight and accountability.",
      "More flexibility to reform higher education governance.",
      "Prevents the Board from using constitutional status to avoid legislative scrutiny.",
      "Could improve transparency and responsiveness.",
    ],
    opponentArguments: [
      "Could increase political influence over higher education.",
      "May reduce institutional independence and academic freedom.",
      "Existing legislative oversight already exists through budget authority and audits.",
      "Could eventually allow lawmakers to change whether Regents are elected.",
    ],
    historicalContext:
      "Nevada voters considered a similar constitutional change in 2020. Question 1 renewed the debate over whether higher education governance should remain constitutionally protected or be easier for the Legislature to restructure.",
    neutralDecisionSummary:
      "The practical question is whether Nevada higher education governance should remain constitutionally protected and relatively independent, or whether the Legislature should have more flexibility to change governance through ordinary law. A YES vote favors flexibility and legislative oversight. A NO vote favors continuity, independence, and keeping the current constitutional protection.",
    sourceLinks: compactList([
      sourceUrl,
      "https://www.nvsos.gov/sos/Home/Components/News/News/3522/23",
      "https://www.leg.state.nv.us/Division/Research/Documents/Q1_SJR7%28BoardofRegents%29_PublicComment.pdf",
      "https://ballotpedia.org/Nevada_Question_1%2C_Remove_Constitutional_Status_of_Board_of_Regents_Amendment_%282024%29",
    ]).map((url) => ({
      label: url.includes("ballotpedia.org")
        ? "Ballotpedia neutral summary"
        : url.includes("leg.state.nv.us")
          ? "Nevada Legislative Counsel Bureau fiscal/context material"
          : "Nevada Secretary of State official ballot material",
      url,
      sourceType: url.includes("ballotpedia.org") ? "secondary" : "official",
    })),
  };
}

function normalizeBallotQuestionLabel(questionNumber: string | null | undefined, fallbackTitle: string) {
  const clean = questionNumber?.trim();

  if (!clean) return fallbackTitle;
  if (/^question\s+/i.test(clean)) return clean.replace(/^question/i, "Question");
  if (/^q(?:uestion)?\s*\d+/i.test(clean)) return clean.replace(/^q(?:uestion)?/i, "Question").replace(/\s+/, " ");
  return `Question ${clean}`;
}

function compactList(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

async function readMeetingVotingCards() {
  const filePath = absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.meetingVotingCards);
  if (!existsSync(filePath)) return [];
  return JSON.parse(await readFile(filePath, "utf8")) as MeetingVotingCardRecord[];
}

function normalizeJurisdictionName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function getMeetingVotingQuestionSeeds(): Promise<RealQuestionSeed[]> {
  const cards = (await readMeetingVotingCards()).filter((card) => card.review_status === "approved" && card.confidence_score >= 0.8);
  if (!cards.length) return [];
  const jurisdictions = await prisma.jurisdiction.findMany();
  const jurisdictionByName = new Map(jurisdictions.map((jurisdiction) => [normalizeJurisdictionName(jurisdiction.name), jurisdiction]));
  const nevada = jurisdictions.find((jurisdiction) => jurisdiction.slug === "nevada") ?? jurisdictions[0] ?? null;

  return cards.flatMap((card): RealQuestionSeed[] => {
    const jurisdiction = jurisdictionByName.get(normalizeJurisdictionName(card.jurisdiction)) ?? nevada;
    if (!jurisdiction) return [];
    const fiscalContext = card.financial_impact ? ` Financial impact: ${card.financial_impact}` : "";
    const outcomeContext = card.outcome_text ? ` Outcome recorded: ${card.outcome_text}` : "";
    const sourceContext = [card.source_item_number, card.source_title ?? card.agenda_language_original].filter(Boolean).join(" / ");
    const bodyContext = card.governing_body_display_name ?? card.body_name;
    const contextSummary = appendTaxCostContext(
      `${card.citizen_summary ?? card.plain_language_summary}${outcomeContext}${fiscalContext}${sourceContext ? ` Source detail: ${sourceContext}.` : ""}`,
      card.financial_impact_context,
    );
    return [{
      generationKey: card.generation_key,
      questionText: card.public_question ?? card.question_text,
      jurisdictionId: jurisdiction.id,
      scope: getScopeForJurisdiction(jurisdiction.slug),
      civicEntityType: "AGENDA_ITEM",
      civicEntityId: card.topic_item_id,
      civicEntityName: card.source_title ?? card.agenda_language_original ?? card.title,
      civicQuestionType: "ISSUE_POSITION_REVIEW",
      sourceId: null,
      sourceName: `${bodyContext} meeting record`,
      sourceUrl: card.source_url,
      sourceLastUpdatedAt: card.updated_at ? new Date(card.updated_at) : new Date(),
      contextSummary,
      yesEffectSummary: `A support response records that you support the source-backed meeting action described here.`,
      noEffectSummary: `An oppose response records that you do not support the source-backed meeting action described here.`,
      affectedGroups: card.affected_groups,
      officialBody: bodyContext,
      officialVoteSummary: card.needs_roll_call_review
        ? "Outcome recorded; individual official votes pending review."
        : card.outcome_text,
    }];
  });
}

function mapQuestion(row: QuestionWithRelations, userId: string): VoteQuestionCardSummary {
  const responses = row.responses;
  const results = {
    yes: responses.filter((response) => response.answer === "yes").length,
    no: responses.filter((response) => response.answer === "no").length,
    skip: responses.filter((response) => response.answer === "skip").length,
  };
  const totalResponses = responses.length;
  const percentages = {
    yes: totalResponses ? Math.round((results.yes / totalResponses) * 100) : 0,
    no: totalResponses ? Math.round((results.no / totalResponses) * 100) : 0,
    skip: totalResponses ? Math.round((results.skip / totalResponses) * 100) : 0,
  };
  const userResponse = responses.find((response) => response.userId === userId);
  const sourceUrlValue = row.sourceUrl ?? row.source?.url ?? null;
  const sourceNameValue = row.sourceName ?? row.source?.name ?? "Imported public civic data";
  const questionType = inferPublicQuestionType(row.civicQuestionType, row.questionText, row.civicEntityType);
  const priorityOptions = questionType === "COMMUNITY_PRIORITY_POLL" ? getPriorityOptions(row.questionText, row.jurisdiction.name) : undefined;
  const nevadaQuestion1Context = isNevadaQuestion1(undefined, row.questionText, row.civicEntityName)
    ? getNevadaQuestion1Context(sourceUrlValue)
    : null;
  const defaultSourceLinks: VoteQuestionContextSource[] = compactList([sourceUrlValue]).map((url) => ({
    label: sourceNameValue,
    url,
    sourceType: "official",
  }));
  const isBallotMeasure = questionType === "BALLOT_MEASURE_DECISION";

  return {
    id: row.id,
    questionText: row.questionText,
    questionType,
    category: row.category,
    scope: row.scope,
    jurisdictionId: row.jurisdictionId,
    jurisdictionName: row.jurisdiction.name,
    objectType: getQuestionObjectType(row.civicEntityType),
    civicEntityType: row.civicEntityType,
    voteType: getQuestionVoteType(row.civicEntityType),
    status: "active",
    origin: "officialDecision",
    shortTitle: row.civicEntityName ?? undefined,
    subjectName: row.civicEntityName,
    contextSummary: nevadaQuestion1Context?.plainLanguageSummary ?? row.contextSummary,
    plainLanguageSummary: nevadaQuestion1Context?.plainLanguageSummary ?? row.contextSummary ?? undefined,
    whyItMatters: row.contextSummary ? "This question is tied to a reviewed, source-attributed public record." : undefined,
    whoIsAffected: row.affectedGroups.length ? row.affectedGroups.join(", ") : undefined,
    affectedGroups: nevadaQuestion1Context?.affectedGroups ?? row.affectedGroups,
    whatYesMeans: nevadaQuestion1Context?.yesEffectSummary ?? row.yesEffectSummary ?? undefined,
    whatNoMeans: nevadaQuestion1Context?.noEffectSummary ?? row.noEffectSummary ?? undefined,
    yesEffectSummary: nevadaQuestion1Context?.yesEffectSummary ?? row.yesEffectSummary,
    noEffectSummary: nevadaQuestion1Context?.noEffectSummary ?? row.noEffectSummary,
    fiscalImpactSummary: nevadaQuestion1Context?.fiscalImpactSummary ?? (isBallotMeasure ? "No official fiscal note found yet." : null),
    supporterArguments: nevadaQuestion1Context?.supporterArguments ?? [],
    opponentArguments: nevadaQuestion1Context?.opponentArguments ?? [],
    historicalContext: nevadaQuestion1Context?.historicalContext ?? null,
    neutralDecisionSummary:
      nevadaQuestion1Context?.neutralDecisionSummary ??
      (isBallotMeasure
        ? "Review the plain-language summary, the YES and NO effects, the fiscal note status, and the listed sources before deciding how to vote."
        : null),
    priorityOptions,
    sourceLinks: nevadaQuestion1Context?.sourceLinks ?? defaultSourceLinks,
    introducedBy: row.introducedBy ?? undefined,
    introducedByRole: row.introducedByRole ?? undefined,
    officialBody: row.officialBody ?? undefined,
    officialPositionSummary: row.officialPositionSummary ?? undefined,
    officialVoteSummary: row.officialVoteSummary ?? undefined,
    responseLabels: getResponseLabels(row.civicQuestionType, row.questionText, row.civicEntityType, row.jurisdiction.name),
    relatedIssueLabel: row.civicEntityType?.replace(/_/g, " ").toLowerCase().replace(/^./, (value) => value.toUpperCase()),
    weekOf: row.createdAt.toISOString(),
    sourceName: sourceNameValue,
    sourceUrl: sourceUrlValue,
    sourceLastUpdated: (row.sourceLastUpdatedAt ?? row.updatedAt).toISOString(),
    confidenceScore: row.confidenceScore,
    verificationStatus: row.verificationStatus,
    reviewStatus: row.reviewStatus,
    realDataBadge: row.generatedFromRealData,
    totalResponses,
    results,
    percentages,
    userAnswer: userResponse?.answer ?? null,
    previousUserVote: null,
    voteUpdatedAt: userResponse?.updatedAt.toISOString() ?? null,
    votingPeriodStatus: "open",
    canChangeVote: true,
    communityLabel: getCommunityLabel({
      id: row.id,
      questionText: row.questionText,
      category: row.category,
      scope: row.scope,
      jurisdictionId: row.jurisdictionId,
      jurisdictionName: row.jurisdiction.name,
    }),
  };
}

function mapQuestionWithSparseResponses(row: QuestionWithUserResponse, userId: string): VoteQuestionCardSummary {
  return mapQuestion(row as QuestionWithRelations, userId);
}

async function upsertReviewAndQuestion(seed: RealQuestionSeed) {
  await prisma.civicEntityReview.upsert({
    where: {
      entityType_entityId: {
        entityType: seed.civicEntityType,
        entityId: seed.civicEntityId,
      },
    },
    create: {
      entityType: seed.civicEntityType,
      entityId: seed.civicEntityId,
      entityName: seed.civicEntityName,
      jurisdictionId: seed.jurisdictionId,
      sourceId: seed.sourceId,
      sourceUrl: seed.sourceUrl,
      sourceName: seed.sourceName,
      reviewStatus: "approved",
      verificationStatus: "imported",
      confidenceScore: 0.9,
      summary: `Imported ${seed.civicEntityType.toLowerCase().replace(/_/g, " ")} record used for civic signal generation.`,
      lastUpdatedAt: seed.sourceLastUpdatedAt ?? new Date(),
    },
    update: {
      entityName: seed.civicEntityName,
      jurisdictionId: seed.jurisdictionId,
      sourceId: seed.sourceId,
      sourceUrl: seed.sourceUrl,
      sourceName: seed.sourceName,
      lastUpdatedAt: seed.sourceLastUpdatedAt ?? new Date(),
    },
  });

  const existingQuestion = await prisma.voteQuestion.findFirst({
    where: { generationKey: seed.generationKey },
    select: { id: true },
  });

  if (existingQuestion) {
    await prisma.voteQuestion.update({
      where: { id: existingQuestion.id },
      data: {
        questionText: seed.questionText,
        sourceId: seed.sourceId,
        sourceUrl: seed.sourceUrl,
        sourceName: seed.sourceName,
        sourceLastUpdatedAt: seed.sourceLastUpdatedAt,
        civicEntityName: seed.civicEntityName,
        contextSummary: seed.contextSummary,
        yesEffectSummary: seed.yesEffectSummary,
        noEffectSummary: seed.noEffectSummary,
        affectedGroups: seed.affectedGroups ?? [],
        introducedBy: seed.introducedBy,
        introducedByRole: seed.introducedByRole,
        officialBody: seed.officialBody,
        officialPositionSummary: seed.officialPositionSummary,
        officialVoteSummary: seed.officialVoteSummary,
        reviewStatus: "approved",
        generatedFromRealData: true,
      },
    });
    await prisma.voteQuestion.deleteMany({
      where: {
        generationKey: seed.generationKey,
        id: { not: existingQuestion.id },
      },
    });
    return;
  }

  await prisma.voteQuestion.create({
    data: {
      generationKey: seed.generationKey,
      questionText: seed.questionText,
      category: "civic",
      scope: seed.scope,
      jurisdictionId: seed.jurisdictionId,
      sourceId: seed.sourceId,
      sourceUrl: seed.sourceUrl,
      sourceName: seed.sourceName,
      sourceLastUpdatedAt: seed.sourceLastUpdatedAt,
      civicEntityType: seed.civicEntityType,
      civicEntityId: seed.civicEntityId,
      civicEntityName: seed.civicEntityName,
      civicQuestionType: seed.civicQuestionType,
      contextSummary: seed.contextSummary,
      yesEffectSummary: seed.yesEffectSummary,
      noEffectSummary: seed.noEffectSummary,
      affectedGroups: seed.affectedGroups ?? [],
      introducedBy: seed.introducedBy,
      introducedByRole: seed.introducedByRole,
      officialBody: seed.officialBody,
      officialPositionSummary: seed.officialPositionSummary,
      officialVoteSummary: seed.officialVoteSummary,
      confidenceScore: 0.9,
      reviewStatus: "approved",
      verificationStatus: "imported",
      generatedFromRealData: true,
    },
  });
}

export async function ensureInitialRealDataCivicQuestions() {
  const [officials, candidates, ballotQuestions, bills, legislativeVotes, elections, registrationStats] = await Promise.all([
    prisma.official.findMany({
      where: { sourceId: { not: null }, status: "CURRENT" },
      include: { jurisdiction: true, office: true, source: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.candidate.findMany({
      where: { sourceId: { not: null }, status: { not: "NEEDS_REVIEW" } },
      include: { jurisdiction: true, office: true, election: true, source: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.ballotQuestion.findMany({
      where: { sourceId: { not: null } },
      include: { jurisdiction: true, election: true, source: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.legislativeBill.findMany({
      where: { sourceId: { not: null } },
      include: { jurisdiction: true, source: true, sponsors: { include: { official: true } } },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.legislativeVote.findMany({
      where: { sourceId: { not: null } },
      include: { bill: { include: { jurisdiction: true, sponsors: { include: { official: true } } } }, source: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.election.findMany({
      where: { sourceId: { not: null } },
      include: { jurisdiction: true, source: true },
      orderBy: { electionDate: "desc" },
      take: 20,
    }),
    prisma.voterRegistrationStatistic.findMany({
      where: { sourceId: { not: null } },
      include: { jurisdiction: true, source: true },
      orderBy: { reportDate: "desc" },
      take: 20,
    }),
  ]);

  const meetingVotingSeeds = await getMeetingVotingQuestionSeeds();
  const seeds: RealQuestionSeed[] = [
    ...meetingVotingSeeds,
    ...officials.flatMap((official): RealQuestionSeed[] => [
      {
        generationKey: `real:official:${official.id}:approval`,
        questionText: `Do you approve of ${official.fullName}'s performance as ${official.office.title}?`,
        jurisdictionId: official.jurisdictionId,
        scope: getScopeForJurisdiction(official.jurisdiction.slug),
        civicEntityType: "OFFICIAL",
        civicEntityId: official.id,
        civicEntityName: official.fullName,
        civicQuestionType: "OFFICIAL_APPROVAL",
        sourceId: official.sourceId,
        sourceName: sourceName(official.source),
        sourceUrl: sourceUrl(official.source, official.websiteUrl),
        sourceLastUpdatedAt: sourceLastUpdated(official.source, official.updatedAt),
        contextSummary: `${official.fullName} is listed in stored civic data as ${official.office.title} for ${official.jurisdiction.name}.`,
        affectedGroups: compactList([official.jurisdiction.name, official.office.title]),
        officialBody: official.office.title,
      },
      {
        generationKey: `real:official:${official.id}:responsiveness`,
        questionText: `How responsive has ${official.fullName} been to community concerns?`,
        jurisdictionId: official.jurisdictionId,
        scope: getScopeForJurisdiction(official.jurisdiction.slug),
        civicEntityType: "OFFICIAL",
        civicEntityId: official.id,
        civicEntityName: official.fullName,
        civicQuestionType: "OFFICIAL_RESPONSIVENESS",
        sourceId: official.sourceId,
        sourceName: sourceName(official.source),
        sourceUrl: sourceUrl(official.source, official.websiteUrl),
        sourceLastUpdatedAt: sourceLastUpdated(official.source, official.updatedAt),
        contextSummary: `${official.fullName} is listed in stored civic data as ${official.office.title} for ${official.jurisdiction.name}.`,
        affectedGroups: compactList([official.jurisdiction.name, official.office.title]),
        officialBody: official.office.title,
      },
    ]),
    ...candidates.map((candidate): RealQuestionSeed => ({
      generationKey: `real:candidate:${candidate.id}:support`,
      questionText: `Would you support ${candidate.ballotName ?? candidate.fullName} in ${candidate.election.title}?`,
      jurisdictionId: candidate.jurisdictionId,
      scope: getScopeForJurisdiction(candidate.jurisdiction.slug),
      civicEntityType: "CANDIDATE",
      civicEntityId: candidate.id,
      civicEntityName: candidate.ballotName ?? candidate.fullName,
      civicQuestionType: "CANDIDATE_SUPPORT",
      sourceId: candidate.sourceId,
      sourceName: sourceName(candidate.source),
      sourceUrl: sourceUrl(candidate.source, candidate.sourceUrl ?? candidate.websiteUrl),
      sourceLastUpdatedAt: sourceLastUpdated(candidate.source, candidate.updatedAt),
      contextSummary: `${candidate.ballotName ?? candidate.fullName} is listed in stored civic data as a candidate for ${candidate.office?.title ?? candidate.election.officeTitle} in ${candidate.jurisdiction.name}.`,
      affectedGroups: compactList([candidate.jurisdiction.name, candidate.office?.title ?? candidate.election.officeTitle]),
      officialBody: candidate.office?.title ?? candidate.election.officeTitle,
    })),
    ...ballotQuestions.map((question): RealQuestionSeed => {
      const normalizedLabel = normalizeBallotQuestionLabel(question.questionNumber, question.title);
      const entityName = question.questionNumber ? `Question ${question.questionNumber}: ${question.title}` : question.title;
      const resolvedSourceUrl = sourceUrl(question.source, question.fullTextUrl);
      const question1Context = isNevadaQuestion1(question.questionNumber, question.title, entityName)
        ? getNevadaQuestion1Context(resolvedSourceUrl)
        : null;

      return {
        generationKey: `real:ballot-question:${question.id}:support`,
        questionText: `Would you vote Yes or No on ${normalizedLabel}?`,
        jurisdictionId: question.jurisdictionId,
        scope: getScopeForJurisdiction(question.jurisdiction.slug),
        civicEntityType: "BALLOT_MEASURE",
        civicEntityId: question.id,
        civicEntityName: entityName,
        civicQuestionType: "BALLOT_MEASURE_SUPPORT",
        sourceId: question.sourceId,
        sourceName: sourceName(question.source),
        sourceUrl: resolvedSourceUrl,
        sourceLastUpdatedAt: sourceLastUpdated(question.source, question.updatedAt),
        contextSummary: question1Context?.plainLanguageSummary ?? question.summary ?? question.officialText ?? null,
        yesEffectSummary: question1Context?.yesEffectSummary ?? null,
        noEffectSummary: question1Context?.noEffectSummary ?? null,
        fiscalImpactSummary: question1Context?.fiscalImpactSummary ?? null,
        supporterArguments: question1Context?.supporterArguments ?? [],
        opponentArguments: question1Context?.opponentArguments ?? [],
        historicalContext: question1Context?.historicalContext ?? null,
        neutralDecisionSummary: question1Context?.neutralDecisionSummary ?? null,
        sourceLinks: question1Context?.sourceLinks,
        affectedGroups:
          question1Context?.affectedGroups ??
          compactList([question.jurisdiction.name, question.election.title, question.questionType.replace(/_/g, " ").toLowerCase()]),
      };
    }),
    ...bills.map((bill): RealQuestionSeed => {
      const primarySponsor = bill.sponsors.find((sponsor) => sponsor.isPrimary) ?? bill.sponsors[0] ?? null;

      return {
      generationKey: `real:bill:${bill.id}:support`,
      questionText: `Do you support ${bill.billNumber}: ${bill.title}?`,
      jurisdictionId: bill.jurisdictionId,
      scope: getScopeForJurisdiction(bill.jurisdiction.slug),
      civicEntityType: "BILL",
      civicEntityId: bill.id,
      civicEntityName: `${bill.billNumber}: ${bill.title}`,
      civicQuestionType: "BILL_SUPPORT",
      sourceId: bill.sourceId,
      sourceName: sourceName(bill.source),
      sourceUrl: sourceUrl(bill.source, bill.billUrl),
      sourceLastUpdatedAt: sourceLastUpdated(bill.source, bill.updatedAt),
      contextSummary: bill.summary,
      affectedGroups: compactList([bill.jurisdiction.name, bill.chamber.replace(/_/g, " ").toLowerCase()]),
      introducedBy: primarySponsor?.official.fullName ?? null,
      introducedByRole: null,
      officialBody: bill.chamber.replace(/_/g, " ").toLowerCase(),
    };
    }),
    ...legislativeVotes.map((vote): RealQuestionSeed => {
      const primarySponsor = vote.bill.sponsors.find((sponsor) => sponsor.isPrimary) ?? vote.bill.sponsors[0] ?? null;

      return {
      generationKey: `real:legislative-vote:${vote.id}:review`,
      questionText: `Should lawmakers have voted differently on ${vote.bill.billNumber}: ${vote.motion}?`,
      jurisdictionId: vote.bill.jurisdictionId,
      scope: getScopeForJurisdiction(vote.bill.jurisdiction.slug),
      civicEntityType: "LEGISLATIVE_VOTE",
      civicEntityId: vote.id,
      civicEntityName: `${vote.bill.billNumber} vote`,
      civicQuestionType: "LEGISLATIVE_VOTE_REVIEW",
      sourceId: vote.sourceId,
      sourceName: sourceName(vote.source),
      sourceUrl: sourceUrl(vote.source),
      sourceLastUpdatedAt: sourceLastUpdated(vote.source, vote.updatedAt),
      contextSummary: vote.bill.summary,
      affectedGroups: compactList([vote.bill.jurisdiction.name, vote.chamber.replace(/_/g, " ").toLowerCase()]),
      introducedBy: primarySponsor?.official.fullName ?? null,
      introducedByRole: null,
      officialBody: vote.chamber.replace(/_/g, " ").toLowerCase(),
      officialVoteSummary: `${vote.motion} resulted in ${vote.result.replace(/_/g, " ").toLowerCase()}.`,
    };
    }),
    ...elections.map((election): RealQuestionSeed => ({
      generationKey: `real:election:${election.id}:issue-priority`,
      questionText: `Which issue is most important in ${election.title}?`,
      jurisdictionId: election.jurisdictionId,
      scope: getScopeForJurisdiction(election.jurisdiction.slug),
      civicEntityType: "ELECTION",
      civicEntityId: election.id,
      civicEntityName: election.title,
      civicQuestionType: "ELECTION_ISSUE_PRIORITY",
      sourceId: election.sourceId,
      sourceName: sourceName(election.source),
      sourceUrl: sourceUrl(election.source),
      sourceLastUpdatedAt: sourceLastUpdated(election.source, election.updatedAt),
      contextSummary: `Choose the issue area you think should receive the most attention in ${election.title}. This priority signal helps compare voter concerns around a reviewed public election record.`,
      priorityOptions: getPriorityOptions(`Which issue is most important in ${election.title}?`, election.jurisdiction.name),
      affectedGroups: compactList([election.jurisdiction.name, election.officeTitle]),
    })),
    ...registrationStats.map((stat): RealQuestionSeed => ({
      generationKey: `real:registration-turnout:${stat.id}:concern`,
      questionText: `How concerned are you about voter participation in ${stat.jurisdiction.name}?`,
      jurisdictionId: stat.jurisdictionId,
      scope: getScopeForJurisdiction(stat.jurisdiction.slug),
      civicEntityType: "REGISTRATION_TURNOUT",
      civicEntityId: stat.id,
      civicEntityName: `${stat.jurisdiction.name} voter registration`,
      civicQuestionType: "TURNOUT_CONCERN",
      sourceId: stat.sourceId,
      sourceName: sourceName(stat.source, stat.sourceName ?? "Voter registration statistics"),
      sourceUrl: sourceUrl(stat.source, stat.sourceUrl),
      sourceLastUpdatedAt: sourceLastUpdated(stat.source, stat.updatedAt),
      contextSummary: `${stat.jurisdiction.name} voter registration statistics are stored from ${stat.sourceName}.`,
      affectedGroups: compactList([stat.jurisdiction.name, "registered voters"]),
    })),
  ].filter((seed) => Boolean(seed.sourceUrl || seed.sourceId));

  await Promise.all(seeds.map(upsertReviewAndQuestion));
  await generateVoteQuestionsFromApprovedIssuePositions();
}

export async function getStoredVoteResponses(): Promise<VoteResponseSummary[]> {
  const responses = await prisma.voteResponse.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return responses.map((response) => ({
    id: response.id,
    userId: response.userId,
    questionId: response.questionId,
    answer: response.answer,
    createdAt: response.createdAt.toISOString(),
  }));
}

export async function setStoredVoteResponses(_responses?: VoteResponseSummary[]) {
  return;
}

export async function setStoredVoteQuestions(_questions?: VoteQuestionSummary[]) {
  return;
}

export async function getStoredVoteQuestions(): Promise<VoteQuestionSummary[]> {
  return [];
}

export async function getAllVoteQuestions() {
  const questions = await prisma.voteQuestion.findMany({
    where: {
      generatedFromRealData: true,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
      sourceUrl: { not: null },
    },
    include: questionInclude,
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  return questions.map((question) => mapQuestion(question, ""));
}

export async function getQuickVoteCardsForUser(user: AuthUser, communityId?: string): Promise<VoteQuestionCardSummary[]> {
  const questions = await prisma.voteQuestion.findMany({
    where: {
      generatedFromRealData: true,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
      sourceUrl: { not: null },
    },
    include: questionInclude,
    orderBy: [{ updatedAt: "desc" }],
    take: 200,
  });

  return questions
    .map((question) => mapQuestion(question, user.id))
    .filter((question) => isRelevantQuestion(question, user, communityId))
    .sort((left, right) => {
      const objectDelta = getObjectPriority(right) - getObjectPriority(left);
      if (objectDelta) return objectDelta;

      const scopeDelta = getScopePriority(right, user) - getScopePriority(left, user);
      if (scopeDelta) return scopeDelta;

      return Date.parse(right.weekOf ?? "1970-01-01") - Date.parse(left.weekOf ?? "1970-01-01");
    });
}

function civicEntityTypesForVotingFilter(filter: "all" | "people" | "issues" | "cases") {
  if (filter === "people") return ["OFFICIAL", "CANDIDATE"] as const;
  if (filter === "issues") return ["ISSUE_POSITION", "AGENDA_ITEM", "BILL", "LEGISLATIVE_VOTE"] as const;
  if (filter === "cases") return ["BALLOT_MEASURE", "ELECTION", "REGISTRATION_TURNOUT"] as const;
  return undefined;
}

function votingQuestionWhere(user: AuthUser, filter: "all" | "people" | "issues" | "cases") {
  const entityTypes = civicEntityTypesForVotingFilter(filter);
  return {
    generatedFromRealData: true,
    reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
    sourceUrl: { not: null },
    ...(entityTypes ? { civicEntityType: { in: [...entityTypes] } } : {}),
    OR: [
      { scope: { in: ["state", "national"] } },
      { jurisdiction: { name: user.jurisdictionName } },
    ],
  } satisfies Prisma.VoteQuestionWhereInput;
}

export type VotingQuestionWindow = {
  activeQuestion: VoteQuestionCardSummary | null;
  total: number;
};

export async function getVotingQuestionWindow(
  user: AuthUser,
  options: {
    filter: "all" | "people" | "issues" | "cases";
    index: number;
  },
): Promise<VotingQuestionWindow> {
  const where = votingQuestionWhere(user, options.filter);
  const total = await prisma.voteQuestion.count({ where });
  const index = Math.min(Math.max(options.index, 0), Math.max(total - 1, 0));
  const rows = total
    ? await prisma.voteQuestion.findMany({
        where,
        include: {
          jurisdiction: true,
          source: true,
          responses: {
            where: { userId: user.id },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        skip: index,
        take: 1,
      })
    : [];

  const activeQuestion = rows[0] ? mapQuestionWithSparseResponses(rows[0], user.id) : null;
  return { activeQuestion, total };
}

export async function getDailyVoteExperience(user: AuthUser, communityId?: string) {
  const relevantQuestions = (await getQuickVoteCardsForUser(user, communityId)).slice(0, DAILY_VOTE_ALLOTMENT);
  const answeredCount = relevantQuestions.filter((question) => question.userAnswer).length;
  const currentQuestionIndex = relevantQuestions.findIndex((question) => !question.userAnswer);
  const currentQuestion =
    currentQuestionIndex >= 0
      ? {
          ...relevantQuestions[currentQuestionIndex],
          onboardingPosition: currentQuestionIndex + 1,
          onboardingTotal: relevantQuestions.length,
        }
      : null;

  return {
    currentQuestion,
    progress: {
      answered: answeredCount,
      total: relevantQuestions.length,
      current: currentQuestionIndex >= 0 ? currentQuestionIndex + 1 : relevantQuestions.length,
    },
    pulseQuestions: relevantQuestions.filter((question) => question.userAnswer).slice(-3).reverse(),
    remainingQuestions: relevantQuestions.filter((question) => !question.userAnswer).length,
    dailyQuestions: relevantQuestions,
  };
}

export async function getVotingLibrary(user: AuthUser, filters: VotingLibraryFilters = {}) {
  const questions = await getQuickVoteCardsForUser(user);
  const normalizedSearch = filters.search?.trim().toLowerCase() ?? "";

  return questions.filter((question) => {
    const matchesScope = !filters.scope || filters.scope === "all" ? true : question.scope === filters.scope;
    const matchesCategory = !filters.category || filters.category === "all" ? true : question.category === filters.category;
    const matchesObjectType =
      !filters.objectType || filters.objectType === "all" ? true : getVoteObjectType(question) === filters.objectType;
    const matchesSearch = normalizedSearch
      ? question.questionText.toLowerCase().includes(normalizedSearch) ||
        question.jurisdictionName.toLowerCase().includes(normalizedSearch) ||
        question.shortTitle?.toLowerCase().includes(normalizedSearch) ||
        question.subjectName?.toLowerCase().includes(normalizedSearch) ||
        question.relatedIssueLabel?.toLowerCase().includes(normalizedSearch)
      : true;

    return matchesScope && matchesCategory && matchesObjectType && matchesSearch;
  });
}

export async function updateCivicSentimentAggregate(questionId: string) {
  const question = await prisma.voteQuestion.findUnique({
    where: { id: questionId },
    include: { responses: true },
  });

  if (!question?.civicEntityType || !question.civicEntityId) return;

  const approveCount = question.responses.filter((response) => response.answer === VoteAnswer.yes).length;
  const disapproveCount = question.responses.filter((response) => response.answer === VoteAnswer.no).length;
  const responseCount = question.responses.length;
  const trustScore = responseCount ? Math.round((approveCount / responseCount) * 100) : null;

  await prisma.civicSentimentAggregate.upsert({
    where: {
      entityType_entityId_jurisdictionId: {
        entityType: question.civicEntityType,
        entityId: question.civicEntityId,
        jurisdictionId: question.jurisdictionId,
      },
    },
    create: {
      entityType: question.civicEntityType,
      entityId: question.civicEntityId,
      jurisdictionId: question.jurisdictionId,
      approveCount,
      disapproveCount,
      supportCount: approveCount,
      opposeCount: disapproveCount,
      trustScore,
      responseCount,
      lastComputedAt: new Date(),
    },
    update: {
      approveCount,
      disapproveCount,
      supportCount: approveCount,
      opposeCount: disapproveCount,
      trustScore,
      responseCount,
      lastComputedAt: new Date(),
    },
  });
}
