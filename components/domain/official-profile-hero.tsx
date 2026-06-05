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
      <section className="dd-panel relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.1),transparent_30%)]" />
        <div className="relative space-y-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-5">
              <ProfileImagePlaceholder name={official.name} size="lg" imageUrl={official.profileImageUrl} />
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
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                        Imported Nevada beta data{official.sourceLabel ? ` · ${official.sourceLabel}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <p className="max-w-4xl text-sm leading-7 text-slate-300">{official.bio}</p>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
                      {official.followerCount.toLocaleString()} followers
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
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
