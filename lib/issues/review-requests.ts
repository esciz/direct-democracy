import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import type { IssueReviewRequestSummary } from "@/types/domain";

const ISSUE_REVIEW_RUNTIME_PATH = path.join(process.cwd(), "data/generated/issue-review-requests-runtime.json");

type IssueReviewRuntime = {
  records?: IssueReviewRequestSummary[];
};

export async function getIssueReviewRequests() {
  try {
    const parsed = JSON.parse(await fs.readFile(ISSUE_REVIEW_RUNTIME_PATH, "utf8")) as IssueReviewRuntime;
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[issues] Unable to read issue review request runtime", error);
    }
    return [];
  }
}

export async function getIssueReviewRequestsForIssue(issueText: string) {
  const normalized = issueText.toLowerCase();
  return (await getIssueReviewRequests()).filter((request) => {
    return (
      request.title.toLowerCase().includes(normalized) ||
      request.category.toLowerCase() === normalized ||
      request.description?.toLowerCase().includes(normalized) ||
      request.community.toLowerCase().includes(normalized) ||
      request.jurisdictionName.toLowerCase().includes(normalized)
    );
  });
}
