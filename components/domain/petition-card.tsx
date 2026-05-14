import Link from "next/link";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { SentimentHistoryChart } from "@/components/domain/sentiment-history-chart";
import { slugifyIssueText } from "@/lib/issues/utils";
import { buildSentimentHistory } from "@/lib/sentiment/history";
import type { PetitionSummary } from "@/types/domain";

type PetitionCardProps = {
  petition: PetitionSummary;
};

export function PetitionCard({ petition }: PetitionCardProps) {
  const percent = Math.min(100, Math.round((petition.signatureCount / petition.signatureGoal) * 100));
  const actionLabel = petition.eligibleForCosponsorship ? "View eligibility" : "View petition";
  const currentSupport = Math.min(84, Math.max(24, Math.round(percent * 0.72)));
  const history = buildSentimentHistory(`petition-${petition.id}`, currentSupport, { points: 6, opposeBias: 20 });

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <CivicAvatar
            name={petition.creatorName}
            entityType={petition.organizationId ? "organization" : "petition"}
            size="sm"
            verified={Boolean(petition.organizationId)}
          />
          <div>
            <p className="text-sm font-semibold text-civic-700">{petition.jurisdictionName}</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">{petition.title}</h2>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <FavoriteToggleControl targetType="petition" targetId={petition.id} />
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
            {petition.status}
          </span>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">{petition.summary}</p>
      {petition.issueTags?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {petition.issueTags.map((tag) => (
            <Link
              key={`${petition.id}-${tag}`}
              href={`/issues/${slugifyIssueText(tag)}`}
              className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700 transition hover:text-civic-900"
            >
              {tag}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm font-medium text-slate-600">
          <span>{petition.signatureCount.toLocaleString()} valid signatures</span>
          <span>{petition.signatureGoal.toLocaleString()} goal</span>
        </div>
        <div className="mt-3 h-3 rounded-full bg-slate-100">
          <div className="h-3 rounded-full bg-civic-500" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Created by {petition.creatorName}</span>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">
          {petition.eligibleForCosponsorship ? "Eligible for co-sponsorship" : "Collecting signatures"}
        </span>
      </div>
      <div className="mt-5">
        <SentimentHistoryChart data={history} title="Support trend" currentValue={currentSupport} compact showLegend={false} />
      </div>
      <div className="mt-5">
        <Link
          href={`/petitions/${petition.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}
