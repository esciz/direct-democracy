"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_PREVIEW_COOKIE,
  DEFAULT_PREVIEW_CONTEXT,
  PREVIEW_DATA_STATES,
  PREVIEW_ROLES,
  type AdminPreviewContext,
  isAdminPreviewEnabled,
} from "@/lib/admin-preview/context";
import { getRawCurrentSessionUser } from "@/lib/server/auth-session";

function parsePreviewForm(formData: FormData): AdminPreviewContext {
  const role = String(formData.get("previewRole") ?? DEFAULT_PREVIEW_CONTEXT.role);
  const jurisdiction = String(formData.get("previewJurisdiction") ?? DEFAULT_PREVIEW_CONTEXT.jurisdiction);
  const dataState = String(formData.get("previewDataState") ?? DEFAULT_PREVIEW_CONTEXT.dataState);

  return {
    role: PREVIEW_ROLES.some((entry) => entry.value === role) ? (role as AdminPreviewContext["role"]) : DEFAULT_PREVIEW_CONTEXT.role,
    jurisdiction: jurisdiction || DEFAULT_PREVIEW_CONTEXT.jurisdiction,
    dataState: PREVIEW_DATA_STATES.some((entry) => entry.value === dataState) ? (dataState as AdminPreviewContext["dataState"]) : DEFAULT_PREVIEW_CONTEXT.dataState,
  };
}

async function requirePreviewAdmin() {
  if (!isAdminPreviewEnabled()) {
    redirect("/profile");
  }

  const user = await getRawCurrentSessionUser();

  if (user?.role !== "admin") {
    redirect("/profile");
  }
}

export async function setAdminPreviewModeAction(formData: FormData) {
  await requirePreviewAdmin();

  const context = parsePreviewForm(formData);
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_PREVIEW_COOKIE, JSON.stringify(context), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(`/admin/preview?previewRole=${context.role}&previewJurisdiction=${encodeURIComponent(context.jurisdiction)}&previewDataState=${context.dataState}`);
}

export async function clearAdminPreviewModeAction() {
  await requirePreviewAdmin();

  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_PREVIEW_COOKIE);

  redirect("/admin/preview");
}
