import Link from "next/link";

type CampaignFinanceMetric = {
  label: string;
  value: string;
  href?: string | null;
  note?: string | null;
  tone?: "cyan" | "emerald" | "amber" | "slate";
};

const toneClasses: Record<NonNullable<CampaignFinanceMetric["tone"]>, string> = {
  cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100",
  emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
  amber: "border-amber-300/20 bg-amber-400/10 text-amber-100",
  slate: "border-white/10 bg-white/[0.04] text-slate-100",
};

function MetricContent({ metric }: { metric: CampaignFinanceMetric }) {
  return (
    <>
      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{metric.label}</span>
      <span className="mt-2 block break-words text-lg font-semibold tracking-tight text-slate-50">{metric.value}</span>
      {metric.note ? <span className="mt-1 block text-xs leading-5 text-slate-500">{metric.note}</span> : null}
    </>
  );
}

export function CampaignFinanceMetricRow({ metrics }: { metrics: CampaignFinanceMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => {
        const className = `rounded-[1.1rem] border p-4 transition ${toneClasses[metric.tone ?? "slate"]}`;
        if (!metric.href) {
          return (
            <div key={metric.label} className={className}>
              <MetricContent metric={metric} />
            </div>
          );
        }
        return (
          <Link key={metric.label} href={metric.href} className={`${className} hover:border-cyan-300/40 hover:bg-white/[0.07]`}>
            <MetricContent metric={metric} />
          </Link>
        );
      })}
    </div>
  );
}
