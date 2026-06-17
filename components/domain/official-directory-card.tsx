import Link from "next/link";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { FollowButton } from "@/components/domain/follow-button";
import { SentimentHistoryChart } from "@/components/domain/sentiment-history-chart";
import { buildSentimentHistory } from "@/lib/sentiment/history";
import type { OfficialProfileSummary } from "@/types/domain";

type OfficialDirectoryCardProps = {
  official: OfficialProfileSummary;
  returnPath?: string;
};

export function OfficialDirectoryCard({ official, returnPath = "/officials" }: OfficialDirectoryCardProps) {
  const isImported = Boolean(official.sourceLabel);
  const hasMeasuredSentiment = !isImported && (Boolean(official.followThroughScore) || Boolean(official.truthScore?.media));
  const currentSupport = Math.min(
    82,
    Math.max(34, Math.round(((official.followThroughScore ?? 52) + (official.truthScore?.media ?? 52)) / 2)),
  );
  const history = buildSentimentHistory(`official-${official.id}`, currentSupport, { points: 5, opposeBias: 24 });

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-3.5 shadow-card backdrop-blur">
      <div className="flex items-start gap-2.5">
        <CivicAvatar
          name={official.name}
          imageUrl={official.profileImageUrl}
          entityType="official"
          size="sm"
          verified
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base font-semibold text-ink">{official.name}</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200">
              Official
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {official.party}
            </span>
            {isImported ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                Real data
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {official.officeTitle} · {official.jurisdictionName}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {!isImported && official.truthScore?.media ? (
              <span className="rounded-full bg-civic-50 px-2.5 py-1 text-[11px] font-semibold text-civic-700">
                Truth {official.truthScore.media}
              </span>
            ) : null}
            {!isImported && official.followThroughScore ? (
              <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                Follow-through {official.followThroughScore}
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              {isImported ? "Followers coming soon" : `${official.followerCount.toLocaleString()} followers`}
            </span>
          </div>
        </div>
        <FavoriteToggleControl
          targetType="official"
          targetId={official.id}
          visibleLabel="Save"
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-civic-500 hover:text-civic-700"
        />
      </div>
      {isImported ? (
        <div className="mt-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Sentiment preview</p>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">Coming soon</span>
          </div>
          <div className="mt-3 flex h-12 items-end gap-1.5" aria-hidden="true">
            {[32, 44, 36, 54, 48].map((height, index) => (
              <span key={`${official.id}-sentiment-${index}`} className="flex-1 rounded-t-lg bg-slate-300/70" style={{ height: `${height}%` }} />
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">No measured public opinion is shown for imported officials yet.</p>
        </div>
      ) : hasMeasuredSentiment ? (
        <div className="mt-3">
          <SentimentHistoryChart data={history} title="Public sentiment" currentValue={currentSupport} compact showLegend={false} />
        </div>
      ) : (
        <div className="mt-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          Sentiment preview coming soon.
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {official.viewerCanFollow && official.claimedByUserId ? (
          <FollowButton
            targetUserId={official.claimedByUserId}
            returnPath={returnPath}
            isFollowing={Boolean(official.viewerIsFollowing)}
            className={
              official.viewerIsFollowing
                ? "rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                : "rounded-full bg-civic-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            }
          />
        ) : isImported ? (
          <button
            type="button"
            disabled
            className="rounded-full border border-slate-200 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-500"
          >
            Follow pending
          </button>
        ) : null}
        <Link
          href={`/officials/${official.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          Open profile
        </Link>
        {official.websiteUrl ? (
          <a
            href={official.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Official site
          </a>
        ) : null}
      </div>
    </article>
  );
}
