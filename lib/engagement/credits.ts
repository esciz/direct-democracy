import type {
  CivicRewardSummary,
  CreditBoostSummary,
  CreditTransactionSummary,
  CreditTransactionType,
} from "@/types/domain";

export const BOOST_COST = 3;

export async function getStoredCreditBoosts(): Promise<CreditBoostSummary[]> {
  return [];
}

export async function setStoredCreditBoosts(_boosts: CreditBoostSummary[]) {
  return;
}

export async function getAllCreditBoosts(): Promise<CreditBoostSummary[]> {
  return [];
}

export async function getStoredCreditTransactions(): Promise<CreditTransactionSummary[]> {
  return [];
}

export async function setStoredCreditTransactions(_transactions: CreditTransactionSummary[]) {
  return;
}

export async function getStoredCreditRewardKeys(): Promise<string[]> {
  return [];
}

export async function setStoredCreditRewardKeys(_keys: string[]) {
  return;
}

export async function getAllCreditTransactions(): Promise<CreditTransactionSummary[]> {
  return [];
}

export async function awardCreditsForAction(
  _userId: string,
  _type: CreditTransactionType,
  _amount: number,
  _options?: { createdAt?: string; rewardKey?: string },
) {
  return 0;
}

export async function getCreditsSpent(_userId: string) {
  return 0;
}

export async function getCreditsEarned(_userId: string) {
  return 0;
}

export async function getCreditBalance(_userId: string) {
  return 0;
}

export async function getCivicRewardSummary(_userId: string): Promise<CivicRewardSummary> {
  return {
    boostCreditsAvailable: 0,
    totalCreditsEarned: 0,
    summary: "Civic participation is tracked through visible actions, not through a platform credit system.",
    highlights: [
      {
        label: "Structured debates",
        description: "Structured debates strengthen your visible civic record without relying on platform credits.",
      },
      {
        label: "Reliable participation",
        description: "Verified votes, petition signatures, and public endorsements remain visible without feeding a credit balance.",
      },
      {
        label: "Higher-trust civic work",
        description: "Higher-trust civic work appears through public history, follow-through, and reputation signals.",
      },
    ],
  };
}
