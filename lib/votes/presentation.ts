import type { VoteQuestionCardSummary, VoteQuestionSummary, VoteResponseLabels } from "@/types/domain";

const DEFAULT_LABELS: Record<NonNullable<VoteQuestionSummary["objectType"]>, VoteResponseLabels> = {
  representative: {
    yes: "Approve",
    skip: "Mixed",
    no: "Disapprove",
  },
  decision: {
    yes: "Support",
    skip: "Undecided",
    no: "Oppose",
  },
  case: {
    yes: "Convincing",
    skip: "Mixed",
    no: "Unconvincing",
  },
  community: {
    yes: "Support",
    skip: "Mixed",
    no: "Oppose",
  },
};

export function getVoteObjectType(question: Pick<VoteQuestionSummary, "objectType" | "voteType">) {
  if (question.objectType) {
    return question.objectType;
  }

  if (question.voteType === "representativeVote") {
    return "representative";
  }

  if (question.voteType === "caseVote") {
    return "case";
  }

  if (question.voteType === "citizenElevatedVote" || question.voteType === "publicVote") {
    return "community";
  }

  return "decision";
}

export function getVoteResponseLabels(question: Pick<VoteQuestionSummary, "objectType" | "voteType" | "responseLabels">): VoteResponseLabels {
  return question.responseLabels ?? DEFAULT_LABELS[getVoteObjectType(question)];
}

export function getVoteObjectLabel(question: Pick<VoteQuestionSummary, "objectType" | "voteType" | "questionType">) {
  if (question.questionType === "BALLOT_MEASURE_DECISION") return "Ballot measure";
  if (question.questionType === "LEGISLATION_DECISION") return "Legislation";
  if (question.questionType === "CANDIDATE_PERFORMANCE") return "Candidate performance";
  if (question.questionType === "ELECTED_OFFICIAL_PERFORMANCE") return "Official performance";
  if (question.questionType === "COMMUNITY_PRIORITY_POLL") return "Priority poll";

  const objectType = getVoteObjectType(question);

  if (objectType === "representative") return "Representative vote";
  if (objectType === "case") return "Case vote";
  if (objectType === "community") return "Community vote";
  return "Decision vote";
}

export function getVoteParticipationPrompt(question: Pick<VoteQuestionSummary, "objectType" | "subjectName" | "questionText" | "questionType">) {
  if (question.questionType === "COMMUNITY_PRIORITY_POLL") {
    return "Choose the priority that best matches your concern";
  }

  if (question.questionType === "BALLOT_MEASURE_DECISION") {
    return "Review the measure, fiscal impact, arguments, and sources before voting";
  }

  if (question.questionType === "LEGISLATION_DECISION") {
    return "Vote on this public legislation signal";
  }

  if (question.questionType === "CANDIDATE_PERFORMANCE" || question.questionType === "ELECTED_OFFICIAL_PERFORMANCE") {
    return question.subjectName ? `Vote on ${question.subjectName}'s public performance` : "Vote on this public performance question";
  }

  const objectType = getVoteObjectType(question);

  if (objectType === "representative") {
    return question.subjectName ? `Vote on ${question.subjectName} this week` : "Vote on this representative this week";
  }

  if (objectType === "case") {
    return "Vote on how convincing this case is";
  }

  if (objectType === "community") {
    return "Vote on this community question";
  }

  return "Vote on this public decision";
}

export function getResultComparisonText(question: Pick<VoteQuestionCardSummary, "userAnswer" | "objectType" | "voteType" | "responseLabels">) {
  if (!question.userAnswer) {
    return null;
  }

  const labels = getVoteResponseLabels(question);
  const answerLabel =
    question.userAnswer === "yes" ? labels.yes : question.userAnswer === "no" ? labels.no : labels.skip;

  return `You voted ${answerLabel.toLowerCase()}. Community results are shown below so you can compare your vote with broader sentiment.`;
}
