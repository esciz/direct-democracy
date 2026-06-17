"use server";

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, normalizeWhitespace } from "@/lib/public-meetings/shared";
import type { MeetingVotingCardRecord, MeetingVotingCardReviewStatus } from "@/lib/public-meetings/types";

async function readCards() {
  const filePath = absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.meetingVotingCards);
  if (!existsSync(filePath)) return [];
  return JSON.parse(await readFile(filePath, "utf8")) as MeetingVotingCardRecord[];
}

async function writeCards(cards: MeetingVotingCardRecord[]) {
  const filePath = absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.meetingVotingCards);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(cards, null, 2)}\n`, "utf8");
}

export async function updateMeetingVotingCardReviewAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  const cardId = normalizeWhitespace(String(formData.get("cardId") ?? ""));
  const status = normalizeWhitespace(String(formData.get("reviewStatus") ?? "")) as MeetingVotingCardReviewStatus;
  const returnPath = normalizeWhitespace(String(formData.get("returnPath") ?? "/admin/voting-cards"));
  if (!cardId || !["ready", "needs_review", "approved", "rejected"].includes(status)) redirect(returnPath);

  const cards = await readCards();
  const next = cards.map((card) => card.id === cardId ? { ...card, review_status: status, updated_at: new Date().toISOString() } : card);
  await writeCards(next);
  revalidatePath("/admin/voting-cards");
  revalidatePath("/voting");
  revalidatePath("/events");
  revalidatePath("/my-community");
  redirect(returnPath);
}
