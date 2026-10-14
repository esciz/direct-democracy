import { DonateButton } from "@/components/domain/donate-button";
import { ClaimProfileButton } from "@/components/domain/claim-profile-button";
import { ExternalLinksRow } from "@/components/domain/external-links-row";
import { FollowButton } from "@/components/domain/follow-button";
import { MessageProfileButton } from "@/components/domain/message-profile-button";
import { ProfileFollowerSnapshot } from "@/components/domain/profile-follower-snapshot";
import { ProfileSignalsPanel } from "@/components/domain/profile-signals-panel";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { UnclaimedProfileBadge } from "@/components/domain/unclaimed-profile-badge";
import { RoleProgressionContext } from "@/components/domain/role-progression-context";
import { getFollowerSnapshotByUserId } from "@/lib/social/follows";
import type { CandidateProfileDetail, ExternalLinkSummary, ProfileSignalsSummary, UserProgressionSummary } from "@/types/domain";

type CandidateProfileHeroProps = {
  candidate: CandidateProfileDetail;
  returnPath: string;
  progression?: UserProgressionSummary | null;
  showMessageButton?: boolean;
  signals: ProfileSignalsSummary;
  showClaimButton?: boolean;
  claimButtonLabel?: string;
  guestMode?: boolean;
  externalLinks?: ExternalLinkSummary[];
};

export async function CandidateProfileHero({
  candidate,
  returnPath,
  progression,
  showMessageButton = false,
  signals,
  showClaimButton = true,
  claimButtonLabel = "Claim This Profile",
  guestMode = false,
  externalLinks = [],
}: CandidateProfileHeroProps) {
  const primaryCampaign = candidate.campaigns[0];
  const followerSnapshot = candidate.claimedByUserId ? await getFollowerSnapshotByUserId(candidate.claimedByUserId) : null;

  return (
    <div className="space-y-6">
      <section className="dd-panel rounded-lg p-6 sm:p-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
            <div className="flex items-start gap-5">
              <ProfileImagePlaceholder name={candidate.name} size="lg" imageUrl={candidate.profileImageUrl} />
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/18 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                    {candidate.profileType === "incumbentCandidate" ? "Incumbent candidate" : "Candidate"}
                  </span>
                  {!candidate.isClaimed ? <UnclaimedProfileBadge /> : null}
                  {candidate.partyText ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                      {candidate.partyText}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-50">{candidate.name}</h1>
                  <p className="mt-2 text-sm text-slate-400">{candidate.jurisdictionName}</p>
                </div>
                <p className="max-w-3xl text-sm leading-7 text-slate-300">{candidate.bio}</p>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
                    {candidate.followerCount.toLocaleString()} followers
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
                    {candidate.followingCount.toLocaleString()} following
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <DonateButton href={primaryCampaign?.donationUrl ?? candidate.donationUrl} />
                  {!guestMode && candidate.viewerCanFollow && candidate.claimedByUserId ? (
                    <FollowButton
                      targetUserId={candidate.claimedByUserId}
                      returnPath={returnPath}
                      isFollowing={candidate.viewerIsFollowing}
                    />
                  ) : null}
                  {!guestMode && candidate.claimedByUserId && showMessageButton ? <MessageProfileButton recipientUserId={candidate.claimedByUserId} /> : null}
                  {!candidate.isClaimed && showClaimButton ? <ClaimProfileButton profileId={candidate.id} label={claimButtonLabel} guestMode={guestMode} /> : null}
                  <ShareActionMenu
                    target={{
                      entityType: "candidateProfile",
                      entityId: candidate.id,
                      title: candidate.name,
                      href: `/candidates/${candidate.id}`,
                      summary: candidate.bio,
                      issueTag: candidate.campaignPromises[0]?.category ?? null,
                    }}
                    returnPath={returnPath}
                    guestMode={guestMode}
                  />
                </div>
                {externalLinks.length ? <ExternalLinksRow links={externalLinks} title="External Links" compact /> : null}
              </div>
            </div>
            </div>

            <div className="divide-y divide-white/10 rounded-lg border border-white/10 bg-white/[0.03] px-4 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:min-w-[17rem] lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
              <div className="py-3 sm:px-3 lg:px-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Raised</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{primaryCampaign?.totalRaised ?? "Not reported"}</p>
              </div>
              <div className="py-3 sm:px-3 lg:px-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">Campaign status</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{primaryCampaign?.campaignStatus ?? "Active"}</p>
              </div>
              <div className="py-3 sm:px-3 lg:px-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Polling</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{primaryCampaign?.pollingSummary ?? "No public poll"}</p>
              </div>
            </div>
          </div>

          {followerSnapshot ? <ProfileFollowerSnapshot snapshot={followerSnapshot} /> : null}

          <details className="rounded-lg border border-white/10 bg-white/[0.02]">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-200 hover:text-cyan-100">
              Profile and accountability signals
            </summary>
            <div className="border-t border-white/10 p-4">
              <ProfileSignalsPanel signals={signals} />
            </div>
          </details>
        </div>
      </section>
      {progression ? (
        <details className="dd-panel-muted rounded-lg">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-200">How this candidate profile is connected to civic progression</summary>
          <div className="border-t border-white/10 p-4">
            <RoleProgressionContext progression={progression} title="Citizen to candidate progression" />
          </div>
        </details>
      ) : null}
    </div>
  );
}
