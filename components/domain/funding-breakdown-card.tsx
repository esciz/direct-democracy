import type { FundingBreakdownItem, FundingIndustryBreakdownItem } from "@/types/domain";

type FundingBreakdownCardProps = {
  title?: string;
  items: FundingBreakdownItem[];
  industries?: FundingIndustryBreakdownItem[];
};

const COLORS = ["#0f766e", "#2563eb", "#f97316", "#7c3aed", "#e11d48"] as const;

function buildGradient(items: Array<{ percentage: number }>) {
  let offset = 0;

  return items
    .map((item, index) => {
      const start = offset;
      const end = offset + item.percentage;
      offset = end;
      return `${COLORS[index % COLORS.length]} ${start}% ${end}%`;
    })
    .join(", ");
}

export function FundingBreakdownCard({ title = "Funding breakdown", items, industries = [] }: FundingBreakdownCardProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">{title}</p>
      <p className="mt-2 text-sm text-slate-600">
        Example/demo data. This is a simplified funding view for transparency, not a live filing record. Industry / Organizational Funding is contextual and does not imply direct influence.
      </p>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl bg-slate-50 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div
              aria-hidden="true"
              className="h-40 w-40 rounded-full border-8 border-white shadow-inner"
              style={{ background: `conic-gradient(${buildGradient(items)})` }}
            />
            <div className="grid flex-1 gap-3">
              {items.map((item, index) => (
                <div key={item.label} className="rounded-2xl bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <p className="text-sm font-semibold text-ink">{item.label}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{item.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-slate-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-ink">Top Supporting Industries</h3>
              <p className="mt-2 text-sm text-slate-600">Simplified share of campaign funding associated with major industries or organizational sectors.</p>
            </div>
            <div
              aria-hidden="true"
              className="h-24 w-24 shrink-0 rounded-full border-4 border-white shadow-inner"
              style={{ background: `conic-gradient(${buildGradient(industries.length ? industries : [{ percentage: 100 }])})` }}
            />
          </div>
          <div className="mt-5 space-y-3">
            {industries.length ? (
              industries.map((item, index) => (
                <div key={item.label} className="rounded-2xl bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <p className="text-sm font-semibold text-ink">{item.label}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{item.percentage}%</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-white p-4 text-sm text-slate-600">No industry breakdown is seeded for this profile yet.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
