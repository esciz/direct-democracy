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
      return "border-civic-200 bg-civic-50 text-civic-800";
    case "provider_needed":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "stewardship_available":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "available_after_verification":
      return "border-slate-200 bg-white text-slate-600";
  }
}

function ReadinessItemCard({ item }: { item: ParticipationReadinessItem }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{item.label}</p>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>
          {statusLabel(item.status)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
    </div>
  );
}

export function ParticipationReadinessPanel({ summary, compact = false }: ParticipationReadinessPanelProps) {
  const coreItems = compact ? summary.unlocked.slice(0, 3) : summary.unlocked;
  const nextItems = compact ? summary.nextSteps.slice(0, 2) : summary.nextSteps;
  const stewardshipItems = compact ? summary.stewardship.slice(0, 2) : summary.stewardship;

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Participation readiness</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{summary.verificationLabel}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{summary.verificationDescription}</p>
        </div>
        <div className="rounded-3xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
          Vote weight: {summary.voteWeight}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-civic-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Verification class</p>
          <p className="mt-2 text-lg font-semibold text-civic-950">{summary.verificationClass.replaceAll("_", " ")}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Hidden weighting</p>
          <p className="mt-2 text-lg font-semibold text-ink">{summary.hiddenWeighting ? "Enabled" : "Never"}</p>
        </div>
        <div className="rounded-3xl bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trusted Citizen</p>
          <p className="mt-2 text-lg font-semibold text-ink">{summary.trustedGrantStatus === "active" ? "Active" : "Not active"}</p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-civic-200 bg-civic-50 p-5 text-sm leading-6 text-civic-950">
        {summary.publicDataSeparation}
      </div>
      <div className="mt-3 rounded-3xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-950">
        {summary.trustedCitizenNote}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Available now</p>
          <div className="mt-3 space-y-3">
            {coreItems.map((item) => <ReadinessItemCard key={item.id} item={item} />)}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Verification unlocks</p>
          <div className="mt-3 space-y-3">
            {nextItems.map((item) => <ReadinessItemCard key={item.id} item={item} />)}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Stewardship</p>
          <div className="mt-3 space-y-3">
            {stewardshipItems.map((item) => <ReadinessItemCard key={item.id} item={item} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
