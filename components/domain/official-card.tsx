import Link from "next/link";

import { ClaimProfileButton } from "@/components/domain/claim-profile-button";
import { CivicAvatar } from "@/components/domain/civic-avatar";
import { UnclaimedProfileBadge } from "@/components/domain/unclaimed-profile-badge";
import type { OfficialProfileSummary } from "@/types/domain";

type OfficialCardProps = {
  official: OfficialProfileSummary;
};

export function OfficialCard({ official }: OfficialCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <CivicAvatar name={official.name} imageUrl={official.profileImageUrl} entityType="official" size="lg" verified />
          <div>
            <p className="text-xl font-semibold text-ink">{official.name}</p>
            <p className="mt-2 text-sm text-slate-500">
              {official.officeTitle} · {official.jurisdictionName}
            </p>
            {official.sourceLabel ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Imported Nevada beta data</p> : null}
            {!official.isClaimed ? <div className="mt-2"><UnclaimedProfileBadge /></div> : null}
          </div>
        </div>
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {official.party}
        </span>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">{official.bio}</p>
      <p className="mt-4 text-sm leading-7 text-slate-600">{official.platformSummary}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Followers</p>
          <p className="mt-2 text-2xl font-semibold">{official.followerCount.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-civic-50 p-4 text-civic-900">
          <p className="text-xs uppercase tracking-[0.16em] text-civic-700">Truth meter</p>
          <p className="mt-2 text-2xl font-semibold">{official.truthScore?.media ?? "Pending"}</p>
        </div>
        <div className="rounded-2xl bg-orange-50 p-4 text-orange-900">
          <p className="text-xs uppercase tracking-[0.16em] text-orange-700">Follow-through</p>
          <p className="mt-2 text-2xl font-semibold">{official.followThroughScore ?? "Pending"}</p>
        </div>
      </div>
      <div className="mt-5">
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/officials/${official.id}`}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            View profile
          </Link>
          {official.websiteUrl ? (
            <a
              href={official.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Official site
            </a>
          ) : null}
          {!official.isClaimed ? <ClaimProfileButton profileId={official.id} /> : null}
        </div>
      </div>
    </article>
  );
}
