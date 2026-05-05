import { DonateButton } from "@/components/domain/donate-button";
import { ClaimProfileButton } from "@/components/domain/claim-profile-button";
import { ExternalLinksRow } from "@/components/domain/external-links-row";
import { FollowButton } from "@/components/domain/follow-button";
import { MessageProfileButton } from "@/components/domain/message-profile-button";
import { ProfileFollowerSnapshot } from "@/components/domain/profile-follower-snapshot";
import { ProfileSignalsPanel } from "@/components/domain/profile-signals-panel";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { RoleProgressionContext } from "@/components/domain/role-progression-context";
import { UnclaimedProfileBadge } from "@/components/domain/unclaimed-profile-badge";
import { getFollowerSnapshotByUserId } from "@/lib/social/follows";
import type { ExternalLinkSummary, OfficialProfileDetail, ProfileSignalsSummary, UserProgressionSummary } from "@/types/domain";

type OfficialProfileHeroProps = {
  official: OfficialProfileDetail;
  returnPath: string;
  progression?: UserProgressionSummary | null;
  showMessageButton?: boolean;
  signals: ProfileSignalsSummary;
  showClaimButton?: boolean;
  claimButtonLabel?: string;
  guestMode?: boolean;
  primaryPromiseCategory?: string | null;
  publicActionCount?: number;
  externalLinks?: ExternalLinkSummary[];
};

function ProfileStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "dark" | "civic" | "orange";
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
      <p className={`mt-4 text-[1.7rem] font-semibold leading-none sm:text-[1.85rem] ${toneClasses.value}`}>{value}</p>
    </div>
  );
}

export async function OfficialProfileHero({
  official,
  returnPath,
  progression,
  showMessageButton = false,
  signals,
  showClaimButton = true,
  claimButtonLabel = "Claim This Profile",
  guestMode = false,
  primaryPromiseCategory = null,
  publicActionCount = 0,
  externalLinks = [],
}: OfficialProfileHeroProps) {
  const followerSnapshot = official.linkedUserId ? await getFollowerSnapshotByUserId(official.linkedUserId) : null;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-5">
              <ProfileImagePlaceholder name={official.name} size="lg" imageUrl={official.profileImageUrl} />
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                      {official.officeTitle}
                  </span>
                  {!official.isClaimed ? <UnclaimedProfileBadge /> : null}
                  <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                    {official.party}
                  </span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-ink">{official.name}</h1>
                    <p className="mt-2 text-sm text-slate-500">{official.jurisdictionName}</p>
                  </div>
                  <p className="max-w-4xl text-sm leading-7 text-slate-700">{official.bio}</p>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      {official.followerCount.toLocaleString()} followers
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      {official.followingCount.toLocaleString()} following
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <DonateButton href={official.donationUrl} />
                    {!guestMode && official.viewerCanFollow && official.linkedUserId ? (
                      <FollowButton
                        targetUserId={official.linkedUserId}
                        returnPath={returnPath}
                        isFollowing={official.viewerIsFollowing}
                      />
                    ) : null}
                    {!guestMode && official.linkedUserId && showMessageButton ? <MessageProfileButton recipientUserId={official.linkedUserId} /> : null}
                    {!official.isClaimed && showClaimButton ? <ClaimProfileButton profileId={official.id} label={claimButtonLabel} guestMode={guestMode} /> : null}
                    <ShareActionMenu
                      target={{
                        entityType: "officialProfile",
                        entityId: official.id,
                        title: official.name,
                        href: `/officials/${official.id}`,
                        summary: official.bio,
                        issueTag: primaryPromiseCategory,
                      }}
                      returnPath={returnPath}
                      guestMode={guestMode}
                    />
                  </div>
                  {externalLinks.length ? <ExternalLinksRow links={externalLinks} title="External Links" compact /> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[22rem] xl:flex-none xl:grid-cols-1">
              <ProfileStatCard label="Followers" value={official.followerCount.toLocaleString()} tone="dark" />
              <ProfileStatCard label="Following" value={official.followingCount.toLocaleString()} tone="civic" />
              <ProfileStatCard label="Public Actions" value={publicActionCount} tone="orange" />
            </div>
          </div>

          {followerSnapshot ? <ProfileFollowerSnapshot snapshot={followerSnapshot} /> : null}

          <ProfileSignalsPanel signals={signals} />
        </div>
      </section>
      {progression ? <RoleProgressionContext progression={progression} title="Citizen to official progression" /> : null}
    </div>
  );
}
