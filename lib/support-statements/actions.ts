"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";

const SUPPORT_STATEMENTS_COOKIE = "dd_support_statement_submissions";

type SupportStatementSubmission = {
  id: string;
  userId: string;
  targetType: "issue" | "legislation" | "petition" | "case" | "event";
  targetName: string;
  statement: string;
  sourceUrl?: string | null;
  isPublic: boolean;
  createdAt: string;
};

function isSupportStatementSubmission(value: unknown): value is SupportStatementSubmission {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.userId === "string" &&
    typeof entry.targetType === "string" &&
    typeof entry.targetName === "string" &&
    typeof entry.statement === "string" &&
    (typeof entry.sourceUrl === "string" || entry.sourceUrl === null || entry.sourceUrl === undefined) &&
    typeof entry.isPublic === "boolean" &&
    typeof entry.createdAt === "string"
  );
}

async function getStoredSupportStatements() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SUPPORT_STATEMENTS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSupportStatementSubmission) : [];
  } catch {
    return [];
  }
}

async function setStoredSupportStatements(entries: SupportStatementSubmission[]) {
  const cookieStore = await cookies();
  cookieStore.set(SUPPORT_STATEMENTS_COOKIE, JSON.stringify(entries.slice(0, 120)), {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function createSupportStatementSubmission(formData: FormData) {
  const user = await getCurrentUser();
  const targetType = formData.get("targetType");
  const targetName = formData.get("targetName");
  const statement = formData.get("statement");
  const sourceUrl = formData.get("sourceUrl");
  const isPublic = formData.get("isPublic") === "on";

  if (!user.isVerifiedVoter) {
    redirect("/support-statements/new?error=verification");
  }

  if (
    targetType !== "issue" &&
    targetType !== "legislation" &&
    targetType !== "petition" &&
    targetType !== "case" &&
    targetType !== "event"
  ) {
    redirect("/support-statements/new?error=target");
  }

  if (typeof targetName !== "string" || targetName.trim().length < 4) {
    redirect("/support-statements/new?error=target");
  }

  if (typeof statement !== "string" || statement.trim().length < 20) {
    redirect("/support-statements/new?error=statement");
  }

  if (typeof statement === "string" && statement.trim().length > 400) {
    redirect("/support-statements/new?error=statement");
  }

  const existing = await getStoredSupportStatements();
  await setStoredSupportStatements([
    {
      id: `support_statement_${Date.now()}`,
      userId: user.id,
      targetType,
      targetName: targetName.trim(),
      statement: statement.trim(),
      sourceUrl: typeof sourceUrl === "string" && sourceUrl.trim() ? sourceUrl.trim() : null,
      isPublic,
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ]);

  redirect("/support-statements/new?saved=1");
}
