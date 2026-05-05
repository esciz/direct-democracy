import type { IssueLifecycleStage, IssueLifecycleSummary } from "@/types/domain";

type IssueLifecycleMapProps = {
  lifecycle: IssueLifecycleSummary;
};

const stages: IssueLifecycleStage[] = ["Issue", "Petition", "Seeking Sponsor", "Sponsored", "Drafting", "Proposed Legislation"];

export function IssueLifecycleMap({ lifecycle }: IssueLifecycleMapProps) {
  const currentIndex = stages.indexOf(lifecycle.currentStage);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Issue lifecycle</p>
      <h2 className="mt-2 text-xl font-semibold text-ink">Where this issue sits right now</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-6">
        {stages.map((stage, index) => (
          <div
            key={stage}
            className={
              index === currentIndex
                ? "rounded-3xl bg-slate-950 p-4 text-white"
                : index < currentIndex
                  ? "rounded-3xl bg-civic-50 p-4 text-civic-900"
                  : "rounded-3xl bg-slate-50 p-4 text-slate-600"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">{stage}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm leading-6 text-slate-600">{lifecycle.explanation}</p>
      {typeof lifecycle.petitionSignatureCount === "number" && typeof lifecycle.petitionSignatureGoal === "number" ? (
        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">
          {lifecycle.petitionSignatureCount.toLocaleString()} / {lifecycle.petitionSignatureGoal.toLocaleString()} signatures ·{" "}
          {lifecycle.petitionEligibleForCosponsorship ? "Eligible for sponsorship" : "Still gathering signatures"}
        </p>
      ) : null}
    </section>
  );
}
