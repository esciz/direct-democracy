import Link from "next/link";

import { CandidateEndorsementQuickAction } from "@/components/domain/candidate-endorsement-quick-action";
import { ClaimProfileButton } from "@/components/domain/claim-profile-button";
import { DonateButton } from "@/components/domain/donate-button";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { UnclaimedProfileBadge } from "@/components/domain/unclaimed-profile-badge";
import type { CandidateCampaignSummary, CandidateMatchSummary, PublicProfileSummary } from "@/types/domain";

type CandidateComparisonCardProps = {
  candidate: PublicProfileSummary;
  campaign: CandidateCampaignSummary;
  match?: CandidateMatchSummary | null;
  viewerCanEndorse?: boolean;
  guestMode?: boolean;
};

export function CandidateComparisonCard({ candidate, campaign, match, viewerCanEndorse = false, guestMode = false }: CandidateComparisonCardProps) {
  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex items-start gap-4">
        <ProfileImagePlaceholder name={candidate.name} imageUrl={candidate.profileImageUrl} />
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-ink">{candidate.name}</h3>
          <p className="text-sm text-slate-500">
            {campaign.officeSought} · {campaign.jurisdictionName}
          </p>
          <div className="flex flex-wrap gap-2">
            {!candidate.isClaimed ? <UnclaimedProfileBadge /> : null}
            {campaign.partyText ? (
              <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                {campaign.partyText}
              </span>
            ) : null}
            {campaign.isIncumbent ? (
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
                Incumbent
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-700">{candidate.bio}</p>

      {match ? (
        <div className="mt-5 rounded-3xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Matches your views</p>
              <p className="mt-2 text-sm text-slate-600">Based on your activity and selected issues.</p>
            </div>
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Match</p>
              <p className="mt-1 text-xl font-semibold">{match.matchPercentage}%</p>
            </div>
          </div>
          {match.alignedIssues.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {match.alignedIssues.map((issue) => (
                <span key={issue} className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                  {issue}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Raised</p>
          <p className="mt-2 text-2xl font-semibold">{campaign.totalRaised ?? "TBD"}</p>
        </div>
        <div className="rounded-2xl bg-civic-50 p-4 text-civic-900">
          <p className="text-xs uppercase tracking-[0.16em] text-civic-700">Top donor categories</p>
          <p className="mt-2 text-sm font-semibold">{campaign.topDonorCategories?.join(" · ") ?? "Not listed"}</p>
        </div>
      </div>

      {campaign.pollingSummary ? <p className="mt-4 text-sm text-slate-600">{campaign.pollingSummary}</p> : null}
      {campaign.pollingComparisons?.length ? (
        <div className="mt-4 rounded-3xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">External polling vs platform sentiment</p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">External polling:</span> {campaign.pollingComparisons[0].externalResult}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Platform sentiment:</span> {campaign.pollingComparisons[0].platformSentiment}
          </p>
          <p className="mt-2 text-sm text-slate-600">{campaign.pollingComparisons[0].differenceLabel}</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <CandidateEndorsementQuickAction
          candidateCampaignId={campaign.id}
          electionId={campaign.electionId}
          endorsementCount={campaign.endorsementCount}
          hasDirectEndorsement={Boolean(campaign.viewerEndorsement)}
          hasOtherEndorsementInElection={Boolean(
            campaign.viewerElectionEndorsementCampaignId && campaign.viewerElectionEndorsementCampaignId !== campaign.id,
          )}
          canEndorse={viewerCanEndorse}
        />
        <Link
          href={`/candidates/${candidate.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          View profile
        </Link>
        {match ? (
          <Link
            href={`#match-${candidate.id}`}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Compare
          </Link>
        ) : null}
        {!candidate.isClaimed ? <ClaimProfileButton profileId={candidate.id} guestMode={guestMode} /> : null}
        <DonateButton href={campaign.donationUrl ?? candidate.donationUrl} />
      </div>
    </article>
  );
}
