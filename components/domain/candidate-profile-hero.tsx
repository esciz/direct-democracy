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
          card: "border-white/10 bg-[linear-gradient(160deg,rgba(8,15,28,0.98),rgba(3,10,20,0.94))] text-white",
          label: "text-slate-400",
          value: "text-white",
        }
      : tone === "civic"
        ? {
            card: "border-emerald-300/18 bg-[linear-gradient(160deg,rgba(6,78,59,0.24),rgba(8,15,28,0.94))] text-emerald-50",
            label: "text-emerald-200/80",
            value: "text-emerald-50",
          }
        : {
            card: "border-amber-300/18 bg-[linear-gradient(160deg,rgba(120,53,15,0.3),rgba(8,15,28,0.94))] text-amber-50",
            label: "text-amber-200/80",
            value: "text-amber-50",
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
      <section className="dd-panel relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.1),transparent_30%)]" />
        <div className="relative space-y-6">
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
