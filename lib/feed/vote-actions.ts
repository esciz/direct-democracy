"use server";

import { redirect } from "next/navigation";

import { canUserVote } from "@/lib/auth/guards";
import { getQuickVoteCardsForUser, updateCivicSentimentAggregate } from "@/lib/feed/quick-votes";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";
import type { VoteAnswer, VoteQuestionCardSummary } from "@/types/domain";

const VALID_ANSWERS: VoteAnswer[] = ["yes", "no", "skip"];
const PUBLIC_REVIEW_STATUSES = ["approved", "verified"] as const;

async function persistQuickVote(questionId: string, answer: VoteAnswer) {
  const user = await getCurrentUser();
  const question = await prisma.voteQuestion.findFirst({
    where: {
      id: questionId,
      generatedFromRealData: true,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
      sourceUrl: { not: null },
    },
    include: { responses: { where: { userId: user.id } } },
  });

  if (!question) {
    return { ok: false as const, code: "question", user };
  }

  if (!canUserVote(user)) {
    return { ok: false as const, code: "verification", user };
  }

  const existingResponse = question.responses[0] ?? null;

  await prisma.voteResponse.upsert({
    where: {
      userId_questionId: {
        userId: user.id,
        questionId,
      },
    },
    create: {
      userId: user.id,
      questionId,
      answer,
    },
    update: {
      answer,
    },
  });

  await updateCivicSentimentAggregate(questionId);

  return {
    ok: true as const,
    user,
    previousAnswer: existingResponse?.answer ?? null,
    replacedExistingVote: Boolean(existingResponse),
  };
}

export async function submitQuickVoteInline(input: {
  questionId: string;
  answer: VoteAnswer;
}): Promise<{
  ok: boolean;
  message?: string;
  question?: VoteQuestionCardSummary;
}> {
  if (!VALID_ANSWERS.includes(input.answer)) {
    return { ok: false, message: "That vote answer is not valid." };
  }

  const result = await persistQuickVote(input.questionId, input.answer);

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.code === "verification"
          ? "Voter verification is required before platform votes count toward civic outcomes."
          : "That vote question could not be found.",
    };
  }

  const updatedQuestion = (await getQuickVoteCardsForUser(result.user)).find((question) => question.id === input.questionId);

  if (!updatedQuestion) {
    return {
      ok: false,
      message: "Your vote was saved, but the updated question could not be loaded.",
    };
  }

  return {
    ok: true,
    question: {
      ...updatedQuestion,
      previousUserVote: result.previousAnswer,
      voteUpdatedAt: new Date().toISOString(),
    },
    message: result.replacedExistingVote ? "Vote updated." : "Vote recorded.",
  };
}

export async function submitQuickVote(formData: FormData) {
  const questionId = formData.get("questionId");
  const answer = formData.get("answer");
  const returnPath = formData.get("returnPath");
  const safeReturnPath = typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/my-community";

  if (typeof questionId !== "string") {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}voteError=question`);
  }

  if (typeof answer !== "string" || !VALID_ANSWERS.includes(answer as VoteAnswer)) {
    redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}voteError=answer`);
  }

  const result = await persistQuickVote(questionId, answer as VoteAnswer);

  if (!result.ok) {
    redirect(
      `${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}voteError=${result.code === "verification" ? "verification" : "question"}`,
    );
  }

  redirect(`${safeReturnPath}${safeReturnPath.includes("?") ? "&" : "?"}voted=success`);
}
