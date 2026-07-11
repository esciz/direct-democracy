import { Suspense } from "react";
import Link from "next/link";

import { ExternalLinksRow } from "@/components/domain/external-links-row";
import { ProfileCivicActivitySection } from "@/components/domain/profile-civic-activity-section";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { ProfileDetailsForm } from "@/components/domain/profile-details-form";
import { RoleBadge } from "@/components/domain/role-badge";
import { PublicVisibilityToggle } from "@/components/domain/public-visibility-toggle";
import { VerificationStatusCard } from "@/components/domain/verification-status-card";
import { ParticipationReadinessPanel } from "@/components/domain/participation-readiness-panel";
import { AccountParticipationStatusCard } from "@/components/domain/account-participation-status-card";
import { hasAdminDashboardPermission } from "@/lib/admin/permissions";
import { signOutCurrentUser } from "@/lib/auth/actions";
import { getCitizenActionDashboard } from "@/lib/citizen-actions/dashboard";
import { getAccountParticipationStatus } from "@/lib/civic-signals/account-participation-status";
import { getCurrentSessionUser, getCurrentUser } from "@/lib/server/auth-session";
import { getRoleLabel } from "@/lib/auth/roles";
import { getVerificationLabel } from "@/lib/auth/verification";
import { getParticipationReadiness } from "@/lib/identity/participation-readiness";
import { getUserProfileContent } from "@/lib/profile/details";
import { getSafeUserProgressionSummary } from "@/lib/profile/progression";
import { getSafeReputationSummary } from "@/lib/profile/reputation";

type ProfilePageProps = {
  searchParams?: Promise<{
    visibility?: string;
    details?: string;
    externalLinks?: string;
    onboarding?: string;
  }>;
};

function normalizeMediaUrl(value: string | null | undefined, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  console.error("Profile page received an unsupported media URL:", trimmed);
  return fallback;
}

function getPublicProfileHref(role: string, userId: string) {
  if (role === "candidate") {
    return `/candidates/${userId}`;
  }

  if (role === "official") {
    return `/officials/${userId}`;
  }

  return `/citizens/${userId}`;
}

function ProfileMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function ProfileActionLink({
  href,
  label,
  detail,
  primary = false,
}: {
  href: string;
  label: string;
  detail: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "group rounded-3xl bg-slate-950 p-4 text-white shadow-card transition hover:-translate-y-0.5 hover:bg-slate-800"
          : "group rounded-3xl border border-slate-200 bg-white/80 p-4 text-slate-700 transition hover:-translate-y-0.5 hover:border-civic-400 hover:text-civic-800"
      }
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className={primary ? "mt-2 block text-xs leading-5 text-slate-200" : "mt-2 block text-xs leading-5 text-slate-500"}>
        {detail}
      </span>
    </Link>
  );
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [currentUser, sessionUser] = await Promise.all([getCurrentUser(), getCurrentSessionUser()]);
  const params = searchParams ? await searchParams : undefined;
  const profileContent = await getUserProfileContent(currentUser.id);
  const safeName = currentUser?.name ?? "Demo User";
  const safeUsername = currentUser?.username ?? "demo-user";
  const safeJurisdiction = currentUser?.jurisdictionName ?? "Your jurisdiction";
  const safeBio = currentUser?.bio ?? "Your civic profile is loading.";
  const safeProfileImageUrl = normalizeMediaUrl(profileContent?.profileImageUrl, "");
  const safeBannerImageUrl = normalizeMediaUrl(profileContent?.bannerImageUrl, "/community/cc.webp");
  const localIssues = Array.isArray(profileContent?.localIssues) ? profileContent.localIssues : [];
  const stateIssues = Array.isArray(profileContent?.stateIssues) ? profileContent.stateIssues : [];
  const nationalIssues = Array.isArray(profileContent?.nationalIssues) ? profileContent.nationalIssues : [];
  const publicPreviewIssues = [
    ...localIssues.map((entry) => entry.value),
    ...stateIssues.map((entry) => entry.value),
    ...nationalIssues.map((entry) => entry.value),
  ].filter((value, index, values) => value && values.indexOf(value) === index).slice(0, 3);
  const externalLinks = Array.isArray(profileContent?.externalLinks) ? profileContent.externalLinks : [];
  const progression = getSafeUserProgressionSummary(currentUser.role);
  const completedSteps = progression.completedStepCount;
  const reputation = getSafeReputationSummary(currentUser);
  const participationReadiness = getParticipationReadiness(currentUser);
  const accountParticipationStatus = await getAccountParticipationStatus(currentUser, { signedIn: Boolean(sessionUser) });
  const canAccessAdminDashboard = hasAdminDashboardPermission(sessionUser, "dataops.view");
  const actionDashboard = await getCitizenActionDashboard(currentUser);
  const publicProfileHref = getPublicProfileHref(currentUser.role, currentUser.id);
  const verificationLabel = getVerificationLabel(currentUser.verificationState);
  const roleLabel = getRoleLabel(currentUser.role);
  const isPublicProfile = !currentUser.isAnonymousPublic;
  const nextProgressionStep = progression.steps.find((step) => step.state === "upcoming")?.label ?? "Complete";
  const primaryAction =
    currentUser.verificationState === "voterVerified"
      ? {
          href: "/voting",
          label: "Review voting cards",
          detail: "Answer source-backed civic questions and keep your signal current.",
        }
      : {
          href: "/account/verification#voter-review",
          label: "Complete Nevada voter verification",
          detail: "Unlock verified voting, petitions, and official messaging.",
        };

  return (
    <div className="space-y-6 py-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-card backdrop-blur">
        <div className="relative min-h-[18rem] overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(110deg, rgba(2, 6, 23, 0.9), rgba(15, 23, 42, 0.72) 48%, rgba(20, 184, 166, 0.2)), url(${safeBannerImageUrl})`,
            }}
          />
          <div className="relative grid gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col justify-between gap-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur">
                  {verificationLabel}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur">
                  {roleLabel}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur">
                  {isPublicProfile ? "Public profile on" : "Private profile"}
                </span>
              </div>

              <div className="max-w-3xl">
                <div className="flex flex-wrap items-end gap-4">
                  <ProfileImagePlaceholder
                    name={safeName}
                    size="lg"
                    imageUrl={safeProfileImageUrl || undefined}
                  />
                  <div className="min-w-0 pb-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-civic-100">Profile</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{safeName}</h1>
                    <p className="mt-2 text-sm text-slate-200">
                      @{safeUsername} · {safeJurisdiction}
                    </p>
                  </div>
                </div>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-100">
                  {safeBio}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/15 bg-slate-950/45 p-4 text-white shadow-card backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-100">Next best step</p>
              <h2 className="mt-2 text-xl font-semibold">{primaryAction.label}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-200">{primaryAction.detail}</p>
              <div className="mt-5 grid gap-2">
                <Link href={primaryAction.href} className="rounded-full bg-civic-400 px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-civic-300">
                  Continue
                </Link>
                <Link href="/profile/activity" className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/15">
                  View activity
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1fr_1fr_1fr_1.2fr]">
          <ProfileMetric
            label="Verification"
            value={verificationLabel}
            helper={currentUser.verificationState === "voterVerified" ? "Verified actions are unlocked." : "Nevada verification is still pending."}
          />
          <ProfileMetric
            label="Visibility"
            value={isPublicProfile ? "Public" : "Private"}
            helper={isPublicProfile ? "People can find your citizen profile." : "You are hidden from public people browsing."}
          />
          <ProfileMetric
            label="Watchlist"
            value={`${actionDashboard.totals.followedItems}`}
            helper={`${actionDashboard.totals.sourceBackedItems} source-backed items followed.`}
          />
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quick actions</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={publicProfileHref} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-civic-400 hover:text-civic-800">
                Public view
              </Link>
              <Link href="/account/verification" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-civic-400 hover:text-civic-800">
                Verification
              </Link>
              <Link href="/feedback" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-civic-400 hover:text-civic-800">
                Feedback
              </Link>
              {canAccessAdminDashboard ? (
                <Link href="/admin" className="rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800">
                  Admin Dashboard
                </Link>
              ) : null}
              <form action={signOutCurrentUser}>
                <button type="submit" className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {params?.visibility === "updated" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your public citizen visibility was updated.
        </section>
      ) : null}
      {params?.details === "updated" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your profile details were updated.
        </section>
      ) : null}
      {params?.externalLinks === "invalid" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          One or more external links were skipped because they were not valid `http` or `https` URLs.
        </section>
      ) : null}
      {params?.onboarding === "started" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Welcome to onboarding. Start with your profile details, then complete Nevada voter verification when you need voter-only civic actions. Non-Nevada testers can still browse and review the flow, but local civic data is Nevada-focused right now.
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ProfileActionLink
          href={primaryAction.href}
          label={primaryAction.label}
          detail={primaryAction.detail}
          primary
        />
        <ProfileActionLink
          href="/profile/updates"
          label="Check your watchlist"
          detail="See followed communities, issues, meetings, and decisions that need attention."
        />
        <ProfileActionLink
          href={publicProfileHref}
          label="Review public profile"
          detail={isPublicProfile ? "Preview what other users can see." : "See the public page before making it visible."}
        />
        <ProfileActionLink
          href="/profile/reputation"
          label="Understand your standing"
          detail={`Current label: ${reputation.label}. Next milestone: ${nextProgressionStep}.`}
        />
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Action Loop</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Your civic watchlist</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Follow decisions, projects, meetings, issues, and communities to keep a personal list of what changed and what to check next.
            </p>
            <Link href="/profile/updates" className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
              View updates
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-600">
            <span className="rounded-2xl bg-slate-50 px-3 py-2">{actionDashboard.totals.followedItems} followed</span>
            <span className="rounded-2xl bg-civic-50 px-3 py-2 text-civic-700">{actionDashboard.totals.sourceBackedItems} source-backed</span>
            <span className="rounded-2xl bg-slate-50 px-3 py-2">{actionDashboard.totals.updateEligibleItems} update-ready</span>
          </div>
        </div>

        {actionDashboard.items.length ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {actionDashboard.items.slice(0, 6).map((item) => (
              <article key={item.id} className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">{item.label}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${item.sourceBacked ? "bg-civic-50 text-civic-700" : "bg-amber-50 text-amber-700"}`}>
                    {item.sourceBacked ? "Source-backed" : "Limited source"}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{item.updateTrigger}</p>
                <Link href={item.href} className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                  {item.nextActionLabel}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            Nothing followed yet. Open a community, decision, project, meeting, or issue and use the follow button to start a personal civic watchlist.
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Public Profile Preview</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">How your public profile appears</h2>
            <p className="mt-2 text-sm text-slate-600">
              Review the public-facing version of your civic profile, including your bio, top issues, and public links.
            </p>
          </div>
          <Link
            href={getPublicProfileHref(currentUser.role, currentUser.id)}
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Open public profile
          </Link>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start gap-4">
            <ProfileImagePlaceholder
              name={safeName}
              size="sm"
              imageUrl={safeProfileImageUrl || undefined}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-ink">{safeName}</h3>
                <RoleBadge role={currentUser.role} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                @{safeUsername} · {safeJurisdiction}
              </p>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{safeBio}</p>
              {publicPreviewIssues.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {publicPreviewIssues.map((issue) => (
                    <span key={issue} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {issue}
                    </span>
                  ))}
                </div>
              ) : (
                  <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 ring-1 ring-slate-200">
                    No public top issues selected yet.
                  </div>
                )}
              {externalLinks.length ? (
                <div className="mt-4">
                  <ExternalLinksRow links={externalLinks} title="Public Presence" compact />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Progression</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Current civic progression</h2>
            <p className="mt-2 text-sm text-slate-600">
              Track your current civic role and the next milestones available in the Direct Democracy participation path.
            </p>
          </div>
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
            Current: {getRoleLabel(progression.currentRole)}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current status</p>
            <p className="mt-2 text-lg font-semibold text-ink">{getRoleLabel(progression.currentRole)}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Completed milestones</p>
            <p className="mt-2 text-lg font-semibold text-ink">
              {completedSteps} / {progression.steps.length}
            </p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Next milestone</p>
            <p className="mt-2 text-lg font-semibold text-ink">
              {nextProgressionStep}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
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
                {step.state === "current" ? "Current" : step.state === "complete" ? "Complete" : "Upcoming"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">
          {progression.nextStepRequirement}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Reputation</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Current reputation summary</h2>
            <p className="mt-2 text-sm text-slate-600">
              See a high-level view of how your civic participation and public contributions are being represented.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {reputation.label}
            </span>
            <Link
              href="/profile/reputation"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Details
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Reputation tier</p>
            <p className="mt-2 text-lg font-semibold text-ink">{reputation.tier}</p>
          </div>
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Current label</p>
            <p className="mt-2 text-lg font-semibold text-ink">{reputation.label}</p>
          </div>
        </div>

        <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">
          {reputation.summary}
        </div>
      </section>

      <Suspense
        fallback={
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Civic Activity</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Recent public contributions</h2>
              <p className="mt-2 text-sm text-slate-600">Loading a compact activity summary without blocking the rest of your profile.</p>
            </div>
          </section>
        }
      >
        <ProfileCivicActivitySection userId={currentUser.id} />
      </Suspense>

      <VerificationStatusCard user={currentUser} content={profileContent} />
      <AccountParticipationStatusCard status={accountParticipationStatus} />
      <ParticipationReadinessPanel summary={participationReadiness} />
      <ProfileDetailsForm user={currentUser} content={profileContent} />
      {(currentUser.role === "citizen" || currentUser.role === "trustedCitizen") ? (
        <PublicVisibilityToggle isPublic={!currentUser.isAnonymousPublic} />
      ) : null}
    </div>
  );
}
