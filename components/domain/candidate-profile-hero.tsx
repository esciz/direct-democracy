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

function ProfileStatCard({
  label,
  value,
  tone,
  compact = false,
}: {
  label: string;
  value: string | number;
  tone: "dark" | "civic" | "orange";
  compact?: boolean;
}) {
  const toneClasses =
    tone === "dark"
      ? {
          card: "border-slate-900 bg-slate-950 text-white",
          label: "text-slate-400",
          value: "text-white",
        }
      : tone === "civic"
        ? {
            card: "border-civic-200 bg-civic-50 text-civic-950",
            label: "text-civic-700",
            value: "text-civic-950",
          }
        : {
            card: "border-orange-200 bg-orange-50 text-orange-950",
            label: "text-orange-700",
            value: "text-orange-950",
          };

  return (
    <div className={`flex min-h-[7.25rem] flex-col justify-between rounded-[1.4rem] border p-4 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.45)] ${toneClasses.card}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${toneClasses.label}`}>{label}</p>
      <p className={`mt-4 font-semibold ${compact ? "text-base leading-6 sm:text-lg" : "text-[1.7rem] leading-none sm:text-[1.85rem]"} ${toneClasses.value}`}>
        {value}
      </p>
    </div>
  );
}

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
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
            <div className="flex items-start gap-5">
              <ProfileImagePlaceholder name={candidate.name} size="lg" imageUrl={candidate.profileImageUrl} />
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                    {candidate.profileType === "incumbentCandidate" ? "Incumbent candidate" : "Candidate"}
                  </span>
                  {!candidate.isClaimed ? <UnclaimedProfileBadge /> : null}
                  {candidate.partyText ? (
                    <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                      {candidate.partyText}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-ink">{candidate.name}</h1>
                  <p className="mt-2 text-sm text-slate-500">{candidate.jurisdictionName}</p>
                </div>
                <p className="max-w-3xl text-sm leading-7 text-slate-700">{candidate.bio}</p>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    {candidate.followerCount.toLocaleString()} followers
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
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

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[16.5rem] lg:grid-cols-1 xl:min-w-[23rem] xl:grid-cols-3">
              <ProfileStatCard label="Raised" value={primaryCampaign?.totalRaised ?? "TBD"} tone="dark" />
              <ProfileStatCard label="Campaign Status" value={primaryCampaign?.campaignStatus ?? "Active"} tone="civic" compact />
              <ProfileStatCard label="Polling Snapshot" value={primaryCampaign?.pollingSummary ?? "Not available"} tone="orange" compact />
            </div>
          </div>

          {followerSnapshot ? <ProfileFollowerSnapshot snapshot={followerSnapshot} /> : null}

          <ProfileSignalsPanel signals={signals} />
        </div>
      </section>
      {progression ? <RoleProgressionContext progression={progression} title="Citizen to candidate progression" /> : null}
    </div>
  );
}
