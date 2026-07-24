import { Suspense } from "react";
import Link from "next/link";

import { AccountParticipationStatusCard } from "@/components/domain/account-participation-status-card";
import { ParticipationReadinessPanel } from "@/components/domain/participation-readiness-panel";
import { ProfileCivicActivitySection } from "@/components/domain/profile-civic-activity-section";
import { ProfileDetailsForm } from "@/components/domain/profile-details-form";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { PublicVisibilityToggle } from "@/components/domain/public-visibility-toggle";
import { VerificationStatusCard } from "@/components/domain/verification-status-card";
import { hasAdminDashboardPermission } from "@/lib/admin/permissions";
import { signOutCurrentUser } from "@/lib/auth/actions";
import { getRoleLabel } from "@/lib/auth/roles";
import { getVerificationLabel } from "@/lib/auth/verification";
import { getCitizenActionDashboard } from "@/lib/citizen-actions/dashboard";
import { getAccountParticipationStatus } from "@/lib/civic-signals/account-participation-status";
import { getParticipationReadiness } from "@/lib/identity/participation-readiness";
import { getUserProfileContent } from "@/lib/profile/details";
import { getSafeUserProgressionSummary } from "@/lib/profile/progression";
import { getSafeReputationSummary } from "@/lib/profile/reputation";
import { getCurrentSessionUser, getCurrentUser } from "@/lib/server/auth-session";

type ProfilePageProps = {
  searchParams?: Promise<{
    visibility?: string;
    details?: string;
    externalLinks?: string;
    onboarding?: string;
  }>;
};

function normalizeMediaUrl(value: string | null | undefined) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return "";
}

function getPublicProfileHref(role: string, userId: string) {
  if (role === "candidate") return `/candidates/${userId}`;
  if (role === "official") return `/officials/${userId}`;
  return `/citizens/${userId}`;
}

function ProfileStatus({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "civic" | "gold";
}) {
  const valueClass = tone === "civic" ? "text-emerald-200" : tone === "gold" ? "text-amber-200" : "text-slate-50";
  return (
    <div className="min-w-0 px-1 py-2 sm:px-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-base font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function ProfileAction({
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
      className={`block rounded-lg border px-4 py-3 transition ${
        primary
          ? "border-emerald-300/24 bg-emerald-500/12 text-emerald-50 hover:border-emerald-300/40 hover:bg-emerald-500/18"
          : "border-white/10 bg-white/[0.03] text-slate-100 hover:border-cyan-300/24 hover:bg-white/[0.06]"
      }`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-400">{detail}</span>
    </Link>
  );
}

function ProfileDisclosure({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group dd-panel-muted rounded-lg">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <span>
          <span className="block text-base font-semibold text-slate-100">{title}</span>
          <span className="mt-1 block text-sm text-slate-400">{detail}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 group-open:hidden">Open</span>
        <span className="hidden shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 group-open:inline">Close</span>
      </summary>
      <div className="space-y-5 border-t border-white/10 p-4 sm:p-6">{children}</div>
    </details>
  );
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const [currentUser, sessionUser] = await Promise.all([getCurrentUser(), getCurrentSessionUser()]);
  const params = searchParams ? await searchParams : undefined;
  const profileContent = await getUserProfileContent(currentUser.id);
  const safeName = currentUser.name ?? "Demo User";
  const safeUsername = currentUser.username ?? "demo-user";
  const safeJurisdiction = currentUser.jurisdictionName ?? "Your jurisdiction";
  const safeBio = currentUser.bio ?? "Add a short bio so neighbors understand the perspective you bring.";
  const safeProfileImageUrl = normalizeMediaUrl(profileContent.profileImageUrl);
  const progression = getSafeUserProgressionSummary(currentUser.role);
  const reputation = getSafeReputationSummary(currentUser);
  const participationReadiness = getParticipationReadiness(currentUser);
  const accountParticipationStatus = await getAccountParticipationStatus(currentUser, { signedIn: Boolean(sessionUser) });
  const actionDashboard = await getCitizenActionDashboard(currentUser);
  const publicProfileHref = getPublicProfileHref(currentUser.role, currentUser.id);
  const verificationLabel = getVerificationLabel(currentUser.verificationState);
  const roleLabel = getRoleLabel(currentUser.role);
  const isPublicProfile = !currentUser.isAnonymousPublic;
  const nextProgressionStep = progression.steps.find((step) => step.state === "upcoming")?.label ?? "Complete";
  const canAccessAdminDashboard = hasAdminDashboardPermission(sessionUser, "dataops.view");
  const primaryAction =
    currentUser.verificationState === "voterVerified"
      ? {
          href: "/voting",
          label: "Review your voting cards",
          detail: "Answer the decisions that are ready for you now.",
        }
      : {
          href: "/account/verification#voter-review",
          label: "Complete voter verification",
          detail: "Unlock verified voting, petitions, and messages to officials.",
        };
  const notice =
    params?.visibility === "updated"
      ? "Your public profile visibility was updated."
      : params?.details === "updated"
        ? "Your profile details were updated."
        : params?.externalLinks === "invalid"
          ? "One or more links were skipped because they were not valid web addresses."
          : params?.onboarding === "started"
            ? "Welcome. Start with the action below, then fill in profile details when you are ready."
            : null;

  return (
    <div className="space-y-6 py-8">
      {notice ? (
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50" role="status">
          {notice}
        </div>
      ) : null}

      <section className="dd-panel overflow-hidden rounded-lg">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
            <ProfileImagePlaceholder name={safeName} size="lg" imageUrl={safeProfileImageUrl || undefined} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {verificationLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                  {roleLabel}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{safeName}</h1>
              <p className="mt-2 text-sm text-slate-400">
                @{safeUsername} · {safeJurisdiction}
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{safeBio}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={publicProfileHref} className="dd-button-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">
                  View public profile
                </Link>
                <Link href="/profile/activity" className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-300/24">
                  All activity
                </Link>
              </div>
            </div>
          </div>

          <aside className="hidden border-l border-white/10 pl-6 lg:block">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Next step</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">{primaryAction.label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{primaryAction.detail}</p>
            <Link href={primaryAction.href} className="dd-button-primary mt-5 inline-flex w-full justify-center rounded-lg px-4 py-3 text-sm font-semibold">
              Continue
            </Link>
          </aside>
        </div>

        <div className="grid gap-2 border-t border-white/10 px-4 py-3 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
          <ProfileStatus
            label="Voting access"
            value={currentUser.verificationState === "voterVerified" ? "Ready" : "Verification needed"}
            detail={currentUser.verificationState === "voterVerified" ? "Verified participation is available." : "Finish verification before voter-only actions."}
            tone="civic"
          />
          <ProfileStatus
            label="Public profile"
            value={isPublicProfile ? "Visible" : "Private"}
            detail={isPublicProfile ? "People can find your profile." : "Your profile is hidden from public browsing."}
          />
          <ProfileStatus
            label="Watchlist"
            value={`${actionDashboard.totals.followedItems} followed`}
            detail={`${actionDashboard.totals.updateEligibleItems} item${actionDashboard.totals.updateEligibleItems === 1 ? "" : "s"} may have an update.`}
            tone="gold"
          />
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <section className="dd-panel-muted rounded-lg p-5 sm:p-6 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Watchlist</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-50">What you are following</h2>
            </div>
            <Link href="/profile/updates" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
              View all updates
            </Link>
          </div>

          {actionDashboard.items.length ? (
            <div className="mt-5 divide-y divide-white/10 border-y border-white/10">
              {actionDashboard.items.slice(0, 5).map((item) => (
                <article key={item.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</span>
                    <span className={item.sourceBacked ? "text-emerald-200" : "text-amber-200"}>
                      {item.sourceBacked ? "Verified source" : "Limited source"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">{item.summary}</p>
                    </div>
                    <Link href={item.href} className="shrink-0 text-sm font-semibold text-cyan-200 hover:text-cyan-100">
                      Open
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 border-y border-dashed border-white/12 py-5 text-sm leading-6 text-slate-400">
              Your watchlist is empty. Follow an issue, meeting, community, or public decision to see updates here.
            </div>
          )}
        </section>

        <section className="dd-panel-muted rounded-lg p-5 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Useful now</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">Keep moving</h2>
          <div className="mt-5 grid gap-3">
            <ProfileAction href={primaryAction.href} label={primaryAction.label} detail={primaryAction.detail} primary />
            <ProfileAction href="/profile/updates" label="Check your updates" detail="See what changed across the things you follow." />
            <ProfileAction href="/explore" label="Explore civic records" detail="Find issues, people, elections, meetings, and groups." />
            <ProfileAction href="/feedback" label="Send feedback" detail="Tell us what is confusing or missing." />
          </div>
        </section>
        <div className="lg:col-start-1 lg:row-start-2">
          <Suspense
            fallback={
              <section className="dd-panel-muted rounded-lg p-6">
                <p className="text-sm text-slate-400">Loading recent activity...</p>
              </section>
            }
          >
            <ProfileCivicActivitySection userId={currentUser.id} />
          </Suspense>
        </div>
      </div>

      <div className="space-y-3">
        <ProfileDisclosure title="Profile and privacy" detail="Edit your photo, bio, topics, public links, and visibility.">
          <ProfileDetailsForm user={currentUser} content={profileContent} />
          {currentUser.role === "citizen" || currentUser.role === "trustedCitizen" ? (
            <PublicVisibilityToggle isPublic={!currentUser.isAnonymousPublic} />
          ) : null}
        </ProfileDisclosure>

        <ProfileDisclosure title="Voting access" detail="Review verification, account status, and anything blocking participation.">
          <VerificationStatusCard user={currentUser} content={profileContent} />
          <AccountParticipationStatusCard status={accountParticipationStatus} />
          <ParticipationReadinessPanel summary={participationReadiness} />
        </ProfileDisclosure>

        <ProfileDisclosure title="Progress and reputation" detail="See milestones and how your public participation is summarized.">
          <div className="grid gap-4 sm:grid-cols-3">
            <ProfileStatus label="Current role" value={getRoleLabel(progression.currentRole)} detail="Your current participation level." />
            <ProfileStatus label="Milestones" value={`${progression.completedStepCount} of ${progression.steps.length}`} detail="Completed participation milestones." tone="civic" />
            <ProfileStatus label="Next milestone" value={nextProgressionStep} detail={progression.nextStepRequirement} tone="gold" />
          </div>
          <div className="border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reputation</p>
                <p className="mt-2 text-lg font-semibold text-slate-100">{reputation.label}</p>
              </div>
              <Link href="/profile/reputation" className="dd-button-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">
                View details
              </Link>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{reputation.summary}</p>
          </div>
        </ProfileDisclosure>

        <ProfileDisclosure title="Account" detail="Administrative access and sign-out controls.">
          <div className="flex flex-wrap gap-3">
            {canAccessAdminDashboard ? (
              <Link href="/admin" className="dd-button-secondary rounded-lg px-4 py-2.5 text-sm font-semibold">
                Admin dashboard
              </Link>
            ) : null}
            <form action={signOutCurrentUser}>
              <button type="submit" className="rounded-lg border border-rose-300/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/16">
                Sign out
              </button>
            </form>
          </div>
        </ProfileDisclosure>
      </div>
    </div>
  );
}
