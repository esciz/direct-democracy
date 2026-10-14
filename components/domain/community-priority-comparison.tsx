import type { IssueComparisonRow } from "@/types/domain";

type CommunityPriorityComparisonProps = {
  rows: IssueComparisonRow[];
  selectedCommunityName: string;
};

export function CommunityPriorityComparison({ rows, selectedCommunityName }: CommunityPriorityComparisonProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Comparison</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">How this community differs from wider sentiment</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          A quick benchmark against statewide and national issue patterns so users can spot where their community is unusually focused.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[42rem] space-y-3">
          <div className="grid grid-cols-[1.7fr,1fr,1fr,1fr] gap-3 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>Issue</span>
            <span>{selectedCommunityName}</span>
            <span>Nevada</span>
            <span>United States</span>
          </div>
          {rows.length ? (
            rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[1.7fr,1fr,1fr,1fr] gap-3 rounded-3xl bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-ink">{row.label}</p>
                </div>
                <p className="text-sm font-semibold text-civic-700">{row.selectedCommunityPercentage}%</p>
                <p className="text-sm font-semibold text-slate-700">{row.statePercentage}%</p>
                <p className="text-sm font-semibold text-slate-700">{row.nationalPercentage}%</p>
              </div>
            ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-600">Comparison data will appear once issues are available.</div>
          )}
        </div>
      </div>
    </section>
  );
}
