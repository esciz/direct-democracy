import { canUserVote } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getVerificationClassForSubject, type PublicVerificationClass } from "@/lib/identity/verification-class";
import type { AuthUser } from "@/types/domain";

const PUBLIC_REVIEW_STATUSES = ["approved", "verified"] as const;

export type AccountParticipationStatus = {
  userId: string;
  signedIn: boolean;
  canCastSourceBackedVotes: boolean;
  responseProvenance: "real_participant" | "not_recorded";
  countsInAnalyticsWhenRecorded: boolean;
  countsAsVerifiedStakeholderSignal: boolean;
  verificationClass: PublicVerificationClass;
  voteWeight: 1;
  hiddenWeighting: false;
  sourceBackedQuestionsAvailable: number;
  existingRealResponses: number;
  existingVerifiedAnalyticsResponses: number;
  explanation: string;
  nextStep: string;
};

function isVerifiedStakeholderClass(verificationClass: PublicVerificationClass) {
  return verificationClass === "verified_resident" || verificationClass === "verified_voter";
}

function explanationFor(input: {
  signedIn: boolean;
  canVote: boolean;
  countsAsVerifiedStakeholderSignal: boolean;
  verificationClass: PublicVerificationClass;
}) {
  if (!input.signedIn) {
    return "You are viewing the public profile experience. Sign in before casting source-backed civic votes.";
  }

  if (!input.canVote) {
    return "This account can browse source-backed civic records, but voting requires an eligible participation role or verification.";
  }

  if (input.countsAsVerifiedStakeholderSignal) {
    return "Your source-backed votes record as real participant responses and can count in verified stakeholder analytics when privacy thresholds are met.";
  }

  return `Your account can vote, but its current verification class is ${input.verificationClass.replaceAll("_", " ")}. Responses are stored as real participant activity but do not count as verified resident or verified voter signals yet.`;
}

function nextStepFor(input: {
  signedIn: boolean;
  canVote: boolean;
  countsAsVerifiedStakeholderSignal: boolean;
}) {
  if (!input.signedIn) return "Sign in with your account to record source-backed civic votes.";
  if (!input.canVote) return "Complete the participation or verification steps shown below before voting.";
  if (!input.countsAsVerifiedStakeholderSignal) return "Complete residency or voter verification when you want responses to count in verified stakeholder analytics.";
  return "Keep voting on source-backed questions. Your vote weight remains one.";
}

export async function getAccountParticipationStatus(user: AuthUser, options: { signedIn: boolean }): Promise<AccountParticipationStatus> {
  const canVote = options.signedIn && canUserVote(user);
  const verificationClass = options.signedIn
    ? getVerificationClassForSubject({ id: user.id, role: user.role, isVerifiedVoter: user.isVerifiedVoter })
    : "anonymous_public";
  const countsAsVerifiedStakeholderSignal = canVote && isVerifiedStakeholderClass(verificationClass);

  const [sourceBackedQuestionsAvailable, existingRealResponses, existingAnalyticsRows] = await Promise.all([
    prisma.voteQuestion.count({
      where: {
        generatedFromRealData: true,
        reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
        sourceUrl: { not: null },
      },
    }),
    options.signedIn
      ? prisma.voteResponse.count({
          where: {
            userId: user.id,
            provenance: "real_participant",
          },
        })
      : Promise.resolve(0),
    options.signedIn
      ? prisma.voteResponse.findMany({
          where: {
            userId: user.id,
            provenance: "real_participant",
            countsInAnalytics: true,
          },
          select: {
            user: {
              select: {
                id: true,
                role: true,
                isVerifiedVoter: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const existingVerifiedAnalyticsResponses = existingAnalyticsRows.filter((row) => isVerifiedStakeholderClass(getVerificationClassForSubject(row.user))).length;

  return {
    userId: user.id,
    signedIn: options.signedIn,
    canCastSourceBackedVotes: canVote,
    responseProvenance: canVote ? "real_participant" : "not_recorded",
    countsInAnalyticsWhenRecorded: canVote,
    countsAsVerifiedStakeholderSignal,
    verificationClass,
    voteWeight: 1,
    hiddenWeighting: false,
    sourceBackedQuestionsAvailable,
    existingRealResponses,
    existingVerifiedAnalyticsResponses,
    explanation: explanationFor({ signedIn: options.signedIn, canVote, countsAsVerifiedStakeholderSignal, verificationClass }),
    nextStep: nextStepFor({ signedIn: options.signedIn, canVote, countsAsVerifiedStakeholderSignal }),
  };
}
