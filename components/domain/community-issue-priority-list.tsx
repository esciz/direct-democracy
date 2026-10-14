import Link from "next/link";

import { RevealIconChip } from "@/components/domain/reveal-icon-chip";
import { getIssueVisualToken } from "@/lib/ui/visual-tokens";
import type { IssuePrioritySummary } from "@/types/domain";

type CommunityIssuePriorityListProps = {
  issues: IssuePrioritySummary[];
  communityId: string;
};

export function CommunityIssuePriorityList({ issues, communityId }: CommunityIssuePriorityListProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Top issues</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">What this community says matters most</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Ranked from structured user profile data so the page feels like a live snapshot of community priorities, not a generic list.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {issues.length ? (
          issues.map((issue) => (
            <article key={issue.normalizedKey} className="rounded-3xl bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                  #{issue.rank}
                </span>
                <RevealIconChip {...getIssueVisualToken(issue.label)} tone="civic" />
                <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                  {issue.count} mentions
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {issue.percentage}% of profiles
                </span>
              </div>
              <div className="mt-4 h-3 rounded-full bg-slate-200">
                <div className="h-3 rounded-full bg-civic-500" style={{ width: `${Math.max(issue.percentage, 6)}%` }} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                {issue.relatedPetitionId ? (
                  <Link href={`/petitions/${issue.relatedPetitionId}`} className="font-semibold text-civic-700 transition hover:text-civic-900">
                    Related petition
                  </Link>
                ) : null}
                {issue.relatedQuestionCount ? (
                  <Link href={`/voting?search=${encodeURIComponent(issue.label)}`} className="font-semibold text-civic-700 transition hover:text-civic-900">
                    {issue.relatedQuestionCount} related question{issue.relatedQuestionCount === 1 ? "" : "s"}
                  </Link>
                ) : null}
                {issue.relatedPollCount ? (
                  <Link href={`/polls?communityId=${communityId}`} className="font-semibold text-civic-700 transition hover:text-civic-900">
                    {issue.relatedPollCount} related poll{issue.relatedPollCount === 1 ? "" : "s"}
                  </Link>
                ) : null}
                {issue.relatedEventCount ? (
                  <Link
                    href={`/events?communityId=${communityId}&issue=${encodeURIComponent(issue.label)}`}
                    className="font-semibold text-civic-700 transition hover:text-civic-900"
                  >
                    {issue.relatedEventCount} related event{issue.relatedEventCount === 1 ? "" : "s"}
                  </Link>
                ) : null}
              </div>
              {issue.relatedGroups.length ? (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Groups engaged around this issue</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {issue.relatedGroups.map((group) => (
                      <Link
                        key={group.id}
                        href={`/my-community?communityId=${communityId}&groupTag=${encodeURIComponent(group.name)}`}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200"
                      >
                        {group.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              {issue.topVoiceMatches.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {issue.topVoiceMatches.map((voice) => (
                    <Link
                      key={voice.id}
                      href={`/citizens/${voice.id}`}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200"
                    >
                      Top voice: {voice.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">
            No issue priorities have been saved for this view yet.
          </div>
        )}
      </div>
    </section>
  );
}
