"use server";

import { redirect } from "next/navigation";

import { canUserCreatePoll } from "@/lib/server/auth-guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getStoredVoteQuestions, setStoredVoteQuestions } from "@/lib/feed/quick-votes";
import { createFolloweeNotificationsForMajorAction, createPollConvertedToPetitionNotifications } from "@/lib/notifications/store";
import { getPollPromotionRecord, getStoredPollPromotions, POLL_PROMOTION_THRESHOLD, setStoredPollPromotions } from "@/lib/polls/promotions";
import { mockPollVotes } from "@/lib/mock-data";
import { buildPollSeed, getPollById, getStoredPolls, getStoredPollVotes, setStoredPolls, setStoredPollVotes } from "@/lib/polls/store";
import { getStoredPetitions, setStoredPetitions } from "@/lib/petitions/store";
import type { ContextAttachmentSummary, PetitionSummary, PollVoteSummary, VoteQuestionCategory, VoteQuestionScope, VoteQuestionSummary } from "@/types/domain";

const VALID_SCOPES: VoteQuestionScope[] = ["local", "state", "national"];
const VALID_ATTACHMENT_TYPES: ContextAttachmentSummary["type"][] = [
  "community",
  "issue",
  "case",
  "official",
  "candidate",
  "petition",
  "legislation",
  "election",
  "coalition",
  "event",
];

function redirectWithError(path: string, error: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${error}`);
}

function sanitizeOptions(formData: FormData) {
  return ["optionOne", "optionTwo", "optionThree", "optionFour"]
    .map((key) => formData.get(key))
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function redirectWithPromotionStatus(path: string, status: string, error = false): never {
  const key = error ? "pollPromotionError" : "pollPromotion";
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${status}`);
}

export async function createPoll(formData: FormData) {
  const user = await getCurrentUser();

  if (!(await canUserCreatePoll(user))) {
    redirect("/polls?denied=create-poll");
  }

  const question = formData.get("question");
  const scope = formData.get("scope");
  const expiresAt = formData.get("expiresAt");
  const attachmentType = formData.get("attachmentType");
  const attachmentId = formData.get("attachmentId");
  const attachmentLabel = formData.get("attachmentLabel");
  const attachmentJurisdictionId = formData.get("attachmentJurisdictionId");

  if (typeof question !== "string" || question.trim().length < 12) {
    redirectWithError("/polls/create", "question");
  }

  if (typeof scope !== "string" || !VALID_SCOPES.includes(scope as VoteQuestionScope)) {
    redirectWithError("/polls/create", "scope");
  }

  if (
    typeof attachmentType !== "string" ||
    !VALID_ATTACHMENT_TYPES.includes(attachmentType as ContextAttachmentSummary["type"]) ||
    typeof attachmentLabel !== "string" ||
    !attachmentLabel.trim()
  ) {
    redirectWithError("/polls/create", "attachment");
  }

  const options = sanitizeOptions(formData);
  const uniqueOptions = [...new Set(options.map((option) => option.toLowerCase()))];
  const normalizedExpiresAt =
    typeof expiresAt === "string" && expiresAt ? new Date(expiresAt) : null;

  if (options.length < 2 || options.length > 4 || uniqueOptions.length !== options.length || options.some((option) => option.length < 2)) {
    redirectWithError("/polls/create", "options");
  }

  if (normalizedExpiresAt && Number.isNaN(normalizedExpiresAt.getTime())) {
    redirectWithError("/polls/create", "expiresAt");
  }

  const createdPoll = buildPollSeed(user, {
    question: question.trim(),
    scope: scope as VoteQuestionScope,
    options,
    expiresAt: normalizedExpiresAt ? normalizedExpiresAt.toISOString() : null,
    attachments: [
      {
        type: attachmentType as ContextAttachmentSummary["type"],
        id:
          typeof attachmentId === "string" && attachmentId.trim()
            ? attachmentId.trim()
            : attachmentLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        label: attachmentLabel.trim(),
        jurisdictionId: typeof attachmentJurisdictionId === "string" && attachmentJurisdictionId.trim() ? attachmentJurisdictionId.trim() : null,
      },
    ],
  });

  const existingPolls = await getStoredPolls();
  await setStoredPolls([createdPoll, ...existingPolls]);
  await createFolloweeNotificationsForMajorAction(
    user.id,
    user.name,
    createdPoll.id,
    "created a community poll",
    `New poll: ${createdPoll.question}`,
  );

  redirect("/polls?created=success");
}

export async function voteOnPoll(formData: FormData) {
  const user = await getCurrentUser();
  const pollId = formData.get("pollId");
  const selectedOption = formData.get("selectedOption");
  const returnPath = formData.get("returnPath");
  const safeReturnPath = typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/my-community";

  if (typeof pollId !== "string" || typeof selectedOption !== "string") {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}pollError=invalid`);
  }

  const poll = await getPollById(pollId, user.id);

  if (!poll) {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}pollError=missing`);
  }

  if (!poll.options.includes(selectedOption)) {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}pollError=option`);
  }

  if (!poll.canVote) {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}pollVote=already`);
  }

  const storedVotes = await getStoredPollVotes();
  const existingVote = [...storedVotes].find((vote) => vote.pollId === pollId && vote.userId === user.id);

  if (existingVote) {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}pollVote=already`);
  }

  const vote: PollVoteSummary = {
    id: `poll_vote_created_${Date.now()}`,
    pollId,
    userId: user.id,
    selectedOption,
    createdAt: new Date().toISOString(),
  };

  await setStoredPollVotes([vote, ...storedVotes]);
  redirect(
    `${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}pollVote=success`,
  );
}

export async function voteOnPollFromFeed(pollId: string, selectedOption: string) {
  const user = await getCurrentUser();
  const poll = await getPollById(pollId, user.id);

  if (!poll) {
    return {
      ok: false,
      message: "That poll is no longer available.",
    };
  }

  if (!poll.options.includes(selectedOption)) {
    return {
      ok: false,
      message: "That option is no longer available.",
    };
  }

  if (!poll.canVote) {
    return {
      ok: false,
      message: poll.viewerVote ? "You already voted on this poll." : "Voting is closed on this poll.",
    };
  }

  const storedVotes = await getStoredPollVotes();
  const existingVote = storedVotes.find((vote) => vote.pollId === pollId && vote.userId === user.id);

  if (existingVote) {
    return {
      ok: false,
      message: "You already voted on this poll.",
    };
  }

  const vote: PollVoteSummary = {
    id: `poll_vote_created_${Date.now()}`,
    pollId,
    userId: user.id,
    selectedOption,
    createdAt: new Date().toISOString(),
  };

  await setStoredPollVotes([vote, ...storedVotes]);

  const nextResults = poll.options.map((option) => {
    const voteCount = poll.results.find((result) => result.option === option)?.voteCount ?? 0;
    const nextVoteCount = option === selectedOption ? voteCount + 1 : voteCount;
    const nextTotalVotes = poll.totalVotes + 1;

    return {
      option,
      voteCount: nextVoteCount,
      percentage: nextTotalVotes ? Math.round((nextVoteCount / nextTotalVotes) * 100) : 0,
    };
  });

  return {
    ok: true,
    poll: {
      ...poll,
      totalVotes: poll.totalVotes + 1,
      engagementCount: poll.engagementCount + 1,
      viewerVote: selectedOption,
      canVote: false,
      results: nextResults,
    },
  };
}

export async function voteOnPollInline(pollId: string, selectedOption: string) {
  const user = await getCurrentUser();
  const poll = await getPollById(pollId, user.id);

  if (!poll) {
    return {
      ok: false as const,
      message: "That citizen poll is no longer available.",
    };
  }

  if (!poll.options.includes(selectedOption)) {
    return {
      ok: false as const,
      message: "That option is no longer available.",
    };
  }

  if (poll.votingPeriodStatus === "closed") {
    return {
      ok: false as const,
      message: "This citizen poll is closed.",
    };
  }

  const storedVotes = await getStoredPollVotes();
  const existingVote = storedVotes.find((vote) => vote.pollId === pollId && vote.userId === user.id);
  const now = new Date().toISOString();

  const nextVote: PollVoteSummary = {
    id: existingVote?.id ?? `poll_vote_created_${Date.now()}`,
    pollId,
    userId: user.id,
    selectedOption,
    createdAt: now,
  };

  const nextStoredVotes = existingVote
    ? storedVotes.map((vote) => (vote.pollId === pollId && vote.userId === user.id ? nextVote : vote))
    : [nextVote, ...storedVotes];

  await setStoredPollVotes(nextStoredVotes);
  const refreshedPoll = await getPollById(pollId, user.id);

  if (!refreshedPoll) {
    return {
      ok: false as const,
      message: "The updated citizen poll could not be loaded.",
    };
  }

  return {
    ok: true as const,
    poll: refreshedPoll,
    message: existingVote ? "Citizen poll vote updated." : "Citizen poll vote recorded.",
  };
}

export async function promotePollToPetition(formData: FormData) {
  const user = await getCurrentUser();
  const pollId = formData.get("pollId");
  const title = formData.get("title");
  const summary = formData.get("summary");
  const body = formData.get("body");
  const issueTag = formData.get("issueTag");
  const confirm = formData.get("confirmPromotion");
  const returnPath = formData.get("returnPath");
  const safeReturnPath = typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/polls";

  if (user.role !== "trustedCitizen") {
    redirectWithPromotionStatus(safeReturnPath, "permissions", true);
  }

  if (typeof pollId !== "string") {
    redirectWithPromotionStatus(safeReturnPath, "poll", true);
  }

  const poll = await getPollById(pollId, user.id);

  if (!poll || poll.engagementCount < POLL_PROMOTION_THRESHOLD) {
    redirectWithPromotionStatus(safeReturnPath, "threshold", true);
  }

  if (typeof title !== "string" || title.trim().length < 8) {
    redirectWithPromotionStatus(safeReturnPath, "title", true);
  }

  if (typeof summary !== "string" || summary.trim().length < 20) {
    redirectWithPromotionStatus(safeReturnPath, "summary", true);
  }

  if (typeof body !== "string" || body.trim().length < 40) {
    redirectWithPromotionStatus(safeReturnPath, "body", true);
  }

  if (confirm !== "yes") {
    redirectWithPromotionStatus(safeReturnPath, "confirm", true);
  }

  const existingPromotion = await getPollPromotionRecord(pollId);

  if (existingPromotion?.petitionId) {
    redirectWithPromotionStatus(safeReturnPath, "already-petition");
  }

  const createdPetition: PetitionSummary = {
    id: `petition_from_poll_${Date.now()}`,
    creatorId: user.id,
    title: title.trim(),
    summary: summary.trim(),
    body: body.trim(),
    issueTags: typeof issueTag === "string" && issueTag.trim() ? [issueTag.trim()] : [],
    jurisdictionName: poll.jurisdictionName,
    creatorName: user.name,
    status: "ACTIVE",
    signatureCount: 0,
    signatureGoal: 5000,
    eligibleForCosponsorship: false,
    createdAt: new Date().toISOString(),
  };

  const storedPetitions = await getStoredPetitions();
  await setStoredPetitions([createdPetition, ...storedPetitions]);
  const promotions = await getStoredPollPromotions();
  await setStoredPollPromotions([
    {
      pollId,
      petitionId: createdPetition.id,
      voteQuestionId: existingPromotion?.voteQuestionId ?? null,
      createdAt: new Date().toISOString(),
    },
    ...promotions.filter((entry) => entry.pollId !== pollId),
  ]);
  const pollVotes = [...(await getStoredPollVotes()), ...mockPollVotes];
  const notifiedUserIds = [...new Set(pollVotes.filter((vote) => vote.pollId === pollId).map((vote) => vote.userId))];

  await createPollConvertedToPetitionNotifications({
    userIds: notifiedUserIds,
    pollId,
    pollQuestion: poll.question,
    petitionId: createdPetition.id,
    petitionTitle: createdPetition.title,
  });

  redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}pollPromotion=petition`);
}

export async function promotePollToSystemVote(formData: FormData) {
  const user = await getCurrentUser();
  const pollId = formData.get("pollId");
  const questionText = formData.get("questionText");
  const category = formData.get("category");
  const issueTag = formData.get("issueTag");
  const plainLanguageSummary = formData.get("plainLanguageSummary");
  const confirm = formData.get("confirmPromotion");
  const returnPath = formData.get("returnPath");
  const safeReturnPath = typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/polls";

  if (user.role !== "trustedCitizen") {
    redirectWithPromotionStatus(safeReturnPath, "permissions", true);
  }

  if (typeof pollId !== "string") {
    redirectWithPromotionStatus(safeReturnPath, "poll", true);
  }

  const poll = await getPollById(pollId, user.id);

  if (!poll || poll.engagementCount < POLL_PROMOTION_THRESHOLD) {
    redirectWithPromotionStatus(safeReturnPath, "threshold", true);
  }

  if (typeof questionText !== "string" || questionText.trim().length < 12) {
    redirectWithPromotionStatus(safeReturnPath, "question", true);
  }

  if (category !== "civic") {
    redirectWithPromotionStatus(safeReturnPath, "category", true);
  }

  if (confirm !== "yes") {
    redirectWithPromotionStatus(safeReturnPath, "confirm", true);
  }

  const existingPromotion = await getPollPromotionRecord(pollId);

  if (existingPromotion?.voteQuestionId) {
    redirectWithPromotionStatus(safeReturnPath, "already-system-vote");
  }

  const storedQuestions = await getStoredVoteQuestions();
  const normalizedQuestion = questionText.trim().toLowerCase();
  const duplicate = storedQuestions.some(
    (question) =>
      question.jurisdictionName === poll.jurisdictionName &&
      question.scope === poll.scope &&
      question.questionText.trim().toLowerCase() === normalizedQuestion,
  );

  if (duplicate) {
    redirectWithPromotionStatus(safeReturnPath, "duplicate-vote", true);
  }

  const createdVoteQuestion: VoteQuestionSummary = {
    id: `vote_question_from_poll_${Date.now()}`,
    questionText: questionText.trim(),
    category: category as VoteQuestionCategory,
    scope: poll.scope,
    jurisdictionId: poll.jurisdictionId,
    jurisdictionName: poll.jurisdictionName,
    objectType: "community",
    issueTag: typeof issueTag === "string" && issueTag.trim() ? issueTag.trim() : null,
    voteType: "citizenElevatedVote",
    status: "proposed",
    origin: "citizenElevated",
    shortTitle: "Citizen-elevated formal vote",
    plainLanguageSummary:
      typeof plainLanguageSummary === "string" && plainLanguageSummary.trim()
        ? plainLanguageSummary.trim()
        : `This formal vote grows out of a community poll that gained enough traction to merit structured public voting in ${poll.jurisdictionName}.`,
    whyItMatters: "A poll with enough momentum can graduate into a formal public decision object that people can track, debate, and compare against official action.",
    whoIsAffected: `${poll.jurisdictionName} residents and any public officials or institutions tied to the issue.`,
    introducedBy: user.name,
    introducedByRole: "Trusted citizen promotion",
    officialBody: poll.jurisdictionName,
    responseLabels: {
      yes: "Support",
      skip: "Mixed",
      no: "Oppose",
    },
    whatYesMeans: "Support turning this public concern into a tracked civic decision with clearer accountability.",
    whatNoMeans: "Keep it at the poll stage without elevating it into the formal vote layer yet.",
    relatedIssueLabel: typeof issueTag === "string" && issueTag.trim() ? issueTag.trim() : "Community issue",
    graduatedFromPollId: poll.id,
  };

  await setStoredVoteQuestions([createdVoteQuestion, ...storedQuestions]);
  const promotions = await getStoredPollPromotions();
  await setStoredPollPromotions([
    {
      pollId,
      petitionId: existingPromotion?.petitionId ?? null,
      voteQuestionId: createdVoteQuestion.id,
      createdAt: new Date().toISOString(),
    },
    ...promotions.filter((entry) => entry.pollId !== pollId),
  ]);

  redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}pollPromotion=system-vote`);
}
