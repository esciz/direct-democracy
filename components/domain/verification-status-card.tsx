import Link from "next/link";

import { getCommunityById } from "@/lib/community/communities";
import {
  getLockedFeatureLabels,
  getUnlockedFeatureLabels,
  getVerificationDescription,
  getVerificationLabel,
} from "@/lib/auth/verification";
import type { AuthUser, UserProfileContentSummary } from "@/types/domain";

type VerificationStatusCardProps = {
  user: AuthUser;
  content: UserProfileContentSummary;
};

export function VerificationStatusCard({ user, content }: VerificationStatusCardProps) {
  const primaryCommunity = getCommunityById(content.primaryCommunityId);
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
            href="/account/verification#voter-review"
            className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Complete Nevada voter verification
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
              <span className="font-semibold text-ink">Jurisdiction:</span> {primaryCommunity?.primaryJurisdictionName ?? user.jurisdictionName}
            </p>
          </div>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Civic onboarding</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Choose your primary Nevada community, follow local issues, and complete Nevada voter verification when you are ready to vote, sign petitions, or message officials.
          </p>
        </div>
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
