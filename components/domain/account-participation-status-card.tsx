import Link from "next/link";

import type { AccountParticipationStatus } from "@/lib/civic-signals/account-participation-status";

type AccountParticipationStatusCardProps = {
  status: AccountParticipationStatus;
};

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function badgeClass(value: boolean) {
  return value
    ? "border-civic-200 bg-civic-50 text-civic-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

function metricClass(value: boolean) {
  return value ? "text-civic-900" : "text-amber-900";
}

export function AccountParticipationStatusCard({ status }: AccountParticipationStatusCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Civic signal status</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">How your votes count</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{status.explanation}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(status.countsAsVerifiedStakeholderSignal)}`}>
          {status.countsAsVerifiedStakeholderSignal ? "Verified signal ready" : "Verification needed"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Can vote</p>
          <p className={`mt-2 text-lg font-semibold ${metricClass(status.canCastSourceBackedVotes)}`}>
            {yesNo(status.canCastSourceBackedVotes)}
          </p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verified analytics</p>
          <p className={`mt-2 text-lg font-semibold ${metricClass(status.countsAsVerifiedStakeholderSignal)}`}>
            {yesNo(status.countsAsVerifiedStakeholderSignal)}
          </p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vote weight</p>
          <p className="mt-2 text-lg font-semibold text-ink">{status.voteWeight}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Hidden weighting</p>
          <p className="mt-2 text-lg font-semibold text-ink">{status.hiddenWeighting ? "Enabled" : "Never"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-civic-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Source-backed questions</p>
          <p className="mt-2 text-lg font-semibold text-civic-900">{status.sourceBackedQuestionsAvailable.toLocaleString()}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Your real responses</p>
          <p className="mt-2 text-lg font-semibold text-ink">{status.existingRealResponses.toLocaleString()}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verified responses</p>
          <p className="mt-2 text-lg font-semibold text-ink">{status.existingVerifiedAnalyticsResponses.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-900">
        <p>{status.nextStep}</p>
        {!status.countsAsVerifiedStakeholderSignal && status.signedIn ? (
          <Link href="/account/verification#residency-review" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
            Verify residency
          </Link>
        ) : null}
      </div>
    </section>
  );
}
