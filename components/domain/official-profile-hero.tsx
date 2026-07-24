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
  imageSource?: { label: string; url: string } | null;
};

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
  imageSource = null,
}: OfficialProfileHeroProps) {
  const followerSnapshot = official.linkedUserId ? await getFollowerSnapshotByUserId(official.linkedUserId) : null;

  return (
    <div className="space-y-6">
      <section className="dd-panel rounded-lg p-6 sm:p-8">
        <div className="space-y-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-5">
                <div className="grid shrink-0 gap-2">
                  <ProfileImagePlaceholder name={official.name} size="lg" imageUrl={official.profileImageUrl} />
                  {imageSource ? (
                    <a href={imageSource.url} target="_blank" rel="noreferrer" className="max-w-28 text-center text-[11px] font-semibold leading-4 text-cyan-200 hover:text-cyan-100">
                      Verified photo
                    </a>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-cyan-300/18 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                      {official.officeTitle}
                  </span>
                  {!official.isClaimed ? <UnclaimedProfileBadge /> : null}
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                    {official.party}
                  </span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-50">{official.name}</h1>
                    <p className="mt-2 text-sm text-slate-400">{official.jurisdictionName}</p>
                    {official.sourceLabel ? (
                      <p className="mt-2 text-xs text-slate-500">Record source: {official.sourceLabel}</p>
                    ) : null}
                  </div>
                  <p className="max-w-4xl text-sm leading-7 text-slate-300">{official.bio}</p>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
                      {official.followerCount.toLocaleString()} followers
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
                    {official.websiteUrl ? (
                      <a
                        href={official.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100"
                      >
                        Official site
                      </a>
                    ) : null}
                  </div>
                  {(official.email || official.phone) ? (
                    <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                      {official.email ? <a href={`mailto:${official.email}`} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">Email</a> : null}
                      {official.phone ? <a href={`tel:${official.phone.replace(/[^+\d]/g, "")}`} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1">{official.phone}</a> : null}
                    </div>
                  ) : null}
                  {externalLinks.length ? <ExternalLinksRow links={externalLinks} title="External Links" compact /> : null}
                </div>
              </div>
            </div>

            <div className="divide-y divide-white/10 rounded-lg border border-white/10 bg-white/[0.03] px-4 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0 xl:w-[22rem] xl:flex-none xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
              <div className="py-3 sm:px-3 xl:px-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Office</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{official.officeTitle}</p>
              </div>
              <div className="py-3 sm:px-3 xl:px-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Community</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{official.jurisdictionName}</p>
              </div>
              <div className="py-3 sm:px-3 xl:px-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">Public actions</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{publicActionCount}</p>
              </div>
            </div>
          </div>

          {followerSnapshot ? <ProfileFollowerSnapshot snapshot={followerSnapshot} /> : null}

          <details className="rounded-lg border border-white/10 bg-white/[0.02]">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-200 hover:text-cyan-100">
              Accountability signals
            </summary>
            <div className="border-t border-white/10 p-4">
              <ProfileSignalsPanel signals={signals} />
            </div>
          </details>
        </div>
      </section>
      {progression ? (
        <details className="dd-panel-muted rounded-lg">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-200">How this official profile is connected to civic progression</summary>
          <div className="border-t border-white/10 p-4">
            <RoleProgressionContext progression={progression} title="Citizen to official progression" />
          </div>
        </details>
      ) : null}
    </div>
  );
}
