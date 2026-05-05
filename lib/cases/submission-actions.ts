"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { ensureIssueReferenceForUser } from "@/lib/server/issues";

const CASE_SUBMISSIONS_COOKIE = "dd_case_submission_requests";

type CaseSubmissionRequest = {
  id: string;
  userId: string;
  caseTitle: string;
  caseNumber?: string | null;
  issueTags?: string[];
  jurisdiction: string;
  courtLevel: string;
  sourceUrl: string;
  summary: string;
  status: "pending_review";
  createdAt: string;
};

function isCaseSubmissionRequest(value: unknown): value is CaseSubmissionRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.userId === "string" &&
    typeof entry.caseTitle === "string" &&
    (typeof entry.caseNumber === "string" || entry.caseNumber === null || entry.caseNumber === undefined) &&
    (Array.isArray(entry.issueTags) || entry.issueTags === undefined) &&
    typeof entry.jurisdiction === "string" &&
    typeof entry.courtLevel === "string" &&
    typeof entry.sourceUrl === "string" &&
    typeof entry.summary === "string" &&
    entry.status === "pending_review" &&
    typeof entry.createdAt === "string"
  );
}

async function getStoredCaseSubmissionRequests() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CASE_SUBMISSIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCaseSubmissionRequest) : [];
  } catch {
    return [];
  }
}

async function setStoredCaseSubmissionRequests(entries: CaseSubmissionRequest[]) {
  const cookieStore = await cookies();
  cookieStore.set(CASE_SUBMISSIONS_COOKIE, JSON.stringify(entries.slice(0, 120)), {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  });
}

export async function submitVerifiedCaseRequest(formData: FormData) {
  const user = await getCurrentUser();
  const caseTitle = formData.get("caseTitle");
  const caseNumber = formData.get("caseNumber");
  const jurisdiction = formData.get("jurisdiction");
  const courtLevel = formData.get("courtLevel");
  const sourceUrl = formData.get("sourceUrl");
  const summary = formData.get("summary");
  const issueTag = formData.get("issueTag");

  if (!user.isVerifiedVoter) {
    redirect("/cases/submit?error=verification");
  }

  if (typeof caseTitle !== "string" || caseTitle.trim().length < 6) {
    redirect("/cases/submit?error=title");
  }

  if (typeof jurisdiction !== "string" || jurisdiction.trim().length < 2) {
    redirect("/cases/submit?error=jurisdiction");
  }

  if (typeof courtLevel !== "string" || courtLevel.trim().length < 3) {
    redirect("/cases/submit?error=court");
  }

  if (typeof sourceUrl !== "string" || !sourceUrl.trim().startsWith("http")) {
    redirect("/cases/submit?error=source");
  }

  if (typeof summary !== "string" || summary.trim().length < 30) {
    redirect("/cases/submit?error=summary");
  }

  const linkedIssue =
    typeof issueTag === "string" && issueTag.trim()
      ? await ensureIssueReferenceForUser(user, issueTag.trim(), { jurisdictionName: jurisdiction.trim() })
      : null;

  const existing = await getStoredCaseSubmissionRequests();
  await setStoredCaseSubmissionRequests([
    {
      id: `case_submission_${Date.now()}`,
      userId: user.id,
      caseTitle: caseTitle.trim(),
      caseNumber: typeof caseNumber === "string" && caseNumber.trim() ? caseNumber.trim() : null,
      issueTags: linkedIssue ? [linkedIssue.issueText] : [],
      jurisdiction: jurisdiction.trim(),
      courtLevel: courtLevel.trim(),
      sourceUrl: sourceUrl.trim(),
      summary: summary.trim(),
      status: "pending_review",
      createdAt: new Date().toISOString(),
    },
    ...existing,
  ]);

  redirect("/cases/submit?submitted=1");
}
