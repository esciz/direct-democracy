import Link from "next/link";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { disableStudentMode, startStudentModeVerification, confirmStudentModeVerification } from "@/lib/auth/student-mode-actions";
import { getCommunityById } from "@/lib/community/communities";
import {
  getLockedFeatureLabels,
  getStudentVerificationDescription,
  getStudentVerificationLabel,
  getUnlockedFeatureLabels,
  getVerificationDescription,
  getVerificationLabel,
  type PendingStudentVerification,
} from "@/lib/auth/verification";
import type { AuthUser, UserProfileContentSummary } from "@/types/domain";

type VerificationStatusCardProps = {
  user: AuthUser;
  content: UserProfileContentSummary;
  pendingStudentVerification: PendingStudentVerification | null;
};

export function VerificationStatusCard({ user, content, pendingStudentVerification }: VerificationStatusCardProps) {
  const primaryCommunity = getCommunityById(content.primaryCommunityId);
  const studentCampusId = user.studentCampusCommunityId ?? content.campusCommunityIds[0] ?? "";
  const campusCommunity = studentCampusId ? getCommunityById(studentCampusId) : null;
  const unlockedFeatures = getUnlockedFeatureLabels(user.verificationState);
  const lockedFeatures = getLockedFeatureLabels(user.verificationState);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Verification and onboarding</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{getVerificationLabel(user.verificationState)}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{getVerificationDescription(user.verificationState)}</p>
        </div>
        {user.verificationState !== "voterVerified" ? (
          <Link
            href={`/services?communityId=${content.primaryCommunityId}`}
            className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Complete voter verification
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Your communities</p>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-ink">Geographic:</span> {primaryCommunity?.name ?? user.jurisdictionName}
            </p>
            <p>
              <span className="font-semibold text-ink">Campus:</span> {campusCommunity?.name ?? "None selected"}
            </p>
          </div>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Campus onboarding</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Campus communities are a lighter entry point. Users can browse, follow, RSVP, and post from confirmed attendance before voter verification is complete.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-slate-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Student Mode</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">{getStudentVerificationLabel(user)}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{getStudentVerificationDescription(user)}</p>
          </div>
          {user.studentModeEnabled && user.studentVerified ? (
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
              .edu verified
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Associated campus</p>
            <p className="mt-2 text-sm font-semibold text-ink">{campusCommunity?.name ?? "Choose a campus in your profile first"}</p>
            {user.studentVerified && user.studentEmail ? (
              <p className="mt-2 text-sm text-slate-600">{user.studentEmail}</p>
            ) : null}
          </div>
          <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Student Mode unlocks</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Campus participation", "Event RSVP", "Confirmed attendee event posts", "Student badge"].map((feature) => (
                <span key={feature} className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700 ring-1 ring-civic-200">
                  {feature}
                </span>
              ))}
            </div>
          </div>
        </div>

        {!campusCommunity && !user.studentVerified ? (
          <div className="mt-4 rounded-3xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
            Select a campus community in your profile details first, then come back to enable Student Mode.
          </div>
        ) : null}

        {pendingStudentVerification ? (
          <form action={confirmStudentModeVerification} className="mt-4 grid gap-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 md:grid-cols-[1fr,auto] md:items-end">
            <div>
              <p className="text-sm font-semibold text-ink">Confirm your .edu code</p>
              <p className="mt-1 text-sm text-slate-600">
                We sent a code to <span className="font-semibold text-ink">{pendingStudentVerification.email}</span>. Enter it here to finish Student Mode.
              </p>
              <input
                type="text"
                name="studentVerificationCode"
                placeholder="Enter 6-digit code"
                className="mt-3 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
            </div>
            <FormSubmitButton
              idleLabel="Verify student email"
              pendingLabel="Verifying..."
              className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            />
          </form>
        ) : !user.studentVerified ? (
          <form action={startStudentModeVerification} className="mt-4 grid gap-4 rounded-3xl bg-white p-5 ring-1 ring-slate-200 md:grid-cols-[1fr,auto] md:items-end">
            <input type="hidden" name="campusCommunityId" value={campusCommunity?.id ?? ""} />
            <div>
              <p className="text-sm font-semibold text-ink">Enable Student Mode</p>
              <p className="mt-1 text-sm text-slate-600">Enter a .edu email to verify your campus identity. Student Mode stays separate from voter verification.</p>
              <input
                type="email"
                name="studentEmail"
                placeholder="you@school.edu"
                className="mt-3 w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              />
            </div>
            <FormSubmitButton
              idleLabel="Send verification code"
              pendingLabel="Sending..."
              disabled={!campusCommunity}
              className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            />
          </form>
        ) : (
          <form action={disableStudentMode} className="mt-4">
            <button
              type="submit"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Turn off Student Mode
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-civic-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-civic-700">Unlocked now</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unlockedFeatures.map((feature) => (
              <span key={feature} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-civic-200">
                {feature}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-orange-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-orange-700">Locked until voter verification</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lockedFeatures.length ? (
              lockedFeatures.map((feature) => (
                <span key={feature} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-orange-200">
                  {feature}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-orange-200">
                All civic features unlocked
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
