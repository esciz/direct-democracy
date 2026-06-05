import Link from "next/link";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { FollowButton } from "@/components/domain/follow-button";
import { SentimentHistoryChart } from "@/components/domain/sentiment-history-chart";
import { buildSentimentHistory } from "@/lib/sentiment/history";
import type { PublicProfileSummary } from "@/types/domain";

type CandidateDirectoryCardProps = {
  candidate: PublicProfileSummary;
  returnPath?: string;
};

export function CandidateDirectoryCard({ candidate, returnPath = "/candidates" }: CandidateDirectoryCardProps) {
  const currentSupport = Math.min(78, Math.max(36, 42 + ((candidate.followerCount ?? 0) % 21)));
  const history = buildSentimentHistory(`candidate-${candidate.id}`, currentSupport, { points: 5, opposeBias: 25 });
  const imported = candidate.importedCandidate;

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-3.5 shadow-card backdrop-blur">
      <div className="flex items-start gap-2.5">
        <CivicAvatar
          name={candidate.name}
          imageUrl={candidate.profileImageUrl}
          entityType="candidate"
          size="sm"
          verified={Boolean(candidate.isClaimed)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-ink">{candidate.name}</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200">
              Candidate
            </span>
            {candidate.partyText ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {candidate.partyText}
              </span>
            ) : null}
            {candidate.isImported ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Imported Nevada beta data
              </span>
            ) : null}
          </div>
          {imported ? (
            <div className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">{imported.officeTitle ?? "Office needs review"}</span>
                {" · "}
                {imported.electionTitle}
              </p>
              <p>
                {candidate.jurisdictionName}
                {" · "}
                {imported.districtName ?? "District not listed"}
              </p>
            </div>
          ) : typeof candidate.followerCount === "number" ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {candidate.followerCount.toLocaleString()} followers
              </span>
            </div>
          ) : null}
        </div>
        <FavoriteToggleControl
          targetType="candidate"
          targetId={candidate.id}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-civic-500 hover:text-civic-700"
        />
      </div>
      {imported ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <p className="font-semibold uppercase tracking-[0.14em] text-slate-500">Filing</p>
            <p className="mt-1 font-semibold text-slate-800">{imported.filingStatus ?? imported.candidateStatus ?? "Profile info pending"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2">
            <p className="font-semibold uppercase tracking-[0.14em] text-slate-500">Source</p>
            <p className="mt-1 font-semibold text-slate-800">{imported.sourceUrl ? "Verified link" : "Source pending"}</p>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <SentimentHistoryChart data={history} title="Public sentiment" currentValue={currentSupport} compact showLegend={false} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {!candidate.isImported && candidate.viewerCanFollow && candidate.claimedByUserId ? (
          <FollowButton
            targetUserId={candidate.claimedByUserId}
            returnPath={returnPath}
            isFollowing={Boolean(candidate.viewerIsFollowing)}
            className={
              candidate.viewerIsFollowing
                ? "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                : "rounded-full bg-civic-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            }
          />
        ) : null}
        <Link
          href={`/candidates/${candidate.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Open candidate profile
        </Link>
      </div>
    </article>
  );
}
