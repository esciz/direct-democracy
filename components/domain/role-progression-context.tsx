import { getRoleLabel } from "@/lib/auth/roles";
import type { UserProgressionSummary } from "@/types/domain";

type RoleProgressionContextProps = {
  progression: UserProgressionSummary;
  title?: string;
};

export function RoleProgressionContext({
  progression,
  title = "Role progression",
}: RoleProgressionContextProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Civic progression</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        {progression.highlightedRole ? (
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            Highlighting {getRoleLabel(progression.highlightedRole)}
          </span>
        ) : null}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {progression.steps.map((step) => {
          const isHighlighted = progression.highlightedRole === step.role;

          return (
            <div
              key={step.role}
              className={
                isHighlighted
                  ? "rounded-3xl border border-civic-300 bg-civic-50 p-4 text-civic-950"
                  : step.state === "current"
                    ? "rounded-3xl bg-slate-950 p-4 text-white"
                    : step.state === "complete"
                      ? "rounded-3xl bg-slate-100 p-4 text-slate-800"
                      : "rounded-3xl bg-slate-50 p-4 text-slate-600"
              }
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{step.label}</p>
              <p className="mt-2 text-sm">
                {isHighlighted ? "Recent transition" : step.state === "current" ? "Current role" : step.state === "complete" ? "Completed" : "Possible next role"}
              </p>
            </div>
          );
        })}
      </div>
      {progression.viewerConnectionLabel ? (
        <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">{progression.viewerConnectionLabel}</div>
      ) : null}
    </section>
  );
}
