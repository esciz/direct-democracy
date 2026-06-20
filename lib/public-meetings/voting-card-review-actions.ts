"use server";

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, normalizeWhitespace } from "@/lib/public-meetings/shared";
import { writePublicMeetingRuntimeArtifacts } from "@/lib/public-meetings/runtime-artifacts";
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
  const publicQuestion = normalizeWhitespace(String(formData.get("publicQuestion") ?? ""));
  const publicTitle = normalizeWhitespace(String(formData.get("publicTitle") ?? ""));
  const citizenSummary = normalizeWhitespace(String(formData.get("citizenSummary") ?? ""));
  const plainPurpose = normalizeWhitespace(String(formData.get("plainPurpose") ?? ""));
  const plainAction = normalizeWhitespace(String(formData.get("plainAction") ?? ""));

  const cards = await readCards();
  const next = cards.map((card) => card.id === cardId ? {
    ...card,
    review_status: status,
    public_question: publicQuestion || card.public_question,
    question_text: publicQuestion || card.question_text,
    public_title: publicTitle || card.public_title,
    title: publicTitle || card.title,
    citizen_summary: citizenSummary || card.citizen_summary,
    plain_language_summary: citizenSummary || card.plain_language_summary,
    plain_purpose: plainPurpose || card.plain_purpose,
    plain_action: plainAction || card.plain_action,
    updated_at: new Date().toISOString(),
  } : card);
  await writeCards(next);
  await writePublicMeetingRuntimeArtifacts({ votingCards: next });
  revalidatePath("/admin/voting-cards");
  revalidatePath("/voting");
  revalidatePath("/events");
  revalidatePath("/my-community");
  redirect(returnPath);
}
