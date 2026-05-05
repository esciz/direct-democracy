import { Suspense } from "react";
import Link from "next/link";

import { ExternalLinksRow } from "@/components/domain/external-links-row";
import { ProfileCivicActivitySection } from "@/components/domain/profile-civic-activity-section";
import { ProfileImagePlaceholder } from "@/components/domain/profile-image-placeholder";
import { ProfileDetailsForm } from "@/components/domain/profile-details-form";
import { RoleBadge } from "@/components/domain/role-badge";
import { PublicVisibilityToggle } from "@/components/domain/public-visibility-toggle";
import { VerificationStatusCard } from "@/components/domain/verification-status-card";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getRoleLabel } from "@/lib/auth/roles";
import { getVerificationLabel } from "@/lib/auth/verification";
import { getUserProfileContent } from "@/lib/profile/details";
import { getSafeUserProgressionSummary } from "@/lib/profile/progression";
import { getSafeReputationSummary } from "@/lib/profile/reputation";
import { getPendingStudentVerification } from "@/lib/server/auth-verification";

type ProfilePageProps = {
  searchParams?: Promise<{
    visibility?: string;
    details?: string;
    externalLinks?: string;
    studentMode?: string;
    studentDemoCode?: string;
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

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const currentUser = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const [profileContent, pendingStudentVerification] = await Promise.all([
    getUserProfileContent(currentUser.id),
    getPendingStudentVerification(currentUser.id),
  ]);
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

  return (
    <div className="space-y-6 py-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-card backdrop-blur">
        <div className="relative h-56 overflow-hidden sm:h-64">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.1), rgba(15, 23, 42, 0.82)), url(${safeBannerImageUrl})`,
            }}
          />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-20 sm:px-6 sm:pb-24">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                {getVerificationLabel(currentUser.verificationState)}
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                {getRoleLabel(currentUser.role)}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{safeName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-100">
              <span>
                @{safeUsername} · {safeJurisdiction}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-6 sm:px-6">
          <div className="-mt-14 sm:-mt-16">
            <ProfileImagePlaceholder
              name={safeName}
              size="lg"
              imageUrl={safeProfileImageUrl || undefined}
            />
          </div>
        </div>
      </section>

      <PageIntro
        eyebrow="Profile"
        title="Your profile"
        description="Manage your public identity, verification status, civic activity, and profile details in one place."
        meta={
          <>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {getVerificationLabel(currentUser.verificationState)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {getRoleLabel(currentUser.role)}
            </span>
          </>
        }
        actions={
          <Link href="/profile/activity" className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            View activity
          </Link>
        }
      />

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
      {params?.studentMode === "code-sent" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Student Mode verification code sent. Demo code: <span className="font-semibold">{params.studentDemoCode ?? "Check your inbox"}</span>
        </section>
      ) : null}
      {params?.studentMode === "verified" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Student Mode is now enabled and your .edu email was verified.
        </section>
      ) : null}
      {params?.onboarding === "started" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Welcome to onboarding. Start with your profile details, then complete voter verification, and optionally enable Student Mode if it applies to you.
        </section>
      ) : null}

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
              {progression.steps.find((step) => step.state === "upcoming")?.label ?? "Complete"}
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
                    ? "rounded-3xl bg-civic-50 p-4 text-civic-950"
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

      <VerificationStatusCard user={currentUser} content={profileContent} pendingStudentVerification={pendingStudentVerification} />
      <ProfileDetailsForm user={currentUser} content={profileContent} />
      {(currentUser.role === "citizen" || currentUser.role === "trustedCitizen") ? (
        <PublicVisibilityToggle isPublic={!currentUser.isAnonymousPublic} />
      ) : null}
    </div>
  );
}
