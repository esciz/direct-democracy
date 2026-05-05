import Link from "next/link";

import { RevealIconChip } from "@/components/domain/reveal-icon-chip";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { toggleTopIssueUpvote } from "@/lib/community/actions";
import { getIssueVisualToken } from "@/lib/ui/visual-tokens";
import type { TopIssueSummary } from "@/types/domain";

type TopIssueCardProps = {
  issue: TopIssueSummary;
  returnPath: string;
};

function scopeLabel(scope: TopIssueSummary["scope"]) {
  if (scope === "local") {
    return "Local";
  }

  if (scope === "state") {
    return "State";
  }

  return "National";
}

export function TopIssueCard({ issue, returnPath }: TopIssueCardProps) {
  return (
    <article className="rounded-3xl bg-slate-50 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {scopeLabel(issue.scope)}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {issue.source === "curated" ? "System selected" : "Write-in"}
        </span>
      </div>
      <div className="mt-3">
        <RevealIconChip {...getIssueVisualToken(issue.issueText)} tone="civic" />
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {issue.jurisdictionName}
        {issue.createdByName ? ` · ${issue.createdByName}` : ""}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/issues/${issue.id}`}
          className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          View issue
        </Link>
        <form action={toggleTopIssueUpvote}>
          <input type="hidden" name="issueId" value={issue.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <FormSubmitButton
            idleLabel={issue.viewerHasUpvoted ? `Supported · ${issue.upvoteCount}` : `Support issue · ${issue.upvoteCount}`}
            pendingLabel="Updating..."
            className={
              issue.viewerHasUpvoted
                ? "rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                : "rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
            }
          />
        </form>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {issue.upvoteCount} supporters today
        </span>
      </div>
    </article>
  );
}
