"use server";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, normalizeWhitespace } from "@/lib/public-meetings/shared";
import type { OfficialActionReviewOverride, OfficialActionReviewStatus } from "@/lib/public-meetings/official-action-store";

async function readOverrides() {
  const filePath = absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.officialActionReviewOverrides);
  if (!existsSync(filePath)) return [];
  return JSON.parse(await readFile(filePath, "utf8")) as OfficialActionReviewOverride[];
}

async function writeOverrides(overrides: OfficialActionReviewOverride[]) {
  const filePath = absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.officialActionReviewOverrides);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
}

export async function updateOfficialActionReviewAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  const actionId = normalizeWhitespace(String(formData.get("actionId") ?? ""));
  const status = normalizeWhitespace(String(formData.get("status") ?? "")) as OfficialActionReviewStatus;
  const officialNameRaw = normalizeWhitespace(String(formData.get("officialNameRaw") ?? ""));
  const officialId = normalizeWhitespace(String(formData.get("officialId") ?? ""));
  const notes = normalizeWhitespace(String(formData.get("notes") ?? ""));
  const returnPath = normalizeWhitespace(String(formData.get("returnPath") ?? "/admin/official-actions"));

  if (!actionId || !["unmatched", "suggested_match", "approved", "rejected", "pending"].includes(status)) redirect(returnPath);

  const overrides = await readOverrides();
  const nextOverride: OfficialActionReviewOverride = {
    action_id: actionId,
    status,
    official_id: officialId || null,
    official_name_raw: officialNameRaw || null,
    notes: notes || null,
    updated_at: new Date().toISOString(),
  };
  const next = [...overrides.filter((override) => override.action_id !== actionId), nextOverride];
  await writeOverrides(next);
  revalidatePath("/admin/official-actions");
  revalidatePath("/officials");
  redirect(returnPath);
}
