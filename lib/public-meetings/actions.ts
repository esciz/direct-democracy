"use server";

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, normalizeWhitespace, slugify } from "@/lib/public-meetings/shared";
import type { PublicMeetingImportDocument, PublicMeetingDocumentType } from "@/lib/public-meetings/types";
import { getCurrentUser } from "@/lib/server/auth-session";

async function readManifest(): Promise<PublicMeetingImportDocument[]> {
  const filePath = absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.importManifest);
  if (!existsSync(filePath)) return [];
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  return Array.isArray(raw) ? (raw as PublicMeetingImportDocument[]) : [];
}

async function writeManifest(documents: PublicMeetingImportDocument[]) {
  const filePath = absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.importManifest);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? normalizeWhitespace(value) || null : null;
}

function normalizeDocumentType(value: string | null): PublicMeetingDocumentType {
  const allowed = new Set<PublicMeetingDocumentType>([
    "agenda",
    "minutes",
    "staff_report",
    "board_packet",
    "ordinance",
    "resolution",
    "consent_agenda",
    "public_comment",
    "transcript",
    "roll_call_vote",
    "attachment",
    "exhibit",
    "other",
  ]);
  return allowed.has(value as PublicMeetingDocumentType) ? (value as PublicMeetingDocumentType) : "other";
}

export async function stagePublicMeetingUploadAction(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }

  const uploadedFile = formData.get("document");
  if (!(uploadedFile instanceof File) || uploadedFile.size === 0) {
    redirect("/admin/meetings/upload?error=missing-file");
  }

  const originalName = uploadedFile.name || "meeting-document";
  const safeName = `${Date.now()}-${slugify(originalName) || "meeting-document"}${path.extname(originalName) || ".bin"}`;
  const localRelativePath = path.join(PUBLIC_MEETING_PATHS.uploadRoot, safeName);
  const uploadPath = absolutePublicMeetingPath(localRelativePath);
  await mkdir(path.dirname(uploadPath), { recursive: true });
  await writeFile(uploadPath, Buffer.from(await uploadedFile.arrayBuffer()));

  const entry: PublicMeetingImportDocument = {
    id: `upload-${Date.now()}-${slugify(originalName)}`,
    source_id: formString(formData, "source_id"),
    public_body_id: formString(formData, "public_body_id"),
    public_body_name: formString(formData, "public_body_name"),
    meeting_date: formString(formData, "meeting_date"),
    meeting_type: formString(formData, "meeting_type"),
    title: formString(formData, "title"),
    document_type: normalizeDocumentType(formString(formData, "document_type")),
    local_file_path: localRelativePath,
    source_url: formString(formData, "source_url"),
    agenda_url: formString(formData, "agenda_url"),
    minutes_url: formString(formData, "minutes_url"),
    packet_url: formString(formData, "packet_url"),
    video_url: formString(formData, "video_url"),
    transcript_url: formString(formData, "transcript_url"),
    notes: formString(formData, "notes"),
  };

  const manifest = await readManifest();
  await writeManifest([entry, ...manifest]);
  revalidatePath("/admin/meetings");
  revalidatePath("/admin/meetings/upload");
  redirect("/admin/meetings?upload=staged");
}
