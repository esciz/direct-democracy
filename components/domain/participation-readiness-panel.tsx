import type { ParticipationReadinessItem, ParticipationReadinessSummary } from "@/lib/identity/participation-readiness";

type ParticipationReadinessPanelProps = {
  summary: ParticipationReadinessSummary;
  compact?: boolean;
};

function statusLabel(status: ParticipationReadinessItem["status"]) {
  switch (status) {
    case "ready":
      return "Ready";
    case "provider_needed":
      return "Verification setup";
    case "stewardship_available":
      return "Stewardship review";
    case "available_after_verification":
      return "Needs verification";
  }
}

function statusClass(status: ParticipationReadinessItem["status"]) {
  switch (status) {
    case "ready":
      return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
    case "provider_needed":
      return "border-amber-300/20 bg-amber-500/10 text-amber-100";
    case "stewardship_available":
      return "border-cyan-300/20 bg-cyan-500/10 text-cyan-100";
    case "available_after_verification":
      return "border-white/10 bg-white/[0.04] text-slate-300";
  }
}

function ReadinessItemCard({ item }: { item: ParticipationReadinessItem }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">{item.label}</p>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>
          {statusLabel(item.status)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
    </div>
  );
}

export function ParticipationReadinessPanel({ summary, compact = false }: ParticipationReadinessPanelProps) {
  const coreItems = compact ? summary.unlocked.slice(0, 3) : summary.unlocked;
  const nextItems = compact ? summary.nextSteps.slice(0, 2) : summary.nextSteps;
  const stewardshipItems = compact ? summary.stewardship.slice(0, 2) : summary.stewardship;

  return (
    <section className="dd-panel-muted rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Voting access</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-50">{summary.verificationLabel}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{summary.verificationDescription}</p>
        </div>
        <div className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100">
          Equal vote weight: {summary.voteWeight}
        </div>
      </div>

      <div className="mt-5 grid gap-3 border-y border-white/10 py-4 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
        <div className="sm:px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verification</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">{summary.verificationClass.replaceAll("_", " ")}</p>
        </div>
        <div className="sm:px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Hidden weighting</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">{summary.hiddenWeighting ? "Enabled" : "Never"}</p>
        </div>
        <div className="sm:px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Stewardship tools</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">{summary.trustedGrantStatus === "active" ? "Available" : "Not active"}</p>
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-cyan-100 hover:text-cyan-50">Access details and privacy rules</summary>
        <div className="mt-4 space-y-5 border-t border-white/10 pt-5">
          <div className="grid gap-3 text-sm leading-6 sm:grid-cols-2">
            <p className="rounded-lg border border-emerald-300/16 bg-emerald-500/10 p-4 text-emerald-50">{summary.publicDataSeparation}</p>
            <p className="rounded-lg border border-cyan-300/16 bg-cyan-500/10 p-4 text-cyan-50">{summary.trustedCitizenNote}</p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Available now</p>
              <div className="mt-3 space-y-3">{coreItems.map((item) => <ReadinessItemCard key={item.id} item={item} />)}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verification unlocks</p>
              <div className="mt-3 space-y-3">{nextItems.map((item) => <ReadinessItemCard key={item.id} item={item} />)}</div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Stewardship</p>
              <div className="mt-3 space-y-3">{stewardshipItems.map((item) => <ReadinessItemCard key={item.id} item={item} />)}</div>
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
