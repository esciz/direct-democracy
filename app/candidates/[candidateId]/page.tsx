import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CandidatePromisesSection } from "@/components/domain/candidate-promises-section";
import { ProfileViewerAlignmentCard } from "@/components/domain/profile-viewer-alignment-card";
import { ProfileSentimentTracker } from "@/components/domain/profile-sentiment-tracker";
import { CandidateEndorsementsPanel } from "@/components/domain/candidate-endorsements-panel";
import { CandidateProfileHero } from "@/components/domain/candidate-profile-hero";
import { FundingBreakdownCard } from "@/components/domain/funding-breakdown-card";
import { PollCard } from "@/components/domain/poll-card";
import { PollingComparisonCard } from "@/components/domain/polling-comparison-card";
import { PostCard } from "@/components/domain/post-card";
import { ProfileInterviewsSection } from "@/components/domain/profile-interviews-section";
import { SummaryBriefPanel } from "@/components/domain/summary-brief-panel";
import { canUserVote } from "@/lib/auth/guards";
import { getDefaultSeedUser, getSeedUserById } from "@/lib/auth/mock-users";
import { isGuestUserId } from "@/lib/auth/session";
import { getCurrentFeedViewer, getCurrentSessionUser, getCurrentUser } from "@/lib/server/auth-session";
import { attachEndorsementsToCampaigns } from "@/lib/candidates/endorsements";
import { getCandidateProfileById } from "@/lib/server/elections-context";
import { getCandidateMatchSummary } from "@/lib/candidates/matching";
import { getInterviewRequestsForPublicProfile } from "@/lib/server/interviews";
import { getClaimActionStateForViewer, getClaimMatchForProfile, getOnboardingDraft } from "@/lib/server/onboarding";
import { getContextualPostPreviews } from "@/lib/feed/posts";
import { getOrganizationEndorsementsForCampaign } from "@/lib/organizations/store";
import { getUserProfileContent } from "@/lib/profile/details";
import { mergeExternalLinksWithWebsite } from "@/lib/profile/external-links";
import { getSafeUserProgressionSummary } from "@/lib/profile/progression";
import { buildCandidateProfileSignals } from "@/lib/profile/signals";
import { getCandidateViewerAlignmentSummary } from "@/lib/profile/viewer-alignment";
import { getPollsByCreator } from "@/lib/polls/store";
import { getLightweightFollowState } from "@/lib/social/follows";
import { getProfileSentimentSummary } from "@/lib/votes/profile-sentiment";
import type { CandidateProfileDetail, ProfileSignalsSummary, PublicProfileInterviewsSummary, UserRole } from "@/types/domain";

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

export default async function CandidateDetailPage({ params, searchParams }: CandidateDetailPageProps) {
  const { candidateId } = await params;
  const [viewer, sessionUser, resolvedSearchParams, candidate] = await Promise.all([
    getCurrentFeedViewer(),
    getCurrentSessionUser(),
    searchParams ? searchParams : Promise.resolve(undefined),
    getCandidateProfileById(candidateId),
  ]);

  if (!candidate) {
    notFound();
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
  const comparisonUser = await getCurrentUser();
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

      {sentimentSummary ? (
        <ProfileSentimentTracker
          title={`Weekly public vote on ${hydratedCandidate.name}`}
          summary={sentimentSummary}
          returnPath={`/candidates/${candidate.id}`}
          canVote={canUserVote(comparisonUser)}
        />
      ) : null}

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

      <Suspense fallback={<ProfileSectionFallback title="Campaign funding" description="Loading campaign finance preview..." />}>
        <CandidateFundingSection candidateId={candidate.id} />
      </Suspense>
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
    <section id="candidate-campaigns" className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </section>
  );
}

async function CandidateFundingSection({ candidateId }: { candidateId: string }) {
  const candidate = await getCandidateProfileById(candidateId);

  if (!candidate?.campaigns[0]?.fundingBreakdown) {
    return null;
  }

  return (
    <>
      <FundingBreakdownCard
        title="Campaign funding breakdown"
        items={candidate.campaigns[0].fundingBreakdown}
        industries={candidate.campaigns[0].industryFundingBreakdown}
      />
      {candidate.campaigns[0].pollingComparisons?.length ? (
        <PollingComparisonCard comparisons={candidate.campaigns[0].pollingComparisons} />
      ) : null}
    </>
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
  const candidate = await getCandidateProfileById(candidateId);

  if (!candidate) {
    return null;
  }

  const campaignsWithEndorsements = await attachEndorsementsToCampaigns(candidate.campaigns, viewerId);
  const viewer = getSeedUserById(viewerId) ?? getDefaultSeedUser();
  const organizationEndorsementsByCampaign = new Map(
    await Promise.all(
      campaignsWithEndorsements.map(async (campaign) => [campaign.id, await getOrganizationEndorsementsForCampaign(campaign.id)] as const),
    ),
  );

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Campaigns</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {campaignsWithEndorsements.map((campaign) => (
          <div key={campaign.id} className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">{campaign.campaignStatus}</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">{campaign.officeSought}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {campaign.jurisdictionName}
              {campaign.electionTitle ? ` · ${campaign.electionTitle}` : ""}
            </p>
            <p className="mt-4 text-sm text-slate-700">Raised: {campaign.totalRaised ?? "TBD"}</p>
            <p className="mt-2 text-sm text-slate-700">
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
              <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Organization endorsements</p>
                <div className="mt-3 space-y-3">
                  {organizationEndorsementsByCampaign.get(campaign.id)?.map((endorsement) => (
                    <div key={endorsement.id} className="rounded-2xl bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/organizations/${endorsement.organizationId}`} className="text-sm font-semibold text-ink hover:text-civic-700">
                          {endorsement.organizationName}
                        </Link>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                          {endorsement.organizationType === "campus_org" ? "Campus Org Endorsement" : "Coalition Endorsement"}
                        </span>
                      </div>
                      {endorsement.statement ? <p className="mt-2 text-sm text-slate-600">{endorsement.statement}</p> : null}
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
  const candidate = await getCandidateProfileById(candidateId);

  if (!candidate?.officialPositions.length) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Official positions</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {candidate.officialPositions.map((position) => (
          <div key={position.id} className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-orange-700">
              {position.isCurrent ? "Current office" : "Past office"}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-ink">{position.officeTitle}</h3>
            <p className="mt-2 text-sm text-slate-600">{position.jurisdictionName}</p>
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
  const candidate = await getCandidateProfileById(candidateId);

  if (!candidate) {
    return null;
  }

  const canEdit = viewerRole === "admin" || (candidate.claimedByUserId && candidate.claimedByUserId === viewerId);

  return (
    <div id="candidate-promises">
      <CandidatePromisesSection candidateId={candidate.id} promises={candidate.campaignPromises} canEdit={Boolean(canEdit)} />
    </div>
  );
}

async function CandidateInterviewsSection({ candidateId }: { candidateId: string }) {
  const interviews = await getInterviewRequestsForPublicProfile(candidateId);
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
  const candidate = await getCandidateProfileById(candidateId);

  if (!candidate) {
    return null;
  }

  const recentPolls = candidate.claimedByUserId ? await getPollsByCreator(candidate.claimedByUserId, viewerId, 3) : [];

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
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card">
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
  const candidate = await getCandidateProfileById(candidateId);

  if (!candidate) {
    return null;
  }

  const contextualPosts = candidate.claimedByUserId
    ? (await getContextualPostPreviews({ limit: 24 })).filter((post) => post.authorId === candidate.claimedByUserId).slice(0, 3)
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
          <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card">
            {candidate.isClaimed
              ? "No visible perspectives yet for this candidate."
              : "This profile is unclaimed, so posting will only appear after a future claim flow links it to a platform account."}
          </div>
        )}
      </div>
    </section>
  );
}
