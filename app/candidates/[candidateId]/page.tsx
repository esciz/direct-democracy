import { Suspense } from "react";
import Link from "next/link";

import { CandidatePromisesSection } from "@/components/domain/candidate-promises-section";
import { ProfileViewerAlignmentCard } from "@/components/domain/profile-viewer-alignment-card";
import { ProfileSentimentTracker } from "@/components/domain/profile-sentiment-tracker";
import { CandidateEndorsementsPanel } from "@/components/domain/candidate-endorsements-panel";
import { CampaignFinanceSourceCard } from "@/components/domain/campaign-finance-source-card";
import { CandidateRaceContextCard } from "@/components/domain/candidate-race-context-card";
import { CandidateProfileHero } from "@/components/domain/candidate-profile-hero";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { IssuePositionsSection } from "@/components/domain/issue-positions-section";
import { MissingCandidateInfoCard } from "@/components/domain/missing-candidate-info-card";
import { NewsMentionsSection } from "@/components/domain/news-mentions-section";
import { OfficeIntelligenceCard } from "@/components/domain/office-intelligence-card";
import { OfficialGovernmentSourceCard } from "@/components/domain/official-government-source-card";
import { OfficialSourceDocumentsCard } from "@/components/domain/official-source-documents-card";
import { PollCard } from "@/components/domain/poll-card";
import { PoliticalAdsSection } from "@/components/domain/political-ads-section";
import { PostCard } from "@/components/domain/post-card";
import { ProfileInterviewsSection } from "@/components/domain/profile-interviews-section";
import { SourceExplorer, type SourceExplorerItem } from "@/components/domain/source-explorer";
import { SummaryBriefPanel } from "@/components/domain/summary-brief-panel";
import { canUserVote } from "@/lib/auth/guards";
import { addCandidateKnowledgeSourceAction } from "@/lib/enrichment/actions";
import { getDefaultSeedUser, getSeedUserById } from "@/lib/auth/mock-users";
import { isGuestUserId } from "@/lib/auth/session";
import { formatDateUtc } from "@/lib/dates";
import { getCurrentFeedViewer, getCurrentSessionUser, getCurrentUser } from "@/lib/server/auth-session";
import { attachEndorsementsToCampaigns } from "@/lib/candidates/endorsements";
import { getOfficeIntelligence } from "@/lib/candidates/office-intelligence";
import { getCandidateRaceContext, type CandidateRaceContext } from "@/lib/candidates/race-context";
import { getAllCandidateCampaigns, getAllOfficialPositions, getCandidateProfileById, getCandidateProfiles } from "@/lib/server/elections-context";
import { getCandidateMatchSummary } from "@/lib/candidates/matching";
import { getInterviewRequestsForPublicProfile } from "@/lib/server/interviews";
import { getClaimActionStateForViewer, getClaimMatchForProfile, getOnboardingDraft } from "@/lib/server/onboarding";
import { getCampaignFinanceSourceCard, type CampaignFinanceSourceCardData } from "@/lib/civic-data/profile-source-cards";
import { getContextualPostPreviews } from "@/lib/feed/posts";
import { getCandidateIssuePositions } from "@/lib/issue-positions/store";
import { findIncumbentOfficialMatch, getApprovedOfficialGovernmentEnrichment, type ApprovedOfficialGovernmentEnrichment, type IncumbentOfficialMatch } from "@/lib/incumbents/official-bio-enrichment";
import { getProfileNewsMentionCard, type ProfileNewsMentionCardData } from "@/lib/news-mentions/store";
import { createEmptyCampaignFinanceDashboard } from "@/lib/nv-sos/finance-dashboard";
import { getOfficialSourceDocumentsForProfile, type OfficialSourceDocumentsCardData } from "@/lib/nv-sos/public";
import { getOrganizationTypeLabel } from "@/lib/organizations/presentation";
import { getOrganizationEndorsementsForCampaign } from "@/lib/organizations/store";
import { getPoliticalAdsForEntity } from "@/lib/political-ads/store";
import { getUserProfileContent } from "@/lib/profile/details";
import { mergeExternalLinksWithWebsite } from "@/lib/profile/external-links";
import { getSafeUserProgressionSummary } from "@/lib/profile/progression";
import { buildCandidateProfileSignals } from "@/lib/profile/signals";
import { getCandidateViewerAlignmentSummary } from "@/lib/profile/viewer-alignment";
import { getPollsByCreator } from "@/lib/polls/store";
import { getLightweightFollowState } from "@/lib/social/follows";
import { getProfileSentimentSummary } from "@/lib/votes/profile-sentiment";
import { NewsMentionTargetType } from "@prisma/client";
import type { CandidateProfileDetail, ProfileSignalsSummary, PublicIssuePositionSummary, PublicProfileInterviewsSummary, PublicProfileSummary, UserRole } from "@/types/domain";

type CandidateDetailPageProps = {
  params: Promise<{
    candidateId: string;
  }>;
  searchParams?: Promise<{
    promises?: string;
    endorsement?: string;
    credits?: string;
    pollPromotion?: string;
    pollPromotionError?: string;
    progressionRole?: string;
    sourceUserId?: string;
  }>;
};

function withSectionTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 1800): Promise<T> {
  void label;
  void timeoutMs;
  return promise;
}

async function getCandidateSummaryById(candidateId: string) {
  const candidates = await getCandidateProfiles();
  return candidates.find((candidate) => candidate.id === candidateId) ?? null;
}

function buildFallbackCandidateDetail(
  candidate: PublicProfileSummary,
  campaigns: CandidateProfileDetail["campaigns"],
  officialPositions: CandidateProfileDetail["officialPositions"],
): CandidateProfileDetail {
  return {
    ...candidate,
    campaigns,
    officialPositions,
    recentPosts: [],
    campaignPromises: [],
    followerCount: candidate.followerCount ?? 0,
    followingCount: 0,
    viewerIsFollowing: Boolean(candidate.viewerIsFollowing),
    viewerCanFollow: Boolean(candidate.viewerCanFollow),
  };
}

function CandidateUnavailableState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[#101624] p-8 shadow-[0_28px_90px_-55px_rgba(15,23,42,0.95)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Candidate profile</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/candidates"
          className="inline-flex items-center rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Back to Candidates
        </Link>
        <Link
          href="/explore"
          className="inline-flex items-center rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/50 hover:bg-white/8"
        >
          Explore civic profiles
        </Link>
      </div>
    </section>
  );
}

function sourceTypeLabel(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function pendingKnowledgeCard(title: string, description: string) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function formatCampaignMoney(value: number | null | undefined, unavailableLabel = "Pending") {
  if (typeof value !== "number" || !Number.isFinite(value)) return unavailableLabel;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function CandidateVoterEssentials({
  candidate,
  bioSummary,
  bioSourceName,
  bioSourceUrl,
  campaignFinanceCard,
  issuePositions,
  issueSources,
}: {
  candidate: CandidateProfileDetail;
  bioSummary: string;
  bioSourceName: string | null;
  bioSourceUrl: string | null;
  campaignFinanceCard: CampaignFinanceSourceCardData;
  issuePositions: PublicIssuePositionSummary[];
  issueSources: Array<{ label: string; summary: string; sourceUrl: string; sourceName: string; sourceType: string }>;
}) {
  const funding = campaignFinanceCard.fundingBreakdown;
  const hasFinanceSource = Boolean(
    campaignFinanceCard.sourceUrl ||
      campaignFinanceCard.filingSummaries.length ||
      campaignFinanceCard.financeFilingCount ||
      campaignFinanceCard.financeDocumentCount ||
      funding?.hasDetailedContributions,
  );
  const raisedAmount = funding?.totalRaised ?? (funding?.hasDetailedContributions ? funding.totalContributions : null);
  const hasFinanceTotals = [raisedAmount, funding?.totalSpent, funding?.cashOnHand].some((value) => typeof value === "number" && Number.isFinite(value));
  const financeAvailabilityLabel = hasFinanceTotals
    ? "Reviewed totals available"
    : campaignFinanceCard.financeFilingCount || campaignFinanceCard.filingSummaries.length
      ? "Filing records available"
      : hasFinanceSource
        ? "Source link available"
        : "Source needed";
  const topIssuePositions = issuePositions.slice(0, 4);
  const topIssueSources = issueSources.slice(0, 6);

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Voter essentials</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Bio, money, and issue positions</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Review the most important source-backed facts before comparing candidates in this race.
          </p>
        </div>
        <Link href={`/claim-profile/${candidate.id}`} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100">
          Submit source or correction
        </Link>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bio</p>
            {bioSourceName ? (
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                Source-backed
              </span>
            ) : (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                Needs source review
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-200">{bioSummary}</p>
          {bioSourceUrl ? (
            <Link href={bioSourceUrl} className="mt-3 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
              Source: {bioSourceName ?? "View bio source"}
            </Link>
          ) : null}
        </article>

        <article className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Campaign finance</p>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
              {financeAvailabilityLabel}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Raised</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{formatCampaignMoney(raisedAmount)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Spent</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{formatCampaignMoney(funding?.totalSpent)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Cash</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                {formatCampaignMoney(funding?.cashOnHand, hasFinanceTotals ? "Not reported" : "Pending")}
              </p>
            </div>
          </div>
          {funding?.reportingPeriod ? (
            <p className="mt-3 text-xs font-semibold text-slate-500">Reporting period: {funding.reportingPeriod}</p>
          ) : null}
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {campaignFinanceCard.donorExtractionStatus}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {campaignFinanceCard.sourceUrl ? (
              <Link href={campaignFinanceCard.sourceUrl} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                Open finance source
              </Link>
            ) : null}
            {campaignFinanceCard.filingSummaries.slice(0, 2).map((filing) =>
              filing.url ? (
                <Link key={`${filing.name}-${filing.url}`} href={filing.url} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200">
                  {filing.name}
                </Link>
              ) : (
                <span key={`${filing.name}-${filing.filedAt ?? "pending"}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
                  {filing.name}
                </span>
              ),
            )}
            {!hasFinanceSource ? <span className="text-sm leading-6 text-slate-500">No source-backed filings are attached yet.</span> : null}
          </div>
        </article>
      </div>

      <article className="mt-4 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Issue positions</p>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
            {issuePositions.length} reviewed · {issueSources.length} source mention{issueSources.length === 1 ? "" : "s"}
          </span>
        </div>

        {topIssuePositions.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {topIssuePositions.map((position) => (
              <Link key={position.id} href={`/issues/${position.issueSlug}`} className="rounded-2xl border border-white/10 bg-black/15 p-4 transition hover:border-cyan-300/24">
                <p className="text-sm font-semibold text-cyan-100">{position.issueText}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{position.stance.replaceAll("_", " ")}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{position.summary ?? "Reviewed position source is available."}</p>
              </Link>
            ))}
          </div>
        ) : topIssueSources.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {topIssueSources.map((issue) => (
              <Link key={`${issue.label}-${issue.sourceUrl}`} href={issue.sourceUrl} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                {issue.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-white/12 bg-black/10 p-4 text-sm leading-6 text-slate-400">
            No approved, source-backed issue positions are attached yet.
          </p>
        )}
      </article>
    </section>
  );
}

function ImportedCandidateDetailPage({
  candidate,
  viewerRole,
  issuePositions,
  newsMentionCard,
  showNewsDiagnostics,
  campaignFinanceCard,
  raceContext,
  incumbentMatch,
  officialGovernmentEnrichment,
  officialSourceDocuments,
}: {
  candidate: CandidateProfileDetail;
  viewerRole?: UserRole;
  issuePositions: PublicIssuePositionSummary[];
  newsMentionCard: ProfileNewsMentionCardData;
  showNewsDiagnostics: boolean;
  campaignFinanceCard: CampaignFinanceSourceCardData;
  raceContext: CandidateRaceContext | null;
  incumbentMatch: IncumbentOfficialMatch | null;
  officialGovernmentEnrichment: ApprovedOfficialGovernmentEnrichment | null;
  officialSourceDocuments: OfficialSourceDocumentsCardData;
}) {
  const imported = candidate.importedCandidate;
  const campaign = candidate.campaigns[0];

  if (!imported || !campaign) {
    return (
      <CandidateUnavailableState
        title="Candidate record incomplete"
        description="This imported candidate record is missing the campaign metadata needed to render a profile."
      />
    );
  }

  const enrichment = imported.websiteEnrichment;
  const knowledge = imported.knowledgeEnrichments ?? [];
  const aboutSource = knowledge.find((entry) => entry.aboutSummary);
  const ownWordsSource = knowledge.find((entry) => entry.ownWordsSummary);
  const issueSources = knowledge.flatMap((entry) =>
    entry.issues.map((issue) => ({
      ...issue,
      sourceName: entry.sourceName,
      sourceType: entry.sourceType,
    })),
  );
  const experienceSource = knowledge.find((entry) => entry.experienceSummary);
  const financeSource = knowledge.find((entry) => entry.financeContext);
  const newsItems = knowledge.flatMap((entry) => entry.newsItems);
  const socialLinks = [...new Set([...knowledge.flatMap((entry) => entry.socialLinks), ...(enrichment?.socialLinks ?? [])])];
  const officeIntelligence = getOfficeIntelligence(imported.officeTitle ?? campaign.officeSought, candidate.jurisdictionName);
  const fallbackRaceContext: CandidateRaceContext = {
    candidateId: candidate.id,
    electionId: imported.electionId,
    electionTitle: imported.electionTitle,
    electionDate: imported.electionDate ?? null,
    officeTitle: imported.officeTitle ?? campaign.officeSought,
    jurisdictionName: candidate.jurisdictionName,
    districtName: imported.districtName ?? null,
    filingStatus: imported.filingStatus ?? imported.candidateStatus,
    partyText: candidate.partyText ?? null,
    isContested: false,
    sourceName: imported.sourceLabel ?? "Nevada SOS candidate filing source",
    sourceUrl: imported.sourceUrl ?? null,
    candidates: [
      {
        id: candidate.id,
        name: candidate.name,
        partyText: candidate.partyText ?? null,
        filingStatus: imported.filingStatus ?? imported.candidateStatus,
        isCurrent: true,
      },
    ],
    missingFields: [
      "Candidate bio",
      "Campaign website",
      "Candidate statement",
      "Issue priorities",
      "Campaign finance",
      "News mentions",
      "Social links",
    ],
    suggestedSearchQuery: `"${candidate.name}" ${imported.officeTitle ?? campaign.officeSought} Nevada`,
  };
  const activeRaceContext = raceContext ?? fallbackRaceContext;
  const lastKnowledgeUpdate = knowledge
    .map((entry) => entry.lastUpdatedAt)
    .sort()
    .at(-1);
  const maxConfidence = knowledge.length ? Math.max(...knowledge.map((entry) => entry.confidenceScore)) : null;
  const publicWebsiteUrl = enrichment?.campaignWebsiteUrl ?? enrichment?.officialWebsiteUrl ?? candidate.websiteUrl ?? null;
  const publicWebsiteLabel = enrichment?.campaignWebsiteUrl ? "Campaign website" : enrichment?.officialWebsiteUrl ? "Official website" : "Public website";
  const contactLabel = enrichment?.officialWebsiteUrl && !enrichment.campaignWebsiteUrl ? "Contact public office" : "Contact campaign";
  const contactHref = enrichment?.publicContactEmail ? `mailto:${enrichment.publicContactEmail}` : enrichment?.publicContactPhone ? `tel:${enrichment.publicContactPhone}` : null;
  const placeholderBio = `${candidate.name} is an imported Nevada candidate record`;
  const candidateBio = candidate.bio ?? "";
  const hasResolvedCandidateBio = Boolean(candidateBio) && !candidateBio.includes("Profile enrichment pending") && !candidateBio.startsWith(placeholderBio);
  const bioSummary =
    aboutSource?.aboutSummary ??
    ownWordsSource?.ownWordsSummary ??
    enrichment?.shortBio ??
    (hasResolvedCandidateBio ? candidateBio : null) ??
    "Bio source not found yet. Candidate filing details remain visible while source-backed enrichment is reviewed.";
  const bioSourceName = aboutSource?.sourceName ?? ownWordsSource?.sourceName ?? enrichment?.sourceName ?? (hasResolvedCandidateBio ? "Candidate filing statement" : null);
  const bioSourceUrl = aboutSource?.sourceUrl ?? ownWordsSource?.sourceUrl ?? enrichment?.longBioSourceUrl ?? enrichment?.sourceUrl ?? imported.sourceUrl ?? null;
  const sourceLinks = [
    publicWebsiteUrl ? { label: publicWebsiteLabel, href: publicWebsiteUrl } : null,
    imported.sourceUrl ? { label: imported.sourceLabel ?? "Official source", href: imported.sourceUrl } : null,
  ].filter((link): link is { label: string; href: string } => Boolean(link));
  const possibleSourceExplorerItems = [
    imported.sourceUrl
      ? {
          id: `${candidate.id}-filing-source`,
          sourceName: imported.sourceLabel ?? "Nevada SOS filing source",
          sourceType: "filing_record",
          sourceUrl: imported.sourceUrl,
          lastImportedAt: imported.filingDate ?? null,
          fieldsDerived: ["name", "office/race", "party", "filing status", "election"],
          reviewStatus: "imported",
          confidenceScore: 0.9,
          notes: "Core candidate filing details imported from stored election source data.",
        }
      : null,
    enrichment
      ? {
          id: `${candidate.id}-website-enrichment`,
          sourceName: enrichment.sourceName ?? "Campaign or official website",
          sourceType: enrichment.officialWebsiteUrl && !enrichment.campaignWebsiteUrl ? "official_website" : "campaign_website",
          sourceUrl: enrichment.sourceUrl,
          lastImportedAt: enrichment.lastEnrichedAt ?? null,
          fieldsDerived: [
            enrichment.shortBio ? "bio summary" : null,
            publicWebsiteUrl ? "website" : null,
            enrichment.publicContactEmail || enrichment.publicContactPhone ? "public contact" : null,
            enrichment.socialLinks.length ? "social links" : null,
          ].filter((field): field is string => Boolean(field)),
          reviewStatus: enrichment.reviewStatus,
          confidenceScore: maxConfidence ?? 0.5,
          notes: "Stored website enrichment is reviewed before public profile fields use it.",
        }
      : null,
    ...knowledge.map((entry) => ({
      id: entry.id,
      sourceName: entry.sourceName,
      sourceType: entry.sourceType,
      sourceUrl: entry.sourceUrl,
      lastImportedAt: entry.lastUpdatedAt,
      fieldsDerived: [
        entry.aboutSummary ? "about / bio" : null,
        entry.ownWordsSummary ? "candidate's own words" : null,
        entry.issues.length ? "issues / priorities" : null,
        entry.experienceSummary ? "experience" : null,
        entry.financeContext ? "finance context" : null,
        entry.newsItems.length ? "media coverage references" : null,
        entry.socialLinks.length ? "social links" : null,
      ].filter((field): field is string => Boolean(field)),
      reviewStatus: entry.reviewStatus,
      confidenceScore: entry.confidenceScore,
      notes: entry.title ?? "Candidate knowledge source stored for review.",
    })),
    ...issuePositions
      .filter((position) => position.sourceUrl || position.evidenceUrl)
      .slice(0, 6)
      .map((position) => ({
        id: `${position.id}-issue-source`,
        sourceName: position.sourceName ?? position.evidenceSourceName ?? "Issue position evidence",
        sourceType: "issue_position_evidence",
        sourceUrl: position.sourceUrl ?? position.evidenceUrl,
        lastImportedAt: position.lastObservedAt,
        fieldsDerived: ["issue position", position.issueText],
        reviewStatus: position.reviewStatus,
        confidenceScore: position.confidenceScore,
        notes: position.summary ?? position.evidenceTitle ?? "Sourced issue position evidence.",
      })),
    newsMentionCard.providerUsed || newsMentionCard.lastImportRun
      ? {
          id: `${candidate.id}-news-provider`,
          sourceName: newsMentionCard.providerUsed ?? "News ingestion provider",
          sourceType: "news_mentions",
          sourceUrl: null,
          lastImportedAt: newsMentionCard.lastImportRun?.startedAt ?? null,
          fieldsDerived: ["news mentions"],
          reviewStatus: newsMentionCard.verifiedCount ? "verified" : newsMentionCard.approvedCount ? "approved" : newsMentionCard.pendingCount ? "pending_review" : "imported",
          confidenceScore: null,
          notes: `${newsMentionCard.totalCount} stored mention${newsMentionCard.totalCount === 1 ? "" : "s"} linked to this profile.`,
        }
      : null,
    campaignFinanceCard.sourceUrl
      ? {
          id: `${candidate.id}-campaign-finance-source`,
          sourceName: campaignFinanceCard.sourceName ?? "Campaign finance source",
          sourceType: "campaign_finance",
          sourceUrl: campaignFinanceCard.sourceUrl,
          lastImportedAt: campaignFinanceCard.lastCheckedAt,
          fieldsDerived: [
            "campaign finance source link",
            campaignFinanceCard.filingSummaries.length ? "filing metadata" : null,
            campaignFinanceCard.campaignReportedSummary ? "campaign-reported finance context" : null,
          ].filter((field): field is string => Boolean(field)),
          reviewStatus: campaignFinanceCard.reviewStatus ?? "pending_review",
          confidenceScore: null,
          notes: `${campaignFinanceCard.filingCount} parsed filing${campaignFinanceCard.filingCount === 1 ? "" : "s"} stored. ${campaignFinanceCard.donorExtractionStatus}`,
        }
      : null,
    officialGovernmentEnrichment?.headshotUrl
      ? {
          id: `${candidate.id}-profile-image-source`,
          sourceName: officialGovernmentEnrichment.sourceName ?? "Official government source",
          sourceType: "profile_image",
          sourceUrl: officialGovernmentEnrichment.sourceUrl,
          lastImportedAt: officialGovernmentEnrichment.lastEnrichedAt,
          fieldsDerived: ["official headshot"],
          reviewStatus: officialGovernmentEnrichment.reviewStatus,
          confidenceScore: null,
          notes: "Profile image source is stored and reviewed before public display.",
        }
      : null,
  ];
  const sourceExplorerItems = possibleSourceExplorerItems.filter(Boolean) as SourceExplorerItem[];
  const completenessItems = [
    { label: "Office", value: imported.officeTitle ?? "Office needs review" },
    { label: "District", value: imported.districtName ?? "District not listed" },
    { label: "Profile", value: bioSourceName ? "Profile info present" : "Profile enrichment pending" },
    { label: "Source", value: imported.sourceUrl ? "Source verified" : "Source link pending" },
  ];

  return (
    <div className="space-y-6 py-8">
      <section className="dd-panel relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.1),transparent_30%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-300/18 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                Imported Nevada beta data
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                {candidate.partyText ?? "No party listed"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                {imported.candidateStatus}
              </span>
              {incumbentMatch ? (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  Incumbent
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{candidate.name}</h1>
            <p className="mt-3 text-sm text-slate-400">
              {imported.officeTitle ?? "Office needs review"} · {candidate.jurisdictionName}
              {" · "}
              {imported.districtName ?? "District not listed"}
            </p>
            {incumbentMatch ? (
              <p className="mt-3 text-sm leading-6 text-emerald-100">
                Current office: {incumbentMatch.officialOffice} · {incumbentMatch.officialJurisdiction}.
              </p>
            ) : null}
            <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300">
              {bioSummary}
            </p>
            {enrichment ? (
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-100">
                  Website enrichment {enrichment.reviewStatus.toLowerCase()}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                  Source: {enrichment.sourceName ?? publicWebsiteLabel}
                </span>
                {enrichment.lastEnrichedAt ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">
                    Enriched {formatDateUtc(enrichment.lastEnrichedAt, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <FavoriteToggleControl
                targetType="candidate"
                targetId={candidate.id}
                visibleLabel="Save"
                className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
              />
              <Link
                href={`/elections/${imported.electionId}`}
                className="dd-button-primary inline-flex rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
              >
                Related election
              </Link>
              {sourceLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            {candidate.profileImageUrl ? (
              <div className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.04]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={candidate.profileImageUrl} alt={`${candidate.name} profile headshot`} className="aspect-[4/3] w-full object-cover" />
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-[1.4rem] border border-dashed border-white/14 bg-white/[0.04] text-center">
                <div>
                  <p className="text-4xl font-semibold text-slate-200">{candidate.name.slice(0, 1)}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Headshot pending</p>
                </div>
              </div>
            )}
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Race / Office</p>
              <p className="mt-3 text-lg font-semibold text-slate-50">{campaign.officeSought}</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Election Date</p>
              <p className="mt-3 text-lg font-semibold text-slate-50">
                {formatDateUtc(imported.electionDate, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Filing Status</p>
              <p className="mt-3 text-lg font-semibold text-slate-50">{imported.filingStatus ?? imported.candidateStatus ?? "Profile enrichment pending"}</p>
            </div>
          </div>
        </div>
      </section>

      <CandidateVoterEssentials
        candidate={candidate}
        bioSummary={bioSummary}
        bioSourceName={bioSourceName}
        bioSourceUrl={bioSourceUrl}
        campaignFinanceCard={campaignFinanceCard}
        issuePositions={issuePositions}
        issueSources={issueSources}
      />

      <IssuePositionsSection
        positions={issuePositions}
        emptyTitle="Issue positions pending"
        emptyDescription="No approved, sourced candidate issue positions are available for this imported record yet."
        correctionHref={`/claim-profile/${candidate.id}`}
      />

      <CampaignFinanceSourceCard data={campaignFinanceCard} />

      <CandidateRaceContextCard context={activeRaceContext} />

      <OfficeIntelligenceCard intelligence={officeIntelligence} />

      <OfficialGovernmentSourceCard
        enrichment={officialGovernmentEnrichment}
        incumbentMatch={incumbentMatch}
        emptyTitle={incumbentMatch ? "Official government source pending review" : "Incumbent official match pending"}
      />

      <NewsMentionsSection cardData={newsMentionCard} showAdminDiagnostics={showNewsDiagnostics} />

      <OfficialSourceDocumentsCard data={officialSourceDocuments} />

      <MissingCandidateInfoCard
        candidateId={candidate.id}
        missingFields={activeRaceContext.missingFields}
        suggestedSearchQuery={activeRaceContext.suggestedSearchQuery}
      />

      <SourceExplorer items={sourceExplorerItems} emptyText="Candidate source records are pending review." />

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Candidate knowledge</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">What voters can verify from sources</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Only approved or verified enrichment appears here. Candidate-provided content and media coverage are labeled separately.
            </p>
          </div>
          {viewerRole === "admin" ? (
            <form action={addCandidateKnowledgeSourceAction} className="grid min-w-72 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <input name="sourceUrl" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-100" placeholder="Add source URL" />
              <button className="dd-button-secondary rounded-xl px-3 py-2 text-xs font-semibold" type="submit">
                Add source URL
              </button>
            </form>
          ) : null}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {aboutSource?.aboutSummary ? (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">About / bio summary</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">{aboutSource.aboutSummary}</p>
              <Link href={aboutSource.sourceUrl} className="mt-3 block break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Source: {aboutSource.sourceName}
              </Link>
            </div>
          ) : (
            pendingKnowledgeCard("About / bio summary", "Bio source not found yet.")
          )}

          {ownWordsSource?.ownWordsSummary ? (
            <div className="rounded-[1.35rem] border border-emerald-300/18 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">From campaign/candidate source</p>
              <p className="mt-3 text-sm leading-7 text-slate-100">{ownWordsSource.ownWordsSummary}</p>
              <Link href={ownWordsSource.sourceUrl} className="mt-3 block break-all text-xs font-semibold text-emerald-100 hover:text-white">
                Source: {ownWordsSource.sourceName}
              </Link>
            </div>
          ) : (
            pendingKnowledgeCard("Candidate's own words", "Candidate-provided source not found yet.")
          )}

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Issues / priorities</p>
            {issueSources.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {issueSources.map((issue) => (
                  <Link key={`${issue.label}-${issue.sourceUrl}`} href={issue.sourceUrl} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                    {issue.label}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-400">Issue source not found yet.</p>
            )}
          </div>

          {experienceSource?.experienceSummary ? (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Experience / background</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">{experienceSource.experienceSummary}</p>
              <Link href={experienceSource.sourceUrl} className="mt-3 block break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Source: {experienceSource.sourceName}
              </Link>
            </div>
          ) : (
            pendingKnowledgeCard("Experience / background", "Experience source not found yet.")
          )}

          {financeSource?.financeContext ? (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Campaign finance/context</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">{financeSource.financeContext}</p>
              <Link href={financeSource.sourceUrl} className="mt-3 block break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                Source: {financeSource.sourceName}
              </Link>
            </div>
          ) : (
            pendingKnowledgeCard("Campaign finance/context", "Campaign finance context not imported yet.")
          )}

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Public profiles / social links</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {publicWebsiteUrl ? (
                <Link href={publicWebsiteUrl} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100">
                  {publicWebsiteLabel}
                </Link>
              ) : null}
              {socialLinks.map((url) => (
                <Link key={url} href={url} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100">
                  {new URL(url).hostname.replace(/^www\./, "")}
                </Link>
              ))}
              {!publicWebsiteUrl && !socialLinks.length ? <p className="text-sm leading-6 text-slate-400">Public profile or social source not found yet.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Media coverage</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">In the news</h2>
        {newsItems.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {newsItems.map((item) => (
              <Link key={`${item.title}-${item.sourceUrl}`} href={item.sourceUrl} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
                <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Media coverage - {item.sourceName}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.summary}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
            News source not found yet.
          </div>
        )}
      </section>

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Take action</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Ways to use this profile</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Follow candidate</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Following opens after this imported record is linked to a claimed profile.</p>
          </div>
          {contactHref ? (
            <Link href={contactHref} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
            <p className="text-sm font-semibold text-slate-100">{contactLabel}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">Uses only stored public contact information.</p>
            </Link>
          ) : (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-slate-100">Contact campaign</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">Public contact pending.</p>
            </div>
          )}
          <Link href={`/elections/${imported.electionId}`} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
            <p className="text-sm font-semibold text-slate-100">View related election</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{imported.electionTitle}</p>
          </Link>
          <Link href={`/elections/${imported.electionId}#candidates`} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
            <p className="text-sm font-semibold text-slate-100">Compare candidates</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Open the race context for this office.</p>
          </Link>
          <Link href={`/claim-profile/${candidate.id}`} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
            <p className="text-sm font-semibold text-slate-100">Submit correction / claim</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Start the profile claim and review path.</p>
          </Link>
          <Link href={`/who-represents-me?community=${encodeURIComponent(candidate.jurisdictionName)}`} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
            <p className="text-sm font-semibold text-slate-100">Check my districts</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">See whether this race matches your stored district assignments.</p>
          </Link>
        </div>
      </section>

      {enrichment ? (
        <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Website source enrichment</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Reviewed public profile data</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                This information is summarized from a public campaign or official website and remains separate from the Nevada SOS filing record.
              </p>
            </div>
            {publicWebsiteUrl ? (
              <Link href={publicWebsiteUrl} className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold">
                Open {publicWebsiteLabel.toLowerCase()}
              </Link>
            ) : null}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {enrichment.shortBio ? (
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Bio summary</p>
                <p className="mt-3 text-sm leading-7 text-slate-200">{enrichment.shortBio}</p>
              </div>
            ) : null}
            {enrichment.publicContactEmail || enrichment.publicContactPhone ? (
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Public contact</p>
                {enrichment.publicContactEmail ? <p className="mt-3 text-sm font-semibold text-slate-100">{enrichment.publicContactEmail}</p> : null}
                {enrichment.publicContactPhone ? <p className="mt-2 text-sm font-semibold text-slate-100">{enrichment.publicContactPhone}</p> : null}
              </div>
            ) : null}
            {enrichment.socialLinks.length ? (
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Social links</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {enrichment.socialLinks.map((url) => (
                    <Link key={url} href={url} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100">
                      {new URL(url).hostname.replace(/^www\./, "")}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Enrichment source</p>
              <Link href={enrichment.sourceUrl} className="mt-3 block break-all text-sm font-semibold text-cyan-100 hover:text-cyan-50">
                {enrichment.sourceName ?? enrichment.sourceUrl}
              </Link>
              {enrichment.longBioSourceUrl ? (
                <Link href={enrichment.longBioSourceUrl} className="mt-2 block break-all text-xs text-slate-400 hover:text-slate-200">
                  Bio source: {enrichment.longBioSourceUrl}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Bio / enrichment</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Bio source not found yet</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Candidate filing record imported. This page is rendering stored Nevada candidate data only. Know an official source? Submit a correction/source.
          </p>
          <Link href={`/claim-profile/${candidate.id}`} className="mt-4 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100">
            Submit correction / source
          </Link>
        </section>
      )}

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Source attribution</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Nevada filing source</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{imported.sourceLabel ?? "Nevada SOS filing source"}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Public website source</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{publicWebsiteUrl ? "Stored website available" : "Website pending"}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last updated</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">
              {lastKnowledgeUpdate
                ? formatDateUtc(lastKnowledgeUpdate, { month: "short", day: "numeric", year: "numeric" })
                : enrichment?.lastEnrichedAt
                  ? formatDateUtc(enrichment.lastEnrichedAt, { month: "short", day: "numeric", year: "numeric" })
                  : "Import timestamp pending"}
            </p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verification</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">
              {knowledge.length ? `Knowledge ${knowledge[0].reviewStatus.toLowerCase()}` : imported.sourceUrl ? "Source-attributed imported record" : "Source attribution pending"}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Data confidence</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{maxConfidence === null ? "Knowledge confidence pending" : `${Math.round(maxConfidence * 100)}% reviewed-source confidence`}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Approved sources</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {knowledge.length ? (
                knowledge.map((entry) => (
                  <Link key={entry.id} href={entry.sourceUrl} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100">
                    {sourceTypeLabel(entry.sourceType)}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-400">Source attribution pending review.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Imported candidate record</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {completenessItems.map((item) => (
            <div key={item.label} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
              <p className="mt-3 text-sm font-semibold text-slate-100">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Related race</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{imported.electionTitle}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {campaign.officeSought} · {candidate.jurisdictionName}
            </p>
          </div>
          <Link href={`/elections/${imported.electionId}`} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
            Open election
          </Link>
        </div>
      </section>

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Data completeness</h2>
        {imported.dataWarnings.length ? (
          <div className="mt-5 grid gap-3">
            {imported.dataWarnings.map((warning) => (
              <div key={warning} className="rounded-2xl border border-amber-300/18 bg-amber-500/10 p-4 text-sm font-semibold text-amber-100">
                {warning}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-emerald-300/18 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-100">
            Core imported fields are present.
          </div>
        )}
      </section>
    </div>
  );
}

export default async function CandidateDetailPage({ params, searchParams }: CandidateDetailPageProps) {
  const { candidateId } = await params;
  const [viewer, sessionUser, comparisonUser, resolvedSearchParams, candidateSummary, candidateDetail, fallbackCampaigns, fallbackPositions, issuePositions] = await Promise.all([
    withSectionTimeout(getCurrentFeedViewer(), "candidate viewer", 1200).catch((error) => {
      console.error(`[candidate-detail] viewer fallback for ${candidateId}`, error);
      return getDefaultSeedUser();
    }),
    withSectionTimeout(getCurrentSessionUser(), "candidate session user", 1200).catch((error) => {
      console.error(`[candidate-detail] session user fallback for ${candidateId}`, error);
      return null;
    }),
    withSectionTimeout(getCurrentUser(), "candidate comparison user", 1200).catch((error) => {
      console.error(`[candidate-detail] comparison user fallback for ${candidateId}`, error);
      return getDefaultSeedUser();
    }),
    searchParams ? searchParams : Promise.resolve(undefined),
    getCandidateSummaryById(candidateId).catch((error) => {
      console.error(`[candidate-detail] summary fallback for ${candidateId}`, error);
      return null;
    }),
    getCandidateProfileById(candidateId).catch((error) => {
      console.error(`[candidate-detail] detail fallback for ${candidateId}`, error);
      return null;
    }),
    getAllCandidateCampaigns()
      .then((campaigns) => campaigns.filter((campaign) => campaign.publicProfileId === candidateId))
      .catch((error) => {
        console.error(`[candidate-detail] fallback campaigns failed for ${candidateId}`, error);
        return [];
      }),
    getAllOfficialPositions()
      .then((positions) => positions.filter((position) => position.publicProfileId === candidateId))
      .catch((error) => {
        console.error(`[candidate-detail] fallback positions failed for ${candidateId}`, error);
        return [];
      }),
    getCandidateIssuePositions(candidateId).catch((error) => {
      console.error(`[candidate-detail] issue positions failed for ${candidateId}`, error);
      return [];
    }),
  ]);

  if (!candidateSummary && !candidateDetail) {
    return (
      <div className="space-y-6 py-8">
        <CandidateUnavailableState
          title="Candidate not found"
          description="This candidate profile may have moved or is not available yet."
        />
      </div>
    );
  }

  const candidate =
    candidateDetail ??
    buildFallbackCandidateDetail(
      candidateSummary!,
      fallbackCampaigns,
      fallbackPositions,
    );
  const showNewsDiagnostics = process.env.NODE_ENV !== "production" || sessionUser?.role === "admin";
  const newsMentionCard = await getProfileNewsMentionCard(NewsMentionTargetType.CANDIDATE, candidateId, { includePending: showNewsDiagnostics }).catch((error) => {
    console.error(`[candidate-detail] news mentions failed for ${candidateId}`, error);
    return {
      mentions: [],
      totalCount: 0,
      approvedCount: 0,
      verifiedCount: 0,
      pendingCount: 0,
      providerUsed: null,
      lastImportRun: null,
    };
  });
  const campaignFinanceCard = await getCampaignFinanceSourceCard("candidate", candidateId).catch((error) => {
    console.error(`[candidate-detail] campaign finance source failed for ${candidateId}`, error);
    return {
      sourceName: null,
      sourceUrl: null,
      filingStatus: null,
      reviewStatus: null,
      lastCheckedAt: null,
      filingCount: 0,
      filingSummaries: [],
      sourceLinks: [],
      financeSourceCount: 0,
      financeFilingCount: 0,
      financeDocumentCount: 0,
      pendingCount: 0,
      approvedCount: 0,
      fundingBreakdown: null,
      cycleHistory: [],
      allReportedTotals: null,
      campaignReportedSummary: null,
      donorExtractionStatus: "Classification incomplete; source-backed filing summaries remain available.",
    };
  });
  const officialSourceDocuments = await getOfficialSourceDocumentsForProfile(
    candidate.name,
    candidate.campaigns[0]?.officeSought ?? candidate.importedCandidate?.officeTitle ?? null,
  ).catch((error) => {
    console.error(`[candidate-detail] official source documents failed for ${candidateId}`, error);
    const campaignFinanceDashboard = createEmptyCampaignFinanceDashboard();
    return {
      documents: [],
      candidateRecords: [],
      campaignFinanceRecords: [],
      campaignFinanceSummary: campaignFinanceDashboard.summary,
      campaignFinanceDashboard,
      lastFetchedAt: null,
      blockedCount: 0,
      blockedImportUrlCount: 0,
      unmatchedImportRecordCount: 0,
      sourceLinks: [],
    };
  });
  const raceContext = candidate.isImported
    ? await getCandidateRaceContext(candidateId).catch((error) => {
        console.error(`[candidate-detail] race context failed for ${candidateId}`, error);
        return null;
      })
    : null;
  const incumbentMatch = candidate.isImported
    ? await findIncumbentOfficialMatch(candidateId).catch((error) => {
        console.error(`[candidate-detail] incumbent official match failed for ${candidateId}`, error);
        return null;
      })
    : null;
  const officialGovernmentEnrichment = candidate.isImported
    ? await getApprovedOfficialGovernmentEnrichment("CANDIDATE", candidateId).catch((error) => {
        console.error(`[candidate-detail] official government enrichment failed for ${candidateId}`, error);
        return null;
      })
    : null;

  if (candidate.isImported) {
    return (
      <ImportedCandidateDetailPage
        candidate={candidate}
        viewerRole={sessionUser?.role}
        issuePositions={issuePositions}
        newsMentionCard={newsMentionCard}
        showNewsDiagnostics={showNewsDiagnostics}
        campaignFinanceCard={campaignFinanceCard}
        raceContext={raceContext}
        incumbentMatch={incumbentMatch}
        officialGovernmentEnrichment={officialGovernmentEnrichment}
        officialSourceDocuments={officialSourceDocuments}
      />
    );
  }

  let social: Awaited<ReturnType<typeof getLightweightFollowState>> | null = null;

  if (candidate.claimedByUserId) {
    try {
      social = await getLightweightFollowState(viewer.id, candidate.claimedByUserId, candidate.followerCount);
    } catch (error) {
      console.error(`[candidate-detail] lightweight follow state failed for ${candidate.id}`, error);
    }
  }

  const hydratedCandidate = social
    ? {
        ...candidate,
        followerCount: social.followerCount,
        followingCount: social.followingCount,
        viewerIsFollowing: social.viewerIsFollowing,
        viewerCanFollow: social.viewerCanFollow,
      }
    : {
        ...candidate,
      };
  const leadCampaign = hydratedCandidate.campaigns[0];
  const progression = hydratedCandidate.claimedByUserId ? getSafeUserProgressionSummary("candidate") : null;
  const externalLinks = hydratedCandidate.claimedByUserId
    ? await getUserProfileContent(hydratedCandidate.claimedByUserId)
        .then((content) => mergeExternalLinksWithWebsite(content.externalLinks, leadCampaign?.websiteUrl ?? hydratedCandidate.websiteUrl))
        .catch((error) => {
          console.error(`[candidate-detail] external links fallback for ${hydratedCandidate.id}`, error);
          return mergeExternalLinksWithWebsite([], leadCampaign?.websiteUrl ?? hydratedCandidate.websiteUrl);
        })
    : mergeExternalLinksWithWebsite([], leadCampaign?.websiteUrl ?? hydratedCandidate.websiteUrl);
  let claimMatch: Awaited<ReturnType<typeof getClaimMatchForProfile>> | null = null;

  if (!hydratedCandidate.isClaimed) {
    try {
      claimMatch = await getClaimMatchForProfile(hydratedCandidate.id, sessionUser, await getOnboardingDraft());
    } catch (error) {
      console.error(`[candidate-detail] claim match failed for ${hydratedCandidate.id}`, error);
    }
  }

  const claimAction = getClaimActionStateForViewer(sessionUser, claimMatch);
  const fallbackSignals: ProfileSignalsSummary = {
    ideologicalLeaning: {
      label: "Center" as const,
      summary: "Ideological leaning is temporarily unavailable.",
    },
    civicCredibility: {
      label: "Still Forming" as const,
      summary: "Public Reliability is temporarily unavailable.",
    },
    truthRecord: {
      label: "Limited Ratings" as const,
      summary: "Truth record is temporarily unavailable.",
    },
    transparencyNote: "Profile signals are temporarily unavailable.",
  };
  let signals = fallbackSignals;

  try {
    signals = buildCandidateProfileSignals(hydratedCandidate, EMPTY_INTERVIEWS_SUMMARY, null);
  } catch (error) {
    console.error(`[candidate-detail] profile signals failed for ${hydratedCandidate.id}`, error);
  }

  const showMessageButton =
    Boolean(hydratedCandidate.claimedByUserId) &&
    hydratedCandidate.claimedByUserId !== viewer.id &&
    (viewer.role === "citizen" || viewer.role === "trustedCitizen");
  const candidateMatch = leadCampaign
    ? await getCandidateMatchSummary(comparisonUser, hydratedCandidate, leadCampaign).catch((error) => {
        console.error(`[candidate-detail] candidate match failed for ${hydratedCandidate.id}`, error);
        return null;
      })
    : null;
  const sentimentSummary = await getProfileSentimentSummary(comparisonUser, hydratedCandidate.id).catch((error) => {
    console.error(`[candidate-detail] sentiment tracker failed for ${hydratedCandidate.id}`, error);
    return null;
  });
  const candidateViewerAlignment = candidateMatch ? getCandidateViewerAlignmentSummary(candidateMatch) : null;
  const candidateBriefBullets = [
    leadCampaign ? `${leadCampaign.officeSought} in ${leadCampaign.jurisdictionName} is the clearest active race on this profile.` : null,
    hydratedCandidate.campaignPromises[0] ? `Public Reliability is most clearly being shaped by ${hydratedCandidate.campaignPromises[0].category}.` : null,
    hydratedCandidate.recentPosts[0]
      ? `${hydratedCandidate.recentPosts.length} recent platform post${hydratedCandidate.recentPosts.length === 1 ? "" : "s"} are already visible here.`
      : "No recent platform posts are visible yet, so campaign promises remain the clearest signal.",
  ].filter((value): value is string => Boolean(value));
  const candidateBriefSummary = `${hydratedCandidate.name}'s page is most useful as a quick campaign read: ${leadCampaign ? `${leadCampaign.campaignStatus.toLowerCase()} activity is centered on ${leadCampaign.officeSought.toLowerCase()} in ${leadCampaign.jurisdictionName}. ` : ""}${hydratedCandidate.campaignPromises.length ? `Public Reliability pulls campaign promises, platform commitments, endorsements, and visible activity into one accountability read, while polls and posts add extra context when you want more detail.` : `This profile is still light on structured promises, so the best next step is to scan the campaign and endorsement sections below.`}`;
  const relatedAds = getPoliticalAdsForEntity("candidate", hydratedCandidate.id, 4);

  return (
    <div className="space-y-6 py-8">
      {resolvedSearchParams?.promises === "updated" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Campaign promises were updated.
        </section>
      ) : null}
      {resolvedSearchParams?.endorsement === "saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your citizen endorsement was saved.
        </section>
      ) : null}
      {resolvedSearchParams?.endorsement === "removed" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your citizen endorsement was removed.
        </section>
      ) : null}
      {resolvedSearchParams?.endorsement === "not-allowed" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Only verified citizens and trusted citizens can endorse candidates.
        </section>
      ) : null}
      {resolvedSearchParams?.pollPromotion ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {resolvedSearchParams.pollPromotion === "petition" && "This poll was converted into a petition."}
          {resolvedSearchParams.pollPromotion === "system-vote" && "This poll was promoted into a formal vote."}
        </section>
      ) : null}
      {resolvedSearchParams?.pollPromotionError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {resolvedSearchParams.pollPromotionError === "permissions" && "Only trusted citizens can promote a poll into a petition or formal vote."}
          {resolvedSearchParams.pollPromotionError === "threshold" && "This poll needs more engagement before it can be promoted."}
          {resolvedSearchParams.pollPromotionError === "confirm" && "Please confirm the conversion before promoting the poll."}
          {resolvedSearchParams.pollPromotionError === "duplicate-vote" && "A similar formal vote already exists for this jurisdiction."}
        </section>
      ) : null}
      <CandidateProfileHero
        candidate={hydratedCandidate}
        returnPath={`/candidates/${candidate.id}`}
        progression={progression}
        showMessageButton={showMessageButton}
        signals={signals}
        showClaimButton={!hydratedCandidate.isClaimed && claimAction.state !== "hidden"}
        claimButtonLabel={claimAction.label}
        guestMode={isGuestUserId(viewer.id)}
        externalLinks={externalLinks}
      />
      <SummaryBriefPanel
        eyebrow="Candidate Brief"
        title={`What stands out about ${hydratedCandidate.name}`}
        summary={candidateBriefSummary}
        bullets={candidateBriefBullets}
        signalChips={[
          leadCampaign ? `${leadCampaign.campaignStatus} campaign` : "Campaign context forming",
          `${hydratedCandidate.campaignPromises.length} promise${hydratedCandidate.campaignPromises.length === 1 ? "" : "s"}`,
          `${hydratedCandidate.recentPosts.length} recent post${hydratedCandidate.recentPosts.length === 1 ? "" : "s"}`,
        ]}
        actionLabel={hydratedCandidate.campaignPromises.length ? "Review promises" : hydratedCandidate.campaigns.length ? "Open campaigns" : undefined}
        actionHref={hydratedCandidate.campaignPromises.length ? "#candidate-promises" : hydratedCandidate.campaigns.length ? "#candidate-campaigns" : undefined}
        actionLinks={[
          ...(hydratedCandidate.campaigns.length ? [{ label: "Open campaigns", href: "#candidate-campaigns" }] : []),
          ...(hydratedCandidate.campaignPromises.length ? [{ label: "Review promises", href: "#candidate-promises" }] : []),
        ]}
      />
      <PoliticalAdsSection
        title="Political ads about this candidate"
        description="See ads by this campaign, supportive groups, opposition groups, and outside spenders. System ratings and trusted citizen ratings stay separate."
        ads={relatedAds}
        repositoryHref={`/ads?candidateId=${encodeURIComponent(hydratedCandidate.id)}`}
        emptyText="No political ads are attached to this candidate yet."
      />

      {sentimentSummary ? (
        <ProfileSentimentTracker
          title={`Weekly public vote on ${hydratedCandidate.name}`}
          summary={sentimentSummary}
          returnPath={`/candidates/${candidate.id}`}
          canVote={canUserVote(comparisonUser)}
        />
      ) : (
        <ProfileSectionFallback title="Public sentiment" description="No sentiment history yet." />
      )}

      {candidateViewerAlignment ? (
        <ProfileViewerAlignmentCard
          eyebrow="Your alignment"
          title={`How ${hydratedCandidate.name} compares with you`}
          summary={candidateViewerAlignment.summary}
          description={candidateViewerAlignment.description}
          alignedCount={candidateViewerAlignment.alignedCount}
          againstCount={candidateViewerAlignment.againstCount}
          mixedCount={candidateViewerAlignment.mixedCount}
          sparse={candidateViewerAlignment.sparse}
        />
      ) : null}

      <IssuePositionsSection
        positions={issuePositions}
        emptyTitle="Issue positions pending"
        emptyDescription="No approved, sourced candidate issue positions are available for this profile yet."
        correctionHref={`/claim-profile/${candidate.id}`}
      />

      <NewsMentionsSection cardData={newsMentionCard} showAdminDiagnostics={showNewsDiagnostics} />

      <Suspense fallback={<ProfileSectionFallback title="Campaigns" description="Loading campaign preview..." />}>
        <CandidateCampaignsSection candidateId={candidate.id} viewerId={viewer.id} viewerRole={viewer.role} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Official positions" description="Loading public office history..." />}>
        <CandidateOfficialPositionsSection candidateId={candidate.id} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Promises" description="Loading public promises..." />}>
        <CandidatePromisesSectionLoader candidateId={candidate.id} viewerId={viewer.id} viewerRole={viewer.role} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Interviews" description="Loading interview summary..." />}>
        <CandidateInterviewsSection candidateId={candidate.id} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Recent polls" description="Loading structured questions..." />}>
        <CandidateRecentPollsSection candidateId={candidate.id} viewerId={viewer.id} viewerRole={viewer.role} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Perspectives and campaign updates" description="Loading recent civic briefs..." />}>
        <CandidateRecentPostsSection candidateId={candidate.id} viewerId={viewer.id} viewerRole={viewer.role} />
      </Suspense>
    </div>
  );
}

const EMPTY_INTERVIEWS_SUMMARY: PublicProfileInterviewsSummary = {
  requested: [],
  accepted: [],
  completed: [],
  declined: [],
  noResponse: [],
  responsiveness: {
    acceptedCount: 0,
    completedCount: 0,
    declinedCount: 0,
    noResponseCount: 0,
    signalLabel: null,
    signalDescription: "Interview responsiveness is still loading.",
  },
};

function ProfileSectionFallback({ title, description }: { title: string; description: string }) {
  return (
    <section id="candidate-campaigns" className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </section>
  );
}

async function CandidateCampaignsSection({
  candidateId,
  viewerId,
  viewerRole,
}: {
  candidateId: string;
  viewerId: string;
  viewerRole: UserRole;
}) {
  const candidate = await withSectionTimeout(getCandidateProfileById(candidateId), "candidate campaigns detail", 1500).catch((error) => {
    console.error(`[candidate-detail] campaigns fallback for ${candidateId}`, error);
    return null;
  });

  if (!candidate) {
    return <ProfileSectionFallback title="Campaigns" description="Campaign information is unavailable right now." />;
  }

  const campaignsWithEndorsements = await withSectionTimeout(
    attachEndorsementsToCampaigns(candidate.campaigns, viewerId),
    "candidate campaign endorsements",
    1500,
  ).catch((error) => {
    console.error(`[candidate-detail] campaign endorsements fallback for ${candidateId}`, error);
    return candidate.campaigns;
  });
  const viewer = getSeedUserById(viewerId) ?? getDefaultSeedUser();
  const organizationEndorsementsByCampaign = new Map(
    await Promise.all(
      campaignsWithEndorsements.map(async (campaign) => [campaign.id, await getOrganizationEndorsementsForCampaign(campaign.id)] as const),
    ),
  );

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Campaigns</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {campaignsWithEndorsements.map((campaign) => (
          <div key={campaign.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">{campaign.campaignStatus}</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-50">{campaign.officeSought}</h3>
            <p className="mt-2 text-sm text-slate-400">
              {campaign.jurisdictionName}
              {campaign.electionTitle ? ` · ${campaign.electionTitle}` : ""}
            </p>
            <p className="mt-4 text-sm text-slate-300">Raised: {campaign.totalRaised ?? "TBD"}</p>
            <p className="mt-2 text-sm text-slate-300">
              Top donor categories: {campaign.topDonorCategories?.join(" · ") ?? "Not listed"}
            </p>
            <div className="mt-4">
              <CandidateEndorsementsPanel
                campaign={campaign}
                returnPath={`/candidates/${candidate.id}`}
                viewer={{ ...viewer, role: viewerRole }}
              />
            </div>
            {organizationEndorsementsByCampaign.get(campaign.id)?.length ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Organization endorsements</p>
                <div className="mt-3 space-y-3">
                  {organizationEndorsementsByCampaign.get(campaign.id)?.map((endorsement) => (
                    <div key={endorsement.id} className="rounded-2xl border border-white/8 bg-white/[0.04] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/organizations/${endorsement.organizationId}`} className="text-sm font-semibold text-slate-100 hover:text-cyan-200">
                          {endorsement.organizationName}
                        </Link>
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                          {getOrganizationTypeLabel(endorsement.organizationType)} Endorsement
                        </span>
                      </div>
                      {endorsement.statement ? <p className="mt-2 text-sm text-slate-400">{endorsement.statement}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

async function CandidateOfficialPositionsSection({ candidateId }: { candidateId: string }) {
  const candidate = await withSectionTimeout(getCandidateProfileById(candidateId), "candidate official positions", 1500).catch((error) => {
    console.error(`[candidate-detail] official positions fallback for ${candidateId}`, error);
    return null;
  });

  if (!candidate?.officialPositions.length) {
    return null;
  }

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Official positions</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {candidate.officialPositions.map((position) => (
          <div key={position.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-200">
              {position.isCurrent ? "Current office" : "Past office"}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-50">{position.officeTitle}</h3>
            <p className="mt-2 text-sm text-slate-400">{position.jurisdictionName}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

async function CandidatePromisesSectionLoader({
  candidateId,
  viewerId,
  viewerRole,
}: {
  candidateId: string;
  viewerId: string;
  viewerRole: UserRole;
}) {
  const candidate = await withSectionTimeout(getCandidateProfileById(candidateId), "candidate promises detail", 1500).catch((error) => {
    console.error(`[candidate-detail] promises fallback for ${candidateId}`, error);
    return null;
  });

  if (!candidate) {
    return <ProfileSectionFallback title="Promises" description="Public promises are unavailable right now." />;
  }

  const canEdit = viewerRole === "admin" || (candidate.claimedByUserId && candidate.claimedByUserId === viewerId);

  return (
    <div id="candidate-promises">
      <CandidatePromisesSection candidateId={candidate.id} promises={candidate.campaignPromises} canEdit={Boolean(canEdit)} />
    </div>
  );
}

async function CandidateInterviewsSection({ candidateId }: { candidateId: string }) {
  const interviews = await withSectionTimeout(getInterviewRequestsForPublicProfile(candidateId), "candidate interviews", 1500).catch((error) => {
    console.error(`[candidate-detail] interviews fallback for ${candidateId}`, error);
    return EMPTY_INTERVIEWS_SUMMARY;
  });
  return <ProfileInterviewsSection interviews={interviews} />;
}

async function CandidateRecentPollsSection({
  candidateId,
  viewerId,
  viewerRole,
}: {
  candidateId: string;
  viewerId: string;
  viewerRole: UserRole;
}) {
  const candidate = await withSectionTimeout(getCandidateProfileById(candidateId), "candidate polls detail", 1500).catch((error) => {
    console.error(`[candidate-detail] recent polls detail fallback for ${candidateId}`, error);
    return null;
  });

  if (!candidate) {
    return <ProfileSectionFallback title="Recent polls" description="Recent poll context is unavailable right now." />;
  }

  const recentPolls = candidate.claimedByUserId
    ? await withSectionTimeout(getPollsByCreator(candidate.claimedByUserId, viewerId, 3), "candidate recent polls", 1500).catch((error) => {
        console.error(`[candidate-detail] recent polls fallback for ${candidateId}`, error);
        return [];
      })
    : [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Recent polls</h2>
        <p className="mt-2 text-sm text-slate-600">Structured questions this candidate has put in front of the community.</p>
      </div>
      <div className="grid gap-4">
        {recentPolls.length ? (
          recentPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} returnPath={`/candidates/${candidate.id}`} viewerRole={viewerRole} />
          ))
        ) : (
            <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400 shadow-card">
              {candidate.isClaimed
                ? "No citizen polls yet for this candidate."
                : "This profile is unclaimed, so citizen polls will only appear after a future claim flow links it to a platform account."}
          </div>
        )}
      </div>
    </section>
  );
}

async function CandidateRecentPostsSection({
  candidateId,
  viewerId,
  viewerRole,
}: {
  candidateId: string;
  viewerId: string;
  viewerRole: UserRole;
}) {
  const candidate = await withSectionTimeout(getCandidateProfileById(candidateId), "candidate posts profile", 1200).catch((error) => {
    console.error(`[candidate-detail] recent posts profile fallback for ${candidateId}`, error);
    return null;
  });

  if (!candidate) {
    return <ProfileSectionFallback title="Perspectives and campaign updates" description="Recent civic briefs are unavailable right now." />;
  }

  const contextualPosts = candidate.claimedByUserId
    ? await withSectionTimeout(getContextualPostPreviews({ limit: 24 }), "candidate recent posts", 1200)
        .then((posts) => posts.filter((post) => post.authorId === candidate.claimedByUserId).slice(0, 3))
        .catch((error) => {
          console.error(`[candidate-detail] recent posts fallback for ${candidateId}`, error);
          return candidate.recentPosts ?? [];
        })
    : candidate.recentPosts;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Perspectives and campaign updates</h2>
        <p className="mt-2 text-sm text-slate-600">
          Claimed candidates can publish contextual statements, updates, and explanations tied to elections, issues, and public decisions.
        </p>
      </div>
      <div className="space-y-4">
        {contextualPosts.length ? (
          contextualPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              viewerRole={viewerRole}
              viewerUserId={viewerId}
              returnPath={`/candidates/${candidate.id}`}
            />
          ))
        ) : (
            <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400 shadow-card">
              {candidate.isClaimed
                ? "No visible perspectives yet for this candidate."
                : "This profile is unclaimed, so posting will only appear after a future claim flow links it to a platform account."}
          </div>
        )}
      </div>
    </section>
  );
}
