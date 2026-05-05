import Link from "next/link";

import type { UserProgressionSummary } from "@/types/domain";

type UserProgressionMapProps = {
  progression: UserProgressionSummary;
};

export function UserProgressionMap({ progression }: UserProgressionMapProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">User progression</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">How your civic identity can evolve</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {progression.steps.map((step) => (
          <div
            key={step.role}
            className={
              step.state === "current"
                ? "rounded-3xl bg-slate-950 p-5 text-white"
                : step.state === "complete"
                  ? "rounded-3xl bg-civic-50 p-5 text-civic-900"
                  : "rounded-3xl bg-slate-50 p-5 text-slate-700"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{step.label}</p>
            <p className="mt-2 text-sm">
              {step.state === "current" ? "Current role" : step.state === "complete" ? "Completed" : "Possible next role"}
            </p>
            {step.requirement ? <p className="mt-3 text-xs leading-5 opacity-80">{step.requirement}</p> : null}
          </div>
        ))}
      </div>
      {progression.nextStepRequirement ? (
        <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">{progression.nextStepRequirement}</div>
      ) : null}
      {progression.trustedCitizenScopes.length ? (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">How trusted status works now</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Context-aware thresholds
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {progression.trustedCitizenScopes.map((scope) => (
              <div key={scope.communityId} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{scope.communityName}</p>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{scope.communityScope}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {scope.voterVerified ? "Voter verification complete." : "Voter verification required."} Follower target: {scope.followerTarget.toLocaleString()}. Engaged supporters needed: {scope.engagementTarget.toLocaleString()}.
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {progression.currentRole === "trustedCitizen" ? (
        <div className="mt-5 flex flex-col gap-4 rounded-3xl border border-civic-200 bg-civic-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-civic-900">You can explore running for office</p>
            <p className="mt-1 text-sm leading-6 text-civic-800">
              Trusted citizens already have visibility, issue clarity, and community trust signals that can help them evaluate a campaign path.
            </p>
          </div>
          <Link
            href="/run-for-office"
            className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Explore Running for Office
          </Link>
        </div>
      ) : null}
    </section>
  );
}
