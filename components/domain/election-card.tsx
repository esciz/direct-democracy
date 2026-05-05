import Link from "next/link";

import { CandidateComparisonCard } from "@/components/domain/candidate-comparison-card";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { isGuestUser } from "@/lib/auth/session";
import type { AuthUser, BallotInitiativeSummary, ElectionSummary, PublicProfileSummary } from "@/types/domain";

type ElectionCardProps = {
  election: ElectionSummary;
  candidates: PublicProfileSummary[];
  viewer: AuthUser;
};

function canViewerEndorse(viewer: AuthUser) {
  return viewer.isVerifiedVoter && (viewer.role === "citizen" || viewer.role === "trustedCitizen");
}

function getCountdownLabel(isoDate: string) {
  const ms = Date.parse(isoDate) - Date.now();
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day away";
  }

  if (days < 30) {
    return `${days} days away`;
  }

  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} away`;
}

function BallotQuestionPreview({
  initiative,
  electionDate,
  electionStatus,
}: {
  initiative: BallotInitiativeSummary;
  electionDate: string;
  electionStatus: ElectionSummary["electionStatus"];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">Ballot Question</p>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-ink">{initiative.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{initiative.summary}</p>
        </div>
        <Link href={`/initiatives/${initiative.id}`} className="text-xs font-semibold text-civic-700 hover:text-civic-800">
          View
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{initiative.jurisdictionName}</span>
        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
          {new Date(electionDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}{" "}
          · {getCountdownLabel(electionDate)}
        </span>
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{electionStatus}</span>
      </div>
    </div>
  );
}

export function ElectionCard({ election, candidates, viewer }: ElectionCardProps) {
  const guestMode = isGuestUser(viewer);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">{election.jurisdictionName}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{election.title}</h2>
          {election.isCommunityVoteOnly && election.authorityLabel ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">{election.authorityLabel}</p>
          ) : null}
          <p className="mt-2 text-sm text-slate-600">
            {new Date(election.electionDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · {election.electionType} · {election.electionStatus}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {election.candidates.length} candidates in this race
            {election.ballotInitiatives.length ? ` · ${election.ballotInitiatives.length} ballot initiative${election.ballotInitiatives.length === 1 ? "" : "s"}` : "."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <FavoriteToggleControl targetType="election" targetId={election.id} />
          <ShareActionMenu
            target={{
              entityType: "election",
              entityId: election.id,
              title: election.title,
              href: `/elections/${election.id}`,
              summary: `${election.jurisdictionName} · ${election.electionType}`,
              issueTag: election.ballotInitiatives[0]?.relatedIssues?.[0] ?? null,
            }}
            returnPath={`/elections/${election.id}`}
            guestMode={guestMode}
            iconOnly
          />
          <Link
            href={`/elections/${election.id}`}
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            View election
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {election.candidates.map((campaign) => {
          const candidate = candidates.find((profile) => profile.id === campaign.publicProfileId);

          if (!candidate) {
            return null;
          }

          return (
            <CandidateComparisonCard
              key={campaign.id}
              candidate={candidate}
              campaign={campaign}
              viewerCanEndorse={canViewerEndorse(viewer)}
              guestMode={guestMode}
            />
          );
        })}
      </div>

      {election.ballotInitiatives.length ? (
        <div className="mt-6 rounded-3xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Ballot Questions</p>
              <p className="mt-1 text-sm text-slate-600">
                Measures and ballot questions appearing on the same ballot as this race.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {election.ballotInitiatives.map((initiative) => (
              <BallotQuestionPreview
                key={initiative.id}
                initiative={initiative}
                electionDate={election.electionDate}
                electionStatus={election.electionStatus}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
