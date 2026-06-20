"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";

const ISSUE_REVIEW_REQUESTS_COOKIE = "dd_issue_review_requests";

type StoredIssueReviewRequest = {
  id: string;
  userId: string;
  title: string;
  category: string;
  community: string;
  description?: string | null;
  evidenceUrls: string[];
  status: "submitted";
  submittedAt: string;
};

function isStoredIssueReviewRequest(value: unknown): value is StoredIssueReviewRequest {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.userId === "string" &&
    typeof record.title === "string" &&
    typeof record.category === "string" &&
    typeof record.community === "string" &&
    Array.isArray(record.evidenceUrls) &&
    record.status === "submitted" &&
    typeof record.submittedAt === "string"
  );
}

async function getStoredIssueReviewRequests() {
  const raw = (await cookies()).get(ISSUE_REVIEW_REQUESTS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredIssueReviewRequest) : [];
  } catch {
    return [];
  }
}

async function setStoredIssueReviewRequests(records: StoredIssueReviewRequest[]) {
  (await cookies()).set(ISSUE_REVIEW_REQUESTS_COOKIE, JSON.stringify(records.slice(0, 100)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

function splitEvidenceUrls(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith("http"))
    .slice(0, 12);
}

export async function submitIssueReviewRequest(formData: FormData) {
  const user = await getCurrentUser();
  const title = formData.get("title");
  const category = formData.get("category");
  const community = formData.get("community");
  const description = formData.get("description");
  const evidenceUrls = splitEvidenceUrls(formData.get("evidenceUrls"));

  if (!user.isVerifiedVoter) redirect("/issues/report?error=verification");
  if (typeof title !== "string" || title.trim().length < 6) redirect("/issues/report?error=title");
  if (typeof category !== "string" || !category.trim()) redirect("/issues/report?error=category");
  if (typeof community !== "string" || community.trim().length < 2) redirect("/issues/report?error=community");

  const existing = await getStoredIssueReviewRequests();
  await setStoredIssueReviewRequests([
    {
      id: `issue_review_${Date.now()}`,
      userId: user.id,
      title: title.trim(),
      category: category.trim(),
      community: community.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      evidenceUrls,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    },
    ...existing,
  ]);

  redirect("/issues/report?submitted=1");
}
