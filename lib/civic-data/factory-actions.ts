"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { CivicRecordReviewStatus } from "@prisma/client";

import { syncCivicSource } from "@/lib/civic-data/service";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

async function requireAdmin() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateFactory() {
  revalidatePath("/admin/data-factory");
  revalidatePath("/admin/data");
  revalidatePath("/admin/sources");
}

export async function updateReviewQueueItemStatusAction(formData: FormData) {
  await requireAdmin();

  const itemId = readString(formData, "itemId");
  const status = readString(formData, "status") as CivicRecordReviewStatus;

  if (!itemId || !(status in CivicRecordReviewStatus)) {
    redirect("/admin/data-factory?error=invalid-review-item");
  }

  await prisma.reviewQueueItem.update({
    where: { id: itemId },
    data: {
      reviewStatus: status,
      reviewedAt: new Date(),
    },
  });

  revalidateFactory();
  redirect(`/admin/data-factory?review=${encodeURIComponent(status)}`);
}

export async function rerunFactorySourceAction(formData: FormData) {
  await requireAdmin();

  const sourceSlug = readString(formData, "sourceSlug");

  if (!sourceSlug) {
    redirect("/admin/data-factory?error=missing-source");
  }

  try {
    await syncCivicSource(sourceSlug, "manual");
  } catch {
    redirect(`/admin/data-factory?error=sync-failed&source=${encodeURIComponent(sourceSlug)}`);
  }

  revalidateFactory();
  redirect(`/admin/data-factory?synced=${encodeURIComponent(sourceSlug)}`);
}
