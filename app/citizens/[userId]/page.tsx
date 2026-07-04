import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { seedUsers } from "@/lib/auth/mock-users";
import { isGuestUser } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getUserProfileContent } from "@/lib/profile/details";
import { getSafeUserProgressionSummary } from "@/lib/profile/progression";
import { getSafeReputationSummary } from "@/lib/profile/reputation";
import { getVisibilityOverrides } from "@/lib/profile/visibility";
import { getSafeCivicActivitySummary } from "@/lib/server/profile-activity";
import { getLightweightFollowState } from "@/lib/social/follows";
import { FollowButton } from "@/components/domain/follow-button";
import { ExternalLinksRow } from "@/components/domain/external-links-row";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { RoleBadge } from "@/components/domain/role-badge";
import { PageIntro } from "@/components/ui/page-intro";

type CitizenProfilePageProps = {
  params: Promise<{
    userId: string;
  }>;
};

function isVisiblePublicCitizen(userId: string, isAnonymousPublic: boolean, overrides: Record<string, boolean>) {
  return typeof overrides[userId] === "boolean" ? overrides[userId] : !isAnonymousPublic;
}

function IssueChip({ issue }: { issue: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200">
      {issue}
    </span>
  );
}

async function PublicCitizenActivitySection({ userId }: { userId: string }) {
  const summary = await getSafeCivicActivitySummary(userId).catch(() => null);

  if (!summary) {
    return (
      <section className="dd-panel-muted rounded-[1.75rem] p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Civic Activity</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Recent public activity</h2>
        <p className="mt-3 text-sm text-slate-400">Public activity could not be loaded right now, but the main profile is still available.</p>
      </section>
    );
  }

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Civic Activity</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Recent public activity</h2>
          <p className="mt-2 text-sm text-slate-400">A lightweight summary of public work, kept preview-first so the route stays fast.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200">
          {summary.counts.post + summary.counts.debate + summary.counts.petition + summary.counts.event + summary.counts.interview} recent contributions
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Posts</p>
          <p className="mt-2 text-lg font-semibold text-ink">{summary.counts.post}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Debates</p>
          <p className="mt-2 text-lg font-semibold text-ink">{summary.counts.debate}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Petitions</p>
          <p className="mt-2 text-lg font-semibold text-ink">{summary.counts.petition}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Events & Interviews</p>
          <p className="mt-2 text-lg font-semibold text-ink">{summary.counts.event + summary.counts.interview}</p>
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Recent preview</h3>
        {summary.recentItems.length ? (
          <div className="mt-4 space-y-3">
            {summary.recentItems.map((item) => (
              <Link key={`${item.kind}-${item.id}`} href={item.href} className="block rounded-3xl bg-white p-4 transition hover:bg-civic-50/40">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{item.meta}</span>
                <p className="mt-3 text-sm font-semibold text-ink">{item.title}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl bg-white px-4 py-3 text-sm text-slate-500">No public activity to preview yet.</div>
        )}
      </div>
    </section>
  );
}

function PublicCitizenActivityFallback() {
  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Civic Activity</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Recent public activity</h2>
      <p className="mt-3 text-sm text-slate-400">Loading a lightweight public activity summary.</p>
    </section>
  );
}

export default async function CitizenProfilePage({ params }: CitizenProfilePageProps) {
  const { userId } = await params;
  const viewer = await getCurrentUser();
  const user = seedUsers.find((entry) => entry.id === userId);

  if (!user || (user.role !== "citizen" && user.role !== "trustedCitizen")) {
    notFound();
  }

  const overrides = await getVisibilityOverrides();

  if (!isVisiblePublicCitizen(user.id, user.isAnonymousPublic, overrides)) {
    notFound();
  }

  const [content, followState] = await Promise.all([
    getUserProfileContent(user.id),
    getLightweightFollowState(viewer.id, user.id, user.followerCount),
  ]);
  const reputation = getSafeReputationSummary(user);
  const progression = getSafeUserProgressionSummary(user.role);
  const topIssues = [...content.localIssues, ...content.stateIssues, ...content.nationalIssues]
    .map((entry) => entry.value)
    .filter(Boolean)
    .filter((issue, index, values) => values.indexOf(issue) === index)
    .slice(0, 6);
  const externalLinks = Array.isArray(content.externalLinks) ? content.externalLinks : [];

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Citizen Profile"
        title={user.name}
        description="A lightweight public profile that loads core identity first, then streams public summaries without blocking the route."
      />

      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-card backdrop-blur">
        <div className="relative h-56 overflow-hidden sm:h-64">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.82)), url(${content.bannerImageUrl || "/community/cc.webp"})`,
            }}
          />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-20 sm:px-6 sm:pb-24">
            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge role={user.role} />
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">@{user.username}</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{user.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-100">
              <span className="rounded-full bg-white/15 px-3 py-1 font-semibold text-white backdrop-blur">
                {followState.followerCount.toLocaleString()} followers
              </span>
              <span>{user.jurisdictionName}</span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-6 sm:px-6">
          <div className="-mt-14 sm:-mt-16">
            <ProfileImagePlaceholder name={user.name} size="lg" imageUrl={content.profileImageUrl || undefined} />
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Public summary</p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-700">{user.bio}</p>
            </div>

            {topIssues.length ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Top issues</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topIssues.map((issue) => (
                    <IssueChip key={issue} issue={issue} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No public top issues shared yet.</div>
            )}

            {externalLinks.length ? (
              <ExternalLinksRow
                links={externalLinks}
                title="Public Presence"
                description="Optional public links for credibility and discovery."
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            {!isGuestUser(viewer) && followState.viewerCanFollow ? (
              <FollowButton targetUserId={user.id} returnPath={`/citizens/${user.id}`} isFollowing={followState.viewerIsFollowing} />
            ) : null}
            <Link
              href={`/people?q=${encodeURIComponent(user.name)}`}
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Find similar profiles
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Reputation</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{reputation.tier}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{reputation.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Trust label · {reputation.label}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              Following · {followState.followingCount.toLocaleString()}
            </span>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Progression</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{progression.steps.find((step) => step.state === "current")?.label ?? "Citizen"}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{progression.nextStepRequirement}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {progression.steps.map((step) => (
              <div
                key={step.role}
                className={
                  step.state === "current"
                    ? "rounded-3xl bg-slate-950 p-4 text-white"
                    : step.state === "complete"
                      ? "rounded-3xl bg-civic-50 p-4 text-civic-900"
                      : "rounded-3xl bg-slate-50 p-4 text-slate-600"
                }
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{step.label}</p>
                <p className="mt-2 text-sm">
                  {step.state === "current" ? "Current role" : step.state === "complete" ? "Completed" : "Possible next role"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>

      <Suspense fallback={<PublicCitizenActivityFallback />}>
        <PublicCitizenActivitySection userId={user.id} />
      </Suspense>
    </div>
  );
}
