import { cookies } from "next/headers";

type PollPromotionRecord = {
  pollId: string;
  petitionId?: string | null;
  voteQuestionId?: string | null;
  createdAt: string;
};

const POLL_PROMOTIONS_COOKIE = "dd_poll_promotions";
export const POLL_PROMOTION_THRESHOLD = 8;

function isPollPromotionRecord(value: unknown): value is PollPromotionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.pollId === "string" &&
    typeof record.createdAt === "string" &&
    (typeof record.petitionId === "string" || typeof record.petitionId === "undefined" || record.petitionId === null) &&
    (typeof record.voteQuestionId === "string" || typeof record.voteQuestionId === "undefined" || record.voteQuestionId === null)
  );
}

export async function getStoredPollPromotions(): Promise<PollPromotionRecord[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(POLL_PROMOTIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPollPromotionRecord) : [];
  } catch {
    return [];
  }
}

export async function setStoredPollPromotions(records: PollPromotionRecord[]) {
  const cookieStore = await cookies();
  cookieStore.set(POLL_PROMOTIONS_COOKIE, JSON.stringify(records.slice(0, 100)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getPollPromotionRecord(pollId: string) {
  const records = await getStoredPollPromotions();
  return records.find((record) => record.pollId === pollId) ?? null;
}
