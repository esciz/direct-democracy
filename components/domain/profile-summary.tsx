import Link from "next/link";

import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { ReputationBadges } from "@/components/domain/reputation-badges";
import { RevealIconChip } from "@/components/domain/reveal-icon-chip";
import { RoleBadge } from "@/components/domain/role-badge";
import { getVerificationLabel } from "@/lib/auth/verification";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { getFavoriteSpotCategoryLabel, getProfileTagCategoryLabel } from "@/lib/profile/options";
import { getIssueVisualToken, getPlaceVisualToken, getTagVisualToken } from "@/lib/ui/visual-tokens";
import type { PublicCitizenProfileSummary, UserReputationSummary, UserSocialSummary, UserSummary } from "@/types/domain";

type ProfileSummaryProps = {
  user: UserSummary;
  social: UserSocialSummary;
  reputation: UserReputationSummary;
  profile?: PublicCitizenProfileSummary | null;
};

export function ProfileSummary({ user, social, reputation, profile }: ProfileSummaryProps) {
  const defaultCommunityId = getDefaultCommunityForUser(user)?.id ?? "carson-city";
  const studentCampusName =
    profile?.studentProfile?.campusName ?? getCommunityById(user.studentCampusCommunityId ?? profile?.campusCommunityIds[0] ?? "")?.name ?? null;

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-slate-100">
        <div
          className="h-40 w-full bg-cover bg-center sm:h-52"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.15), rgba(15,23,42,0.7)), url(${profile?.bannerImageUrl || "/community/cc.webp"})` }}
        />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <div className="flex items-end gap-4">
            <ProfileImagePlaceholder name={user.name} size="lg" imageUrl={profile?.profileImageUrl} />
            <div className="pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={user.role} />
                <ReputationBadges trustLevel={reputation.trustLevel} influenceLevel={reputation.influenceLevel} compact />
                {user.studentModeEnabled && user.studentVerified ? (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">Student Verified</span>
                ) : null}
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{user.name}</h2>
              <p className="mt-1 text-sm text-slate-200">
                @{user.username} · {user.jurisdictionName}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Profile overview</p>
          <p className="max-w-2xl text-sm leading-7 text-slate-600">{user.bio}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-civic-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-civic-700">Verification</p>
            <p className="mt-2 text-xl font-semibold text-civic-900">
              {getVerificationLabel(user.verificationState)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Followers</p>
            <p className="mt-2 text-xl font-semibold">{social.followerCount.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Following</p>
            <p className="mt-2 text-xl font-semibold text-ink">{social.followingCount.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-orange-700">Public mode</p>
            <p className="mt-2 text-xl font-semibold text-orange-900">
              {user.isAnonymousPublic ? "Anonymous" : "Named"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Trust level</p>
          <p className="mt-2 text-xl font-semibold text-ink">{reputation.trustLevel}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{reputation.trustSummary}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Influence level</p>
          <p className="mt-2 text-xl font-semibold text-ink">{reputation.influenceLevel}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{reputation.influenceSummary}</p>
        </div>
      </div>

      {user.studentModeEnabled && user.studentVerified ? (
        <div className="mt-6 rounded-3xl bg-slate-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Student profile</p>
              <p className="mt-2 text-xl font-semibold text-ink">{studentCampusName ?? "Campus community selected"}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Student Mode is enabled. Campus identity stays separate from voter-based civic permissions.
              </p>
            </div>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">Student Verified</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(profile?.studentProfile?.favoriteClasses ?? []).length ? (
              profile?.studentProfile?.favoriteClasses.map((value) => (
                <span key={value} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {value}
                </span>
              ))
            ) : (
              <span className="text-sm text-slate-500">Add favorite classes in your profile details to personalize your campus identity.</span>
            )}
          </div>
        </div>
      ) : null}

      {reputation.trustedCitizenReputation ? (
        <div className="mt-6 rounded-3xl bg-slate-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Trusted Citizen reputation</p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {reputation.trustedCitizenReputation.score} · {reputation.trustedCitizenReputation.tier}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              0-100 score
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{reputation.trustedCitizenReputation.summary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Truth</p>
              <p className="mt-2 text-xl font-semibold text-ink">{reputation.trustedCitizenReputation.breakdown.truth}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Debate</p>
              <p className="mt-2 text-xl font-semibold text-ink">{reputation.trustedCitizenReputation.breakdown.debate}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Community trust</p>
              <p className="mt-2 text-xl font-semibold text-ink">{reputation.trustedCitizenReputation.breakdown.communityTrust}</p>
            </div>
          </div>
        </div>
      ) : null}

      {social.trustedProgressByCommunity.length ? (
        <div className="mt-6 rounded-3xl bg-slate-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Trusted status by community</p>
              <p className="mt-1 text-sm text-slate-600">
                Trusted Citizen status now depends on voter verification, follower support, and real engagement in each community.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              Community-scoped
            </span>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {social.trustedProgressByCommunity.map((scope) => (
              <div key={scope.communityId} className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{scope.communityScope}</p>
                    <p className="mt-2 text-lg font-semibold text-ink">{scope.communityName}</p>
                  </div>
                  <span
                    className={
                      scope.alreadyTrusted
                        ? "rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700"
                        : scope.eligible
                          ? "rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700"
                          : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                    }
                  >
                    {scope.alreadyTrusted ? "Trusted here" : scope.eligible ? "Eligible now" : "In progress"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Verification</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{scope.voterVerified ? "Complete" : "Needed"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Followers</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {scope.currentFollowers.toLocaleString()} / {scope.followerTarget.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Engaged supporters</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {scope.engagedFollowerCount.toLocaleString()} / {scope.engagementTarget.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <span>Follower threshold</span>
                      <span>{scope.followerProgressPercent}%</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                      <div className="h-2.5 rounded-full bg-civic-500" style={{ width: `${scope.followerProgressPercent}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <span>Engagement validation</span>
                      <span>{scope.engagementProgressPercent}%</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-slate-200">
                      <div className="h-2.5 rounded-full bg-orange-500" style={{ width: `${scope.engagementProgressPercent}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Requires about {scope.engagementThresholdPercent}% of followers engaging, with a minimum floor for real activity.
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{scope.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {profile ? (
        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Top local issues</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.topIssuesByScope.local.length ? (
                profile.topIssuesByScope.local.map((issue) => (
                  <RevealIconChip
                    key={issue}
                    {...getIssueVisualToken(issue)}
                    href={`/voting?search=${encodeURIComponent(issue)}`}
                    tone="civic"
                  />
                ))
              ) : (
                <span className="text-sm text-slate-500">No local issues saved yet.</span>
              )}
            </div>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Favorite spots</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.favoriteSpots.length ? (
                profile.favoriteSpots.map((spot) => (
                  <span
                    key={`${spot.name}-${spot.category}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                    title={`${spot.name} · ${getFavoriteSpotCategoryLabel(spot.category)}`}
                    aria-label={`${spot.name} · ${getFavoriteSpotCategoryLabel(spot.category)}`}
                  >
                    <span aria-hidden="true">{getPlaceVisualToken(spot.category, getFavoriteSpotCategoryLabel(spot.category)).icon}</span>
                    <span>{spot.name}</span>
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No favorite spots saved yet.</span>
              )}
            </div>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Groups and tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.groupAffiliations.length
                ? profile.groupAffiliations.map((group) => (
                    <Link
                      key={group.id}
                      href={`/my-community?communityId=${defaultCommunityId}&groupTag=${encodeURIComponent(group.name)}`}
                      className="rounded-full border border-civic-200 bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700"
                    >
                      {group.name}
                    </Link>
                  ))
                : null}
              {profile.groupTags.length ? (
                profile.groupTags.map((tag) => (
                  <RevealIconChip
                    key={tag}
                    {...getTagVisualToken(tag)}
                    href={`/my-community?communityId=${defaultCommunityId}&groupTag=${encodeURIComponent(tag)}`}
                    tone="orange"
                  />
                ))
              ) : !profile.groupAffiliations.length ? (
                <span className="text-sm text-slate-500">No group tags added yet.</span>
              ) : null}
              {!profile.groupTags.length && profile.groupAffiliations.length ? (
                <span className="text-sm text-slate-500">Formal affiliations are shown above.</span>
              ) : null}
            </div>
            {profile.groupAffiliations.length ? (
              <p className="mt-3 text-xs leading-6 text-slate-500">
                Formal civic affiliations are separate from personal profile tags so community issue views can show who is engaged.
              </p>
            ) : null}
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Background and identity</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Self-reported</p>
            {profile.background.politicalAffiliation || profile.background.profession || profile.background.experience ? (
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  {profile.background.politicalAffiliation ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Political affiliation</p>
                      <p className="mt-1 font-medium text-ink">{profile.background.politicalAffiliation}</p>
                    </div>
                  ) : null}
                  {profile.background.profession ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Profession</p>
                    <p className="mt-1 font-medium text-ink">{profile.background.profession}</p>
                  </div>
                ) : null}
                {profile.background.experience ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Experience</p>
                    <p className="mt-1 leading-6 text-slate-600">{profile.background.experience}</p>
                  </div>
                ) : null}
              </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No public self-reported background shared yet.</p>
              )}
            {profile.publicIdentityTags.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.publicIdentityTags.map((tag) => (
                  <span
                    key={`${tag.category}-${tag.value}`}
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    {getProfileTagCategoryLabel(tag.category)} · {tag.value}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No public identity or community tags shared yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
