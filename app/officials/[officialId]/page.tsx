import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DraftLegislationCard } from "@/components/domain/draft-legislation-card";
import { CampaignFinanceSourceCard } from "@/components/domain/campaign-finance-source-card";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { FundingBreakdownCard } from "@/components/domain/funding-breakdown-card";
import { IssuePositionsSection } from "@/components/domain/issue-positions-section";
import { NewsMentionsSection } from "@/components/domain/news-mentions-section";
import { OfficialActionCard } from "@/components/domain/official-action-card";
import { OfficialMeetingRecordCard } from "@/components/domain/official-meeting-record-card";
import { OfficialPromisesSection } from "@/components/domain/official-promises-section";
import { OfficialGovernmentSourceCard } from "@/components/domain/official-government-source-card";
import { OfficialSourceDocumentsCard } from "@/components/domain/official-source-documents-card";
import { OfficialProfileHero } from "@/components/domain/official-profile-hero";
import { PollCard } from "@/components/domain/poll-card";
import { PoliticalAdsSection } from "@/components/domain/political-ads-section";
import { ProfileViewerAlignmentCard } from "@/components/domain/profile-viewer-alignment-card";
import { ProfileSentimentTracker } from "@/components/domain/profile-sentiment-tracker";
import { OfficialRecentPosts } from "@/components/domain/official-recent-posts";
import { PollingComparisonCard } from "@/components/domain/polling-comparison-card";
import { ProfileInterviewsSection } from "@/components/domain/profile-interviews-section";
import { SourceExplorer, type SourceExplorerItem } from "@/components/domain/source-explorer";
import { SummaryBriefPanel } from "@/components/domain/summary-brief-panel";
import { canUserVote } from "@/lib/auth/guards";
import { getDefaultSeedUser } from "@/lib/auth/mock-users";
import { isGuestUserId } from "@/lib/auth/session";
import { getContextualPostPreviews } from "@/lib/feed/posts";
import { getCampaignFinanceSourceCard, type CampaignFinanceSourceCardData } from "@/lib/civic-data/profile-source-cards";
import { getApprovedOfficialGovernmentEnrichment, type ApprovedOfficialGovernmentEnrichment } from "@/lib/incumbents/official-bio-enrichment";
import { getOfficialIssuePositions } from "@/lib/issue-positions/store";
import { getProfileNewsMentionCard, type ProfileNewsMentionCardData } from "@/lib/news-mentions/store";
import { createEmptyCampaignFinanceDashboard } from "@/lib/nv-sos/finance-dashboard";
import { getOfficialSourceDocumentsForProfile, type OfficialSourceDocumentsCardData } from "@/lib/nv-sos/public";
import { getOfficialMeetingActionsForProfile } from "@/lib/public-meetings/official-action-store";
import { getOfficialMeetingRecordSummary } from "@/lib/public-meetings/public";
import type { OfficialMeetingRecordSummary } from "@/lib/public-meetings/types";
import { getCurrentFeedViewer, getCurrentSessionUser, getCurrentUser } from "@/lib/server/auth-session";
import { getOfficialActionCountByOfficialProfileId, getOfficialActionsByOfficialProfileId } from "@/lib/officials/action-store";
import { getOfficialPromises } from "@/lib/officials/promises";
import { getOfficials } from "@/lib/officials/store";
import { getDraftLegislationBySponsorId } from "@/lib/petitions/legislation";
import { getPoliticalAdsForEntity } from "@/lib/political-ads/store";
import { getUserProfileContent } from "@/lib/profile/details";
import { mergeExternalLinksWithWebsite } from "@/lib/profile/external-links";
import {
  summarizeOfficialActionAlignment,
  summarizeOfficialActionTypes,
  summarizeOfficialPartyAlignment,
  supportsPartyAlignmentLens,
} from "@/lib/profile/accountability";
import { getOfficialViewerAlignmentSummary } from "@/lib/profile/viewer-alignment";
import { getSafeUserProgressionSummary } from "@/lib/profile/progression";
import { buildOfficialProfileSignals } from "@/lib/profile/signals";
import { getInterviewRequestsForPublicProfile } from "@/lib/server/interviews";
import { getClaimActionStateForViewer, getClaimMatchForProfile, getOnboardingDraft } from "@/lib/server/onboarding";
import { getPollsByCreator } from "@/lib/polls/store";
import { getLightweightFollowState } from "@/lib/social/follows";
import { getProfileSentimentSummary } from "@/lib/votes/profile-sentiment";
import { NewsMentionTargetType } from "@prisma/client";
import type { OfficialProfileDetail, PostSummary, ProfileSignalsSummary, PublicIssuePositionSummary, PublicProfileInterviewsSummary, UserRole } from "@/types/domain";

type OfficialDetailPageProps = {
  params: Promise<{
    officialId: string;
  }>;
  searchParams?: Promise<{
    promises?: string;
    officialActionReaction?: string;
    officialActionError?: string;
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

async function getOfficialSummaryById(officialId: string) {
  const officials = await getOfficials();
  return officials.find((official) => official.id === officialId) ?? null;
}

async function getOfficialRecentPostsById(officialId: string): Promise<PostSummary[]> {
  const official = await getOfficialSummaryById(officialId);

  if (!official?.claimedByUserId) {
    return [];
  }

  const posts = await getContextualPostPreviews({ limit: 24 });
  return posts.filter((post) => post.authorId === official.claimedByUserId).slice(0, 3);
}

function buildFallbackOfficialDetail(official: NonNullable<Awaited<ReturnType<typeof getOfficialSummaryById>>>): OfficialProfileDetail {
  return {
    ...official,
    recentPosts: [],
    campaignPromises: [],
    officialActions: [],
    linkedUserId: official.claimedByUserId,
    followingCount: 0,
    viewerIsFollowing: false,
    viewerCanFollow: false,
  };
}

export default async function OfficialDetailPage({ params, searchParams }: OfficialDetailPageProps) {
  const { officialId } = await params;
  const [resolvedSearchParams, officialSummary] = await Promise.all([searchParams ? searchParams : Promise.resolve(undefined), getOfficialSummaryById(officialId)]);

  if (!officialSummary) {
    notFound();
  }

  return (
    <div className="space-y-6 py-8">
      {resolvedSearchParams?.promises === "updated" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Campaign promises were updated.
        </section>
      ) : null}
      {resolvedSearchParams?.officialActionReaction ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {resolvedSearchParams.officialActionReaction === "support" && "Your support reaction was recorded for that official action."}
          {resolvedSearchParams.officialActionReaction === "oppose" && "Your oppose reaction was recorded for that official action."}
        </section>
      ) : null}
      {resolvedSearchParams?.officialActionError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {resolvedSearchParams.officialActionError === "denied" && "You must be a verified voter to react to official actions."}
          {resolvedSearchParams.officialActionError === "invalid" && "That official action reaction could not be saved. Please try again."}
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
      <OfficialProfileBody officialId={officialId} fallbackOfficial={buildFallbackOfficialDetail(officialSummary)} />
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
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </section>
  );
}

function ImportedOfficialPublicModules({
  official,
  issuePositions,
  newsMentionCard,
  showNewsDiagnostics,
  campaignFinanceCard,
  officialGovernmentEnrichment,
  officialSourceDocuments,
  officialMeetingRecordSummary,
}: {
  official: OfficialProfileDetail;
  issuePositions: PublicIssuePositionSummary[];
  newsMentionCard: ProfileNewsMentionCardData;
  showNewsDiagnostics: boolean;
  campaignFinanceCard: CampaignFinanceSourceCardData;
  officialGovernmentEnrichment: ApprovedOfficialGovernmentEnrichment | null;
  officialSourceDocuments: OfficialSourceDocumentsCardData;
  officialMeetingRecordSummary: OfficialMeetingRecordSummary;
}) {
  const contactHref = official.email ? `mailto:${official.email}` : official.phone ? `tel:${official.phone.replace(/[^+\d]/g, "")}` : null;
  const possibleSourceExplorerItems = [
    official.sourceUrl
      ? {
          id: `${official.id}-official-source`,
          sourceName: official.sourceLabel ?? "Imported Nevada official source",
          sourceType: "official_record",
          sourceUrl: official.sourceUrl,
          lastImportedAt: null,
          fieldsDerived: ["name", "office / role", "jurisdiction", "district", "public contact"],
          reviewStatus: "imported",
          confidenceScore: 0.9,
          notes: "Core official fields imported from stored civic source data.",
        }
      : null,
    official.websiteUrl
      ? {
          id: `${official.id}-website-source`,
          sourceName: "Official website",
          sourceType: "official_website",
          sourceUrl: official.websiteUrl,
          lastImportedAt: null,
          fieldsDerived: ["website"],
          reviewStatus: "imported",
          confidenceScore: 0.7,
          notes: "Stored website URL only. Profile enrichment is still pending review.",
        }
      : null,
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
          id: `${official.id}-news-provider`,
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
          id: `${official.id}-campaign-finance-source`,
          sourceName: campaignFinanceCard.sourceName ?? "Campaign finance source",
          sourceType: "campaign_finance",
          sourceUrl: campaignFinanceCard.sourceUrl,
          lastImportedAt: campaignFinanceCard.lastCheckedAt,
          fieldsDerived: ["campaign finance source link", campaignFinanceCard.filingSummaries.length ? "filing metadata" : null].filter((field): field is string => Boolean(field)),
          reviewStatus: campaignFinanceCard.reviewStatus ?? "pending_review",
          confidenceScore: null,
          notes: `${campaignFinanceCard.filingCount} parsed filing${campaignFinanceCard.filingCount === 1 ? "" : "s"} stored. ${campaignFinanceCard.donorExtractionStatus}`,
        }
      : null,
    officialGovernmentEnrichment?.headshotUrl
      ? {
          id: `${official.id}-profile-image-source`,
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

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Public sentiment</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Sentiment preview</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">Coming soon</span>
          </div>
          <div className="mt-5 flex h-28 items-end gap-2" aria-hidden="true">
            {[34, 48, 40, 56, 44, 52].map((height, index) => (
              <span key={`official-profile-sentiment-${index}`} className="flex-1 rounded-t-xl bg-cyan-300/25" style={{ height: `${height}%` }} />
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Public sentiment data not collected yet.</p>
        </div>

        <div className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Community questions</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Meeting questions</h2>
          <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
            {officialMeetingRecordSummary.matched_question_count
              ? `${officialMeetingRecordSummary.matched_question_count} source-backed local question${officialMeetingRecordSummary.matched_question_count === 1 ? "" : "s"} linked to parsed meeting records.`
              : "Official-specific community questions will appear after a verified real-data question is linked to this profile."}
          </div>
        </div>
      </section>

      <IssuePositionsSection
        positions={issuePositions}
        emptyTitle="Issue positions pending"
        emptyDescription="No approved, sourced official issue positions are available for this imported record yet."
        correctionHref={`/claim-profile/${official.id}`}
      />

      <NewsMentionsSection cardData={newsMentionCard} showAdminDiagnostics={showNewsDiagnostics} />

      <CampaignFinanceSourceCard data={campaignFinanceCard} />

      <OfficialSourceDocumentsCard data={officialSourceDocuments} />

      <OfficialGovernmentSourceCard enrichment={officialGovernmentEnrichment} emptyTitle="Official government source pending review" />

      <SourceExplorer items={sourceExplorerItems} emptyText="Official source records are pending review." />

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Take action</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Ways to use this profile</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Follow official</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Following opens after this imported record is linked to a claimed profile.</p>
          </div>
          {contactHref ? (
            <Link href={contactHref} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
              <p className="text-sm font-semibold text-slate-100">Contact office</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">Uses stored public contact information.</p>
            </Link>
          ) : (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-slate-100">Contact office</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">Public contact pending.</p>
            </div>
          )}
          <Link href="/elections" className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
            <p className="text-sm font-semibold text-slate-100">View related election</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Open Nevada election context.</p>
          </Link>
          <Link href={`/officials?communityId=nevada&q=${encodeURIComponent(official.officeTitle)}`} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
            <p className="text-sm font-semibold text-slate-100">Compare officials</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Review related office records.</p>
          </Link>
          <Link href={`/claim-profile/${official.id}`} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
            <p className="text-sm font-semibold text-slate-100">Submit correction / claim</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Start the profile claim and review path.</p>
          </Link>
          <Link href={`/who-represents-me?community=${encodeURIComponent(official.jurisdictionName)}`} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/24">
            <p className="text-sm font-semibold text-slate-100">Check my districts</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">See whether this office matches your stored district assignments.</p>
          </Link>
        </div>
        <div className="mt-5">
          <FavoriteToggleControl
            targetType="official"
            targetId={official.id}
            visibleLabel="Save"
            className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
          />
        </div>
      </section>

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Bio / enrichment</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Bio source not found yet</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Official record imported. This page renders stored official data only while source-backed biography enrichment is reviewed.
        </p>
        <Link href={`/claim-profile/${official.id}`} className="mt-4 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100">
          Submit correction / source
        </Link>
      </section>

      <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Source attribution</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Nevada official source</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{official.sourceLabel ?? "Imported Nevada beta data"}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Official site</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{official.websiteUrl ? "Stored website available" : "Website pending"}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verification</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{official.sourceUrl ? "Source-attributed imported record" : "Source attribution pending"}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Data completeness</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{official.districtName ? "Core office fields present" : "District pending or not applicable"}</p>
          </div>
        </div>
      </section>
    </>
  );
}

async function OfficialProfileBody({
  officialId,
  fallbackOfficial,
}: {
  officialId: string;
  fallbackOfficial: OfficialProfileDetail;
}) {
  const fallbackViewer = getDefaultSeedUser();
  const safeOfficial = fallbackOfficial;
  const viewer = await withSectionTimeout(getCurrentFeedViewer(), "official viewer", 1200).catch((error) => {
    console.error(`[official-detail] viewer fallback for ${officialId}`, error);
    return {
      id: fallbackViewer.id,
      role: fallbackViewer.role,
      jurisdictionName: fallbackViewer.jurisdictionName,
      isVerifiedVoter: fallbackViewer.isVerifiedVoter,
    };
  });
  const sessionUser = await withSectionTimeout(getCurrentSessionUser(), "official session user", 1200).catch((error) => {
    console.error(`[official-detail] session user fallback for ${officialId}`, error);
    return null;
  });
  const comparisonUser = await withSectionTimeout(getCurrentUser(), "official comparison user", 1200).catch((error) => {
    console.error(`[official-detail] comparison user fallback for ${officialId}`, error);
    return fallbackViewer;
  });
  const showNewsDiagnostics = process.env.NODE_ENV !== "production" || sessionUser?.role === "admin";
  const [
    actionCount,
    promises,
    recentPosts,
    issuePositions,
    newsMentionCard,
    campaignFinanceCard,
    officialGovernmentEnrichment,
    officialSourceDocuments,
    officialMeetingRecordSummary,
  ] = await Promise.all([
    withSectionTimeout(getOfficialActionCountByOfficialProfileId(officialId), "official action count", 900).catch((error) => {
      console.error(`[official-detail] action count fallback for ${officialId}`, error);
      return fallbackOfficial.officialActions.length;
    }),
    withSectionTimeout(getOfficialPromises(officialId), "official promises preview", 900).catch((error) => {
      console.error(`[official-detail] promises preview fallback for ${officialId}`, error);
      return fallbackOfficial.campaignPromises;
    }),
    withSectionTimeout(getOfficialRecentPostsById(officialId), "official recent posts preview", 900).catch((error) => {
      console.error(`[official-detail] recent posts preview fallback for ${officialId}`, error);
      return [];
    }),
    withSectionTimeout(getOfficialIssuePositions(officialId), "official issue positions", 900).catch((error) => {
      console.error(`[official-detail] issue positions fallback for ${officialId}`, error);
      return [];
    }),
    withSectionTimeout(
      getProfileNewsMentionCard(NewsMentionTargetType.OFFICIAL, officialId, { includePending: showNewsDiagnostics }),
      "official news mentions",
      900,
    ).catch((error) => {
      console.error(`[official-detail] news mentions fallback for ${officialId}`, error);
      return {
        mentions: [],
        totalCount: 0,
        approvedCount: 0,
        verifiedCount: 0,
        pendingCount: 0,
        providerUsed: null,
        lastImportRun: null,
      };
    }),
    withSectionTimeout(getCampaignFinanceSourceCard("official", officialId), "official campaign finance source", 900).catch((error) => {
      console.error(`[official-detail] campaign finance source fallback for ${officialId}`, error);
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
        campaignReportedSummary: null,
        donorExtractionStatus: "Classification incomplete; source-backed filing summaries remain available.",
      };
    }),
    withSectionTimeout(getApprovedOfficialGovernmentEnrichment("OFFICIAL", officialId), "official government enrichment", 900).catch((error) => {
      console.error(`[official-detail] official government enrichment fallback for ${officialId}`, error);
      return null;
    }),
    withSectionTimeout(getOfficialSourceDocumentsForProfile(safeOfficial.name, safeOfficial.officeTitle), "official source documents", 900).catch((error) => {
      console.error(`[official-detail] official source documents fallback for ${officialId}`, error);
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
    }),
    withSectionTimeout(getOfficialMeetingRecordSummary(safeOfficial.name, safeOfficial.jurisdictionName), "official meeting record", 900).catch((error) => {
      console.error(`[official-detail] official meeting record fallback for ${officialId}`, error);
      return {
        official_name: safeOfficial.name,
        matched_vote_count: 0,
        matched_question_count: 0,
        by_policy_area: [],
        recent_notable_votes: [],
        source_backed_timeline: [],
        citizen_alignment_percent: null,
        last_updated_at: null,
      };
    }),
  ]);

  const social = safeOfficial.linkedUserId
    ? await withSectionTimeout(
        getLightweightFollowState(viewer.id, safeOfficial.linkedUserId, safeOfficial.followerCount),
        "official social state",
        1400,
      ).catch((error) => {
        console.error(`[official-detail] lightweight follow state fallback for ${officialId}`, error);
        return null;
      })
    : null;

  const hydratedOfficial = social
    ? {
        ...safeOfficial,
        recentPosts,
        followerCount: social.followerCount,
        followingCount: social.followingCount,
        viewerIsFollowing: social.viewerIsFollowing,
        viewerCanFollow: social.viewerCanFollow,
      }
    : {
        ...safeOfficial,
        recentPosts,
      };
  const progression = hydratedOfficial.linkedUserId ? getSafeUserProgressionSummary("official") : null;
  const externalLinks = hydratedOfficial.linkedUserId
    ? await withSectionTimeout(getUserProfileContent(hydratedOfficial.linkedUserId), "official external links", 1200)
        .then((content) => mergeExternalLinksWithWebsite(content.externalLinks, hydratedOfficial.websiteUrl))
        .catch((error) => {
          console.error(`[official-detail] external links fallback for ${officialId}`, error);
          return mergeExternalLinksWithWebsite([], hydratedOfficial.websiteUrl);
        })
    : mergeExternalLinksWithWebsite([], hydratedOfficial.websiteUrl);
  const claimMatch =
    !hydratedOfficial.isClaimed
      ? await withSectionTimeout(
          Promise.all([
            getOnboardingDraft(),
            Promise.resolve(sessionUser),
          ]).then(([draft, currentSessionUser]) => getClaimMatchForProfile(hydratedOfficial.id, currentSessionUser, draft)),
          "official claim match",
          1500,
        ).catch((error) => {
          console.error(`[official-detail] claim match fallback for ${officialId}`, error);
          return null;
        })
      : null;

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
    signals = buildOfficialProfileSignals(hydratedOfficial, EMPTY_INTERVIEWS_SUMMARY, null);
  } catch (error) {
    console.error(`[official-detail] profile signals fallback for ${officialId}`, error);
  }

  const showMessageButton =
    Boolean(hydratedOfficial.linkedUserId) &&
    hydratedOfficial.linkedUserId !== viewer.id &&
    (viewer.role === "citizen" || viewer.role === "trustedCitizen" || viewer.role === "official");
  const officialBriefBullets = [
    hydratedOfficial.id === "profile_elena_ramirez"
      ? "This profile is seeded to show how public commitments, visible actions, and follow-through can be read together across housing, infrastructure, and budget transparency."
      : null,
    `${hydratedOfficial.officeTitle} is the clearest public role signal on this page.`,
    promises[0]?.category ? `Public Reliability is most clearly being tested on ${promises[0].category}.` : null,
    hydratedOfficial.recentPosts[0]
      ? `${hydratedOfficial.recentPosts.length} recent platform post${hydratedOfficial.recentPosts.length === 1 ? "" : "s"} add current context beyond the formal action record.`
      : "Recent platform posts are limited, so official actions and promises remain the clearest signals.",
  ].filter((value): value is string => Boolean(value));
  const officialBriefSummary =
    hydratedOfficial.id === "profile_elena_ramirez"
      ? `${hydratedOfficial.name}'s page is the clearest seeded example of the platform's accountability model: it connects specific promises to visible official actions, then shows where follow-through looks strong, partial, or contradicted across housing, infrastructure, and budget transparency.`
      : `${hydratedOfficial.name}'s page works best as a quick accountability read: ${hydratedOfficial.officeTitle.toLowerCase()} activity is anchored in public actions, promises, and follow-through context for ${hydratedOfficial.jurisdictionName}. ${actionCount ? "The action record below is the strongest place to see what changed recently, while posts and polls add supporting context." : "The clearest next step is to review promises and any recent posts for movement."}`;
  const sentimentSummary = await getProfileSentimentSummary(comparisonUser, hydratedOfficial.id).catch((error) => {
    console.error(`[official-detail] sentiment tracker fallback for ${officialId}`, error);
    return null;
  });
  const relatedAds = getPoliticalAdsForEntity("official", hydratedOfficial.id, 4);

  return (
    <>
      <OfficialProfileHero
        official={hydratedOfficial}
        returnPath={`/officials/${hydratedOfficial.id}`}
        progression={progression}
        showMessageButton={showMessageButton}
        signals={signals}
        showClaimButton={!hydratedOfficial.isClaimed && claimAction.state !== "hidden"}
        claimButtonLabel={claimAction.label}
        guestMode={isGuestUserId(viewer.id)}
        primaryPromiseCategory={promises[0]?.category ?? null}
        publicActionCount={actionCount}
        externalLinks={externalLinks}
      />
      {hydratedOfficial.sourceLabel ? (
        <ImportedOfficialPublicModules
          official={hydratedOfficial}
          issuePositions={issuePositions}
          newsMentionCard={newsMentionCard}
          showNewsDiagnostics={showNewsDiagnostics}
          campaignFinanceCard={campaignFinanceCard}
          officialGovernmentEnrichment={officialGovernmentEnrichment}
          officialSourceDocuments={officialSourceDocuments}
          officialMeetingRecordSummary={officialMeetingRecordSummary}
        />
      ) : null}
      <SummaryBriefPanel
        eyebrow="Official Brief"
        title={`What to watch on ${hydratedOfficial.name}'s page`}
        summary={officialBriefSummary}
        bullets={officialBriefBullets}
        signalChips={[
          hydratedOfficial.officeTitle,
          `${actionCount} public action${actionCount === 1 ? "" : "s"}`,
          `${hydratedOfficial.recentPosts.length} recent post${hydratedOfficial.recentPosts.length === 1 ? "" : "s"}`,
        ]}
        actionLabel="Review actions"
        actionHref="#official-actions"
        actionLinks={[
          { label: "Review actions", href: "#official-actions" },
          ...(promises.length ? [{ label: "Review promises", href: "#official-promises" }] : []),
        ]}
      />
      <OfficialMeetingRecordCard summary={officialMeetingRecordSummary} />
      {sentimentSummary ? (
        <ProfileSentimentTracker
          title={`Weekly public vote on ${hydratedOfficial.name}`}
          summary={sentimentSummary}
          returnPath={`/officials/${hydratedOfficial.id}`}
          canVote={canUserVote(comparisonUser)}
        />
      ) : hydratedOfficial.sourceLabel ? null : (
        <ProfileSectionFallback title="Public sentiment" description="No sentiment history yet." />
      )}
      {!hydratedOfficial.sourceLabel ? (
        <IssuePositionsSection
          positions={issuePositions}
          emptyTitle="Issue positions pending"
          emptyDescription="No approved, sourced official issue positions are available for this profile yet."
          correctionHref={`/claim-profile/${hydratedOfficial.id}`}
        />
      ) : null}
      {!hydratedOfficial.sourceLabel ? <NewsMentionsSection cardData={newsMentionCard} showAdminDiagnostics={showNewsDiagnostics} /> : null}
      <PoliticalAdsSection
        title="Political ads about this official"
        description="Track officeholder committee ads, issue ads mentioning this official, opposition messages, and outside group spending."
        ads={relatedAds}
        repositoryHref={`/ads?officialId=${encodeURIComponent(hydratedOfficial.id)}`}
        emptyText="No political ads are attached to this official yet."
      />
      <Suspense fallback={<ProfileSectionFallback title="Funding" description="Loading funding and polling context..." />}>
        <OfficialFundingSection officialId={hydratedOfficial.id} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Actions" description="Loading recent official actions..." />}>
        <OfficialActionsSection
          officialId={hydratedOfficial.id}
          viewerId={viewer.id}
          officialParty={hydratedOfficial.party}
          officialJurisdictionName={hydratedOfficial.jurisdictionName}
        />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Actions taken" description="Loading source-backed meeting actions..." />}>
        <OfficialMeetingActionsTakenSection officialId={hydratedOfficial.id} officialName={hydratedOfficial.name} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Draft legislation" description="Loading sponsored legislation..." />}>
        <OfficialDraftLegislationSection officialId={hydratedOfficial.id} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Promises" description="Loading public promises..." />}>
        <OfficialPromisesSectionLoader officialId={hydratedOfficial.id} viewerId={viewer.id} viewerRole={viewer.role} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Interviews" description="Loading interview summary..." />}>
        <OfficialInterviewsSection officialId={hydratedOfficial.id} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Recent polls" description="Loading structured questions..." />}>
        <OfficialRecentPollsSection officialId={hydratedOfficial.id} viewerId={viewer.id} viewerRole={viewer.role} />
      </Suspense>
      <Suspense fallback={<ProfileSectionFallback title="Perspectives and updates" description="Loading recent civic briefs..." />}>
        <OfficialRecentPostsSection officialId={hydratedOfficial.id} viewerId={viewer.id} viewerRole={viewer.role} />
      </Suspense>
    </>
  );
}

async function OfficialFundingSection({ officialId }: { officialId: string }) {
  const official = await withSectionTimeout(getOfficialSummaryById(officialId), "official funding detail", 1500).catch((error) => {
    console.error(`[official-detail] funding fallback for ${officialId}`, error);
    return null;
  });

  if (!official) {
    return <ProfileSectionFallback title="Funding" description="Funding and polling context is unavailable right now." />;
  }

  return (
    <>
      {official.fundingBreakdown?.length ? (
        <FundingBreakdownCard title="Funding breakdown" items={official.fundingBreakdown} industries={official.industryFundingBreakdown} />
      ) : null}
      {official.pollingComparisons?.length ? <PollingComparisonCard comparisons={official.pollingComparisons} /> : null}
      {!official.fundingBreakdown?.length && !official.pollingComparisons?.length ? (
        <ProfileSectionFallback title="Funding" description="No funding or polling context is available for this official yet." />
      ) : null}
    </>
  );
}

async function OfficialActionsSection({
  officialId,
  viewerId,
  officialParty,
  officialJurisdictionName,
}: {
  officialId: string;
  viewerId: string;
  officialParty: string;
  officialJurisdictionName: string;
}) {
  const officialActions = await withSectionTimeout(getOfficialActionsByOfficialProfileId(officialId, viewerId), "official actions", 1500).catch((error) => {
    console.error(`[official-detail] official actions fallback for ${officialId}`, error);
    return [];
  });

  if (!officialActions.length) {
    return <ProfileSectionFallback title="Actions" description="No recent official actions are visible yet." />;
  }

  const alignment = summarizeOfficialActionAlignment(officialActions);
  const partyAlignment = summarizeOfficialPartyAlignment(officialActions);
  const actionTypes = summarizeOfficialActionTypes(officialActions);
  const viewerAlignment = await withSectionTimeout(
    getOfficialViewerAlignmentSummary(viewerId, officialJurisdictionName, officialActions),
    "official viewer alignment",
    1500,
  ).catch((error) => {
    console.error(`[official-detail] viewer alignment fallback for ${officialId}`, error);
    return null;
  });
  const showPartyLens = supportsPartyAlignmentLens(officialParty) && partyAlignment.relevantCount > 0;
  const totalActions = Math.max(alignment.totalCount, 1);
  const visibleActions = officialActions.slice(0, 3);
  const remainingActions = officialActions.slice(3);
  const segments = [
    {
      label: "Aligned",
      description: "Supports promises or platform",
      count: alignment.alignedCount,
      width: `${(alignment.alignedCount / totalActions) * 100}%`,
      barClass: "bg-cyan-400",
      valueClass: "text-cyan-100",
      chipClass: "border border-cyan-300/16 bg-cyan-500/10 text-cyan-100",
    },
    {
      label: "Mixed",
      description: "Still contested or unclear",
      count: alignment.mixedCount,
      width: `${(alignment.mixedCount / totalActions) * 100}%`,
      barClass: "bg-slate-500",
      valueClass: "text-slate-100",
      chipClass: "border border-white/10 bg-white/[0.05] text-slate-200",
    },
    {
      label: "Against",
      description: "In tension with commitments",
      count: alignment.againstCount,
      width: `${(alignment.againstCount / totalActions) * 100}%`,
      barClass: "bg-amber-400",
      valueClass: "text-amber-100",
      chipClass: "border border-amber-300/16 bg-amber-500/10 text-amber-100",
    },
  ];
  const actionTypeCards = [
    {
      label: "Votes",
      count: actionTypes.voteCount,
      accentClass: "bg-cyan-300",
      panelClass: "border-cyan-300/16 bg-cyan-500/10",
      valueClass: "text-cyan-100",
    },
    {
      label: "Sponsorships",
      count: actionTypes.sponsorshipCount,
      accentClass: "bg-indigo-300",
      panelClass: "border-indigo-300/16 bg-indigo-500/10",
      valueClass: "text-indigo-100",
    },
    {
      label: "Statements",
      count: actionTypes.statementCount,
      accentClass: "bg-amber-300",
      panelClass: "border-amber-300/16 bg-amber-500/10",
      valueClass: "text-amber-100",
    },
    {
      label: "Other actions",
      count: actionTypes.implementationCount,
      accentClass: "bg-slate-300",
      panelClass: "border-white/10 bg-white/[0.04]",
      valueClass: "text-slate-100",
    },
  ];

  return (
    <section
      id="official-actions"
      className="dd-panel-muted rounded-[1.8rem] p-5 sm:p-6"
    >
      <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)] xl:items-start">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Accountability overview</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Actions</h2>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                    {alignment.totalCount} visible actions
                  </span>
                </div>
              </div>
              <div className="min-w-[150px] rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Action mix</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{alignment.alignedCount}/{alignment.totalCount}</p>
                <p className="mt-1 text-xs text-slate-400">aligned with promises or platform</p>
              </div>
            </div>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
              Actions are checked first against explicit promises, then platform positions, and only use party context when no direct commitment exists.
            </p>
            <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-white/[0.05] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">What the record suggests</p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-300">{alignment.summary}</p>
            </div>

            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Action types in view</p>
                <p className="text-xs text-slate-400">Votes remain central for higher-volume offices.</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {actionTypeCards.map((card) => (
                  <div key={card.label} className={`rounded-2xl border px-3.5 py-3.5 ${card.panelClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                        <p className={`mt-2 text-2xl font-semibold tracking-tight ${card.valueClass}`}>{card.count}</p>
                      </div>
                      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${card.accentClass}`} aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.05] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Action distribution</p>
                  <p className="mt-1 text-sm text-slate-400">How visible actions stack up against stated commitments at a glance.</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tracking-tight text-slate-50">{alignment.alignedCount}-{alignment.againstCount}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">aligned vs against</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-full bg-white/[0.06] shadow-inner">
                <div className="flex h-3.5 w-full min-w-0">
                  {segments.map((segment) =>
                    segment.count ? <div key={segment.label} className={segment.barClass} style={{ width: segment.width }} /> : null,
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {segments.map((segment) => (
                  <div key={segment.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{segment.label}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${segment.chipClass}`}>{segment.count}</span>
                    </div>
                    <p className={`mt-2 text-xl font-semibold tracking-tight ${segment.valueClass}`}>{Math.round((segment.count / totalActions) * 100)}%</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{segment.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {viewerAlignment ? (
              <ProfileViewerAlignmentCard
                title="How this action record compares with you"
                summary={viewerAlignment.summary}
                description={viewerAlignment.description}
                alignedCount={viewerAlignment.alignedCount}
                againstCount={viewerAlignment.againstCount}
                mixedCount={viewerAlignment.mixedCount}
                sparse={viewerAlignment.sparse}
              />
            ) : null}

            {showPartyLens ? (
              <div className="rounded-[1.45rem] border border-indigo-100 bg-indigo-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">Party-position context</p>
                    <p className="mt-1 text-sm text-slate-600">
                      A secondary partisan lens, separate from Public Reliability, showing whether visible actions tracked with or broke from party-position context.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold tracking-tight text-ink">{partyAlignment.withPartyCount}-{partyAlignment.againstPartyCount}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{partyAlignment.relevantCount} partisan actions</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-indigo-100 bg-white/95 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">With party</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-indigo-700">{partyAlignment.withPartyCount}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Tracked with party-position context.</p>
                  </div>
                  <div className="rounded-2xl border border-fuchsia-100 bg-white/95 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Against party</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-fuchsia-700">{partyAlignment.againstPartyCount}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Broke from party-position context.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mixed / unclear</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-slate-700">{partyAlignment.mixedPartyCount}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Party context was weak or contested.</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-500">{partyAlignment.summary}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-slate-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Action record</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink">Visible actions behind the summary</h3>
          </div>
          <p className="text-sm text-slate-500">Showing {visibleActions.length} now{remainingActions.length ? `, with ${remainingActions.length} more available below.` : "."}</p>
        </div>

        <div className="mt-4 grid gap-3">
          {visibleActions.map((action) => (
            <OfficialActionCard
              key={action.id}
              action={action}
              returnPath={`/officials/${officialId}`}
              compact
              viewerAlignment={viewerAlignment?.actionAlignmentById[action.id] ?? null}
            />
          ))}
        </div>

        {remainingActions.length ? (
          <details className="group mt-4 rounded-[1.35rem] border border-slate-200 bg-slate-50/75 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-civic-700">
              <span>Show {remainingActions.length} more action{remainingActions.length === 1 ? "" : "s"}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500 transition group-open:rotate-180">More</span>
            </summary>
            <div className="mt-4 grid gap-3">
              {remainingActions.map((action) => (
                <OfficialActionCard
                  key={action.id}
                  action={action}
                  returnPath={`/officials/${officialId}`}
                  compact
                  viewerAlignment={viewerAlignment?.actionAlignmentById[action.id] ?? null}
                />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

async function OfficialDraftLegislationSection({ officialId }: { officialId: string }) {
  const sponsoredLegislation = await withSectionTimeout(getDraftLegislationBySponsorId(officialId), "official draft legislation", 1500).catch((error) => {
    console.error(`[official-detail] draft legislation fallback for ${officialId}`, error);
    return [];
  });

  if (!sponsoredLegislation.length) {
    return <ProfileSectionFallback title="Draft legislation" description="No sponsored draft legislation is visible yet." />;
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Draft legislation in progress</h2>
        <p className="mt-2 text-sm text-slate-600">Petitions this official is publicly associated with as they move into drafting.</p>
      </div>
      <div className="grid gap-4">
        {sponsoredLegislation.map((legislation) => (
          <DraftLegislationCard key={legislation.id} legislation={legislation} />
        ))}
      </div>
    </section>
  );
}

async function OfficialMeetingActionsTakenSection({ officialId, officialName }: { officialId: string; officialName: string }) {
  const actions = await withSectionTimeout(getOfficialMeetingActionsForProfile(officialId, officialName), "official meeting actions", 1600).catch((error) => {
    console.error(`[official-detail] meeting actions fallback for ${officialId}`, error);
    return [];
  });

  if (!actions.length) {
    return <ProfileSectionFallback title="Actions taken" description="No approved source-backed meeting actions are attached to this official yet." />;
  }

  const actionTypeCounts = [...new Set(actions.map((action) => action.action_type))].map((type) => ({
    type,
    count: actions.filter((action) => action.action_type === type).length,
  }));

  return (
    <section className="dd-panel-muted rounded-[1.8rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Source-backed meeting record</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Actions Taken</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            These actions come from imported public meeting records and are shown only when the official name and action are explicit enough for public display.
          </p>
        </div>
        <Link href={`/admin/official-actions?status=approved`} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100">
          Review source records
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actionTypeCounts.map((entry) => (
          <div key={entry.type} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{entry.type.replace(/_/g, " ")}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{entry.count}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {actions.slice(0, 8).map((action) => (
          <article key={action.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">Source-backed</span>
              {action.needs_review ? <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">Needs review</span> : null}
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{action.action_type.replace(/_/g, " ")}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{Math.round(action.confidence * 100)}%</span>
            </div>
            <h3 className="mt-3 text-base font-semibold text-slate-50">{action.item?.title ?? action.action_text}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{action.action_text}</p>
            <p className="mt-2 text-xs text-slate-500">
              {action.body?.name ?? action.jurisdiction_body} · {action.meeting?.meeting_date ? new Date(action.meeting.meeting_date).toLocaleDateString("en") : "Date pending"}
            </p>
            {action.source_url ? (
              <Link href={action.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-cyan-100">
                Source
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

async function OfficialPromisesSectionLoader({
  officialId,
  viewerId,
  viewerRole,
}: {
  officialId: string;
  viewerId: string;
  viewerRole: UserRole;
}) {
  const [official, promises] = await Promise.all([
    withSectionTimeout(getOfficialSummaryById(officialId), "official promises detail", 1500).catch((error) => {
      console.error(`[official-detail] promises detail fallback for ${officialId}`, error);
      return null;
    }),
    withSectionTimeout(getOfficialPromises(officialId), "official promises", 1500).catch((error) => {
      console.error(`[official-detail] promises fallback for ${officialId}`, error);
      return [];
    }),
  ]);

  if (!official) {
    return <ProfileSectionFallback title="Promises" description="Public promises are unavailable right now." />;
  }

  const canEdit = viewerRole === "admin" || (official.claimedByUserId && official.claimedByUserId === viewerId);

  return (
    <div id="official-promises">
      <OfficialPromisesSection officialId={official.id} promises={promises} canEdit={Boolean(canEdit)} />
    </div>
  );
}

async function OfficialInterviewsSection({ officialId }: { officialId: string }) {
  const interviews = await withSectionTimeout(getInterviewRequestsForPublicProfile(officialId), "official interviews", 1500).catch((error) => {
    console.error(`[official-detail] interviews fallback for ${officialId}`, error);
    return EMPTY_INTERVIEWS_SUMMARY;
  });
  return <ProfileInterviewsSection interviews={interviews} />;
}

async function OfficialRecentPollsSection({
  officialId,
  viewerId,
  viewerRole,
}: {
  officialId: string;
  viewerId: string;
  viewerRole: UserRole;
}) {
  const official = await withSectionTimeout(getOfficialSummaryById(officialId), "official polls detail", 1500).catch((error) => {
    console.error(`[official-detail] recent polls detail fallback for ${officialId}`, error);
    return null;
  });

  if (!official) {
    return <ProfileSectionFallback title="Recent polls" description="Recent poll context is unavailable right now." />;
  }

  const recentPolls = official.claimedByUserId
    ? await withSectionTimeout(getPollsByCreator(official.claimedByUserId, viewerId, 3), "official recent polls", 1500).catch((error) => {
        console.error(`[official-detail] recent polls fallback for ${officialId}`, error);
        return [];
      })
    : [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Recent polls</h2>
        <p className="mt-2 text-sm text-slate-600">Structured questions this official has used to gather community feedback.</p>
      </div>
      <div className="grid gap-4">
        {recentPolls.length ? (
          recentPolls.map((poll) => (
            <PollCard key={poll.id} poll={poll} returnPath={`/officials/${official.id}`} viewerRole={viewerRole} />
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card">
            {official.isClaimed
              ? "No citizen polls yet for this official."
              : "This profile is unclaimed, so citizen polls will only appear after a future claim flow links it to a platform account."}
          </div>
        )}
      </div>
    </section>
  );
}

async function OfficialRecentPostsSection({
  officialId,
  viewerId,
  viewerRole,
}: {
  officialId: string;
  viewerId: string;
  viewerRole: UserRole;
}) {
  const [official, posts] = await Promise.all([
    withSectionTimeout(getOfficialSummaryById(officialId), "official posts profile", 1200).catch((error) => {
      console.error(`[official-detail] recent posts profile fallback for ${officialId}`, error);
      return null;
    }),
    withSectionTimeout(getOfficialRecentPostsById(officialId), "official posts detail", 1200).catch((error) => {
      console.error(`[official-detail] recent posts detail fallback for ${officialId}`, error);
      return [];
    }),
  ]);

  if (!official) {
    return <ProfileSectionFallback title="Perspectives and updates" description="Recent civic briefs are unavailable right now." />;
  }

  return (
    <OfficialRecentPosts
      posts={posts}
      isClaimed={official.isClaimed}
      viewerRole={viewerRole}
      viewerUserId={viewerId}
      returnPath={`/officials/${official.id}`}
    />
  );
}
