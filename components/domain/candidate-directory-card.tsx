import Link from "next/link";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { FollowButton } from "@/components/domain/follow-button";
import type { PublicProfileSummary } from "@/types/domain";

export type CandidateDataCoverage = {
  hasBio: boolean;
  hasFinance: boolean;
  hasIssues: boolean;
  hasNews: boolean;
  completenessScore: number;
};

type CandidateDirectoryCardProps = {
  candidate: PublicProfileSummary;
  dataCoverage?: CandidateDataCoverage;
  returnPath?: string;
};

function clipSummary(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trimEnd()}...` : normalized;
}

export function CandidateDirectoryCard({ candidate, dataCoverage, returnPath = "/candidates" }: CandidateDirectoryCardProps) {
  const imported = candidate.importedCandidate;
  const officeLabel = imported?.officeTitle ?? "Office needs review";
  const raceLabel = imported?.electionTitle ?? candidate.jurisdictionName;
  const reviewedKnowledgeBio = imported?.knowledgeEnrichments?.find((entry) => entry.aboutSummary)?.aboutSummary ?? null;
  const bioSummary = dataCoverage?.hasBio ? reviewedKnowledgeBio ?? imported?.websiteEnrichment?.shortBio ?? candidate.bio : null;
  const coverageItems = dataCoverage
    ? [
        { label: "Bio", available: dataCoverage.hasBio },
        { label: "Finance", available: dataCoverage.hasFinance },
        { label: "Positions", available: dataCoverage.hasIssues },
        { label: "News", available: dataCoverage.hasNews },
      ]
    : [];

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
                Filing source
              </span>
            ) : null}
          </div>
          {imported ? (
            <div className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">{officeLabel}</span>
                {" · "}
                {raceLabel}
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
          visibleLabel="Save"
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-civic-500 hover:text-civic-700"
        />
      </div>
      {imported ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {bioSummary ? clipSummary(bioSummary) : "A reviewed biography has not been attached to this filing record yet."}
        </p>
      ) : null}
      {coverageItems.length ? (
        <div className="mt-3 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Voter information</p>
            <span className="text-xs font-semibold text-slate-700">{dataCoverage?.completenessScore}% sourced</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {coverageItems.map((item) => (
              <span key={item.label} className={`rounded-xl px-2.5 py-2 text-center text-xs font-semibold ${item.available ? "bg-emerald-100 text-emerald-800" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
                {item.label} · {item.available ? "Available" : "Needed"}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Filing: {imported?.filingStatus ?? imported?.candidateStatus ?? "Status pending"} · Source: {imported?.sourceLabel ?? candidate.sourceLabel ?? "Source review needed"}
          </p>
        </div>
      ) : null}
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
          Open profile
        </Link>
        {candidate.sourceUrl || imported?.sourceUrl ? (
          <a
            href={candidate.sourceUrl ?? imported?.sourceUrl ?? ""}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Source
          </a>
        ) : null}
      </div>
    </article>
  );
}
