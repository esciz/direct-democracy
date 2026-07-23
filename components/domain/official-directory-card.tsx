import Link from "next/link";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { FollowButton } from "@/components/domain/follow-button";
import type { OfficialProfileSummary } from "@/types/domain";

type OfficialDirectoryCardProps = {
  official: OfficialProfileSummary;
  returnPath?: string;
};

export function OfficialDirectoryCard({ official, returnPath = "/officials" }: OfficialDirectoryCardProps) {
  const isImported = Boolean(official.sourceLabel);
  const bioSummary = official.bio?.replace(/\s+/g, " ").trim() ?? null;

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
                Official source
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
            {!isImported ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {official.followerCount.toLocaleString()} followers
              </span>
            ) : null}
          </div>
        </div>
        <FavoriteToggleControl
          targetType="official"
          targetId={official.id}
          visibleLabel="Save"
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-civic-500 hover:text-civic-700"
        />
      </div>
      <div className="mt-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">About this official</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {bioSummary ? (bioSummary.length > 220 ? `${bioSummary.slice(0, 219).trimEnd()}...` : bioSummary) : "A reviewed official biography has not been attached yet."}
        </p>
        {official.sourceLabel ? <p className="mt-2 text-xs font-semibold text-slate-500">Source: {official.sourceLabel}</p> : null}
      </div>
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
