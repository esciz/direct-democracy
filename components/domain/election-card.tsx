import Link from "next/link";

import { CandidateComparisonCard } from "@/components/domain/candidate-comparison-card";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { isGuestUser } from "@/lib/auth/session";
import { formatDateUtc } from "@/lib/dates";
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

type ImportedElectionCandidate = NonNullable<ElectionSummary["importedCandidates"]>[number];

function getImportedRaceGroups(candidates: ImportedElectionCandidate[]) {
  const groups = new Map<string, ImportedElectionCandidate[]>();

  for (const candidate of candidates) {
    const raceLabel = [candidate.officeTitle ?? "Office needs review", candidate.districtName].filter(Boolean).join(" · ");
    const key = `${raceLabel}|${candidate.jurisdictionName}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }

  return [...groups.entries()].map(([key, raceCandidates]) => ({
    key,
    raceLabel: key.split("|")[0],
    jurisdictionName: key.split("|")[1],
    candidates: raceCandidates,
  }));
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
          {formatDateUtc(electionDate, {
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
  const candidateCount = election.candidates.length + (election.importedCandidates?.length ?? 0);
  const importedRaceGroups = getImportedRaceGroups(election.importedCandidates ?? []);
  const hasImportedCandidates = Boolean(election.importedCandidates?.length);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">{election.jurisdictionName}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{election.title}</h2>
          {election.sourceLabel ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Imported Nevada beta data</p>
          ) : null}
          {election.isCommunityVoteOnly && election.authorityLabel ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">{election.authorityLabel}</p>
          ) : null}
          <p className="mt-2 text-sm text-slate-600">
            {formatDateUtc(election.electionDate, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · {election.electionType} · {election.electionStatus}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {candidateCount} candidates in this race
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
          {!election.isImported ? (
            <Link
              href={`/ads?electionId=${encodeURIComponent(election.id)}`}
              className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/15"
            >
              View Ads
            </Link>
          ) : null}
        </div>
      </div>

      {election.importedCandidates?.length ? (
        <div className="mt-6 rounded-3xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Imported Candidates</p>
              <p className="mt-1 text-sm text-slate-600">Candidate records linked to this imported Nevada election.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            {importedRaceGroups.slice(0, 4).map((group) => (
              <article key={group.key} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-ink">{group.raceLabel}</h3>
                    <p className="mt-1 text-sm text-slate-600">{group.jurisdictionName}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {group.candidates.length} candidate{group.candidates.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  {group.candidates.slice(0, 4).map((candidate) => (
                    <p key={candidate.id}>
                      <Link href={`/candidates/${candidate.id}`} className="font-semibold text-slate-800 hover:text-civic-700">
                        {candidate.ballotName ?? candidate.fullName}
                      </Link>{" "}
                      · {candidate.partyText ?? "No party listed"} · {candidate.filingStatus ?? candidate.status}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
          {importedRaceGroups.length > 4 ? (
            <Link href={`/elections/${election.id}`} className="mt-4 inline-flex text-sm font-semibold text-civic-700 hover:text-civic-900">
              View all {importedRaceGroups.length} races
            </Link>
          ) : null}
        </div>
      ) : null}

      {!hasImportedCandidates ? (
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
      ) : null}

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

      {election.importedRecordsNeedingReview?.length ? (
        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Imported Nevada records needing review</p>
          <div className="mt-3 grid gap-3">
            {election.importedRecordsNeedingReview.map((record) => (
              <div key={`${record.recordType}-${record.id}`} className="rounded-2xl bg-white p-4 text-sm text-slate-700">
                <p className="font-semibold text-ink">{record.title}</p>
                <p className="mt-1">{record.reason}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
