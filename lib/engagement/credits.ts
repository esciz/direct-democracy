import { cookies } from "next/headers";

import { seededCandidateEndorsements } from "@/lib/candidates/endorsements";
import { mockPetitionSignatures, mockPollVotes, mockVoteResponses } from "@/lib/mock-data";
import type { CivicRewardSummary, CreditBoostSummary, CreditTransactionSummary, CreditTransactionType } from "@/types/domain";

const CREDIT_BOOSTS_COOKIE = "dd_credit_boosts";
const CREDIT_TRANSACTIONS_COOKIE = "dd_credit_transactions";
const CREDIT_REWARD_KEYS_COOKIE = "dd_credit_reward_keys";

export const BOOST_COST = 3;

const seededBoosts: CreditBoostSummary[] = [
  {
    id: "boost_seed_issue_1",
    userId: "user_trusted_citizen_marco_silva",
    targetType: "issue",
    targetId: "curated_issue_nevada_finance_transparency",
    createdAt: "2026-03-27T08:30:00.000Z",
    creditsSpent: BOOST_COST,
  },
  {
    id: "boost_seed_voice_1",
    userId: "user_official_elena_ramirez",
    targetType: "voice",
    targetId: "user_trusted_citizen_marco_silva",
    createdAt: "2026-03-28T11:10:00.000Z",
    creditsSpent: BOOST_COST,
  },
];

const DAILY_CAPS = {
  voting: 20,
  endorsement: 3,
  petition: 5,
  debate: 8,
  civic: 10,
} as const;

function isCreditBoost(value: unknown): value is CreditBoostSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const boost = value as Record<string, unknown>;
  return (
    typeof boost.id === "string" &&
    typeof boost.userId === "string" &&
    (boost.targetType === "issue" || boost.targetType === "voice" || boost.targetType === "post") &&
    typeof boost.targetId === "string" &&
    typeof boost.createdAt === "string" &&
    typeof boost.creditsSpent === "number"
  );
}

function isCreditTransaction(value: unknown): value is CreditTransactionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const transaction = value as Record<string, unknown>;
  return (
    typeof transaction.id === "string" &&
    typeof transaction.userId === "string" &&
    (transaction.type === "vote" ||
      transaction.type === "pollVote" ||
      transaction.type === "endorsement" ||
      transaction.type === "petition" ||
      transaction.type === "debateStart" ||
      transaction.type === "debateJoin" ||
      transaction.type === "debateComplete" ||
      transaction.type === "eventAttendance" ||
      transaction.type === "interviewComplete" ||
      transaction.type === "caseContribution" ||
      transaction.type === "publicResponsiveness") &&
    typeof transaction.amount === "number" &&
    typeof transaction.createdAt === "string"
  );
}

function getDateKey(timestamp: string) {
  return timestamp.slice(0, 10);
}

function getCapBucket(type: CreditTransactionType) {
  if (type === "vote" || type === "pollVote") {
    return "voting" as const;
  }

  if (type === "debateStart" || type === "debateJoin" || type === "debateComplete") {
    return "debate" as const;
  }

  if (type === "eventAttendance" || type === "interviewComplete" || type === "caseContribution" || type === "publicResponsiveness") {
    return "civic" as const;
  }

  return type;
}

function applyDailyCap(
  transactions: CreditTransactionSummary[],
  seed: {
    id: string;
    userId: string;
    type: CreditTransactionType;
    amount: number;
    createdAt: string;
  },
) {
  const bucket = getCapBucket(seed.type);
  const cap = DAILY_CAPS[bucket];
  const currentDate = getDateKey(seed.createdAt);
  const earnedToday = transactions
    .filter(
      (transaction) =>
        transaction.userId === seed.userId &&
        getDateKey(transaction.createdAt) === currentDate &&
        getCapBucket(transaction.type) === bucket,
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const remaining = Math.max(0, cap - earnedToday);
  const awarded = Math.min(seed.amount, remaining);

  if (awarded <= 0) {
    return transactions;
  }

  return [
    ...transactions,
    {
      ...seed,
      amount: awarded,
    },
  ];
}

function buildSeededCreditTransactions() {
  let transactions: CreditTransactionSummary[] = [];
  const seenQuestionVotes = new Set<string>();
  const seenPollVotes = new Set<string>();
  const seenPetitions = new Set<string>();
  const seenEndorsements = new Set<string>();

  for (const response of mockVoteResponses.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))) {
    const key = `${response.userId}:${response.questionId}`;

    if (seenQuestionVotes.has(key)) {
      continue;
    }

    seenQuestionVotes.add(key);
    transactions = applyDailyCap(transactions, {
      id: `credit_seed_vote_${response.id}`,
      userId: response.userId,
      type: "vote",
      amount: 1,
      createdAt: response.createdAt,
    });
  }

  for (const vote of mockPollVotes.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))) {
    const key = `${vote.userId}:${vote.pollId}`;

    if (seenPollVotes.has(key)) {
      continue;
    }

    seenPollVotes.add(key);
    transactions = applyDailyCap(transactions, {
      id: `credit_seed_poll_${vote.id}`,
      userId: vote.userId,
      type: "pollVote",
      amount: 1,
      createdAt: vote.createdAt,
    });
  }

  for (const endorsement of seededCandidateEndorsements.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))) {
    const key = `${endorsement.userId}:${endorsement.electionId}`;

    if (seenEndorsements.has(key)) {
      continue;
    }

    seenEndorsements.add(key);
    transactions = applyDailyCap(transactions, {
      id: `credit_seed_endorsement_${endorsement.id}`,
      userId: endorsement.userId,
      type: "endorsement",
      amount: 3,
      createdAt: endorsement.createdAt,
    });
  }

  for (const signature of mockPetitionSignatures.sort((a, b) => Date.parse(a.signedAt) - Date.parse(b.signedAt))) {
    if (signature.status !== "VALID") {
      continue;
    }

    const key = `${signature.signerId}:${signature.petitionId}`;

    if (seenPetitions.has(key)) {
      continue;
    }

    seenPetitions.add(key);
    transactions = applyDailyCap(transactions, {
      id: `credit_seed_petition_${signature.id}`,
      userId: signature.signerId,
      type: "petition",
      amount: 3,
      createdAt: signature.signedAt,
    });
  }

  return transactions;
}

const seededCreditTransactions = buildSeededCreditTransactions();

const seededRewardKeys = new Set<string>([
  ...mockVoteResponses.map((response) => `vote:${response.userId}:${response.questionId}`),
  ...mockPollVotes.map((vote) => `pollVote:${vote.userId}:${vote.pollId}`),
  ...seededCandidateEndorsements.map((endorsement) => `endorsement:${endorsement.userId}:${endorsement.electionId}`),
  ...mockPetitionSignatures
    .filter((signature) => signature.status === "VALID")
    .map((signature) => `petition:${signature.signerId}:${signature.petitionId}`),
]);

export async function getStoredCreditBoosts(): Promise<CreditBoostSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CREDIT_BOOSTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCreditBoost) : [];
  } catch {
    return [];
  }
}

export async function setStoredCreditBoosts(boosts: CreditBoostSummary[]) {
  void boosts;
}

export async function getAllCreditBoosts(): Promise<CreditBoostSummary[]> {
  return [];
}

export async function getStoredCreditTransactions(): Promise<CreditTransactionSummary[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CREDIT_TRANSACTIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCreditTransaction) : [];
  } catch {
    return [];
  }
}

export async function setStoredCreditTransactions(transactions: CreditTransactionSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(CREDIT_TRANSACTIONS_COOKIE, JSON.stringify(transactions.slice(0, 300)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getStoredCreditRewardKeys() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CREDIT_REWARD_KEYS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export async function setStoredCreditRewardKeys(keys: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(CREDIT_REWARD_KEYS_COOKIE, JSON.stringify(keys.slice(0, 500)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getAllCreditTransactions() {
  return [...seededCreditTransactions, ...(await getStoredCreditTransactions())].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}

export async function awardCreditsForAction(
  userId: string,
  type: CreditTransactionType,
  amount: number,
  options?: { createdAt?: string; rewardKey?: string },
) {
  void userId;
  void type;
  void amount;
  void options;
  return 0;
}

export async function getCreditsSpent(userId: string) {
  void userId;
  return 0;
}

export async function getCreditsEarned(userId: string) {
  void userId;
  return 0;
}

export async function getCreditBalance(userId: string) {
  void userId;
  return 0;
}

export async function getCivicRewardSummary(userId: string): Promise<CivicRewardSummary> {
  void userId;

  return {
    boostCreditsAvailable: 0,
    totalCreditsEarned: 0,
    summary: "Civic participation is tracked through visible actions, not through a platform credit system.",
    highlights: [
      {
        label: "Structured debates",
        description: "Structured debates still strengthen your visible civic record without relying on platform credits.",
      },
      {
        label: "Reliable participation",
        description: "Verified votes, petition signatures, and public endorsements still matter, but they no longer feed a credit balance.",
      },
      {
        label: "Higher-trust civic work",
        description: "Higher-trust civic work remains visible through public history, follow-through, and reputation signals.",
      },
    ],
  };
}
