import type { SentimentHistoryPoint } from "@/types/domain";

type SentimentHistoryChartProps = {
  data: SentimentHistoryPoint[];
  title?: string;
  currentValue?: number | null;
  compact?: boolean;
  showLegend?: boolean;
};

function buildLine(data: SentimentHistoryPoint[], key: "supportPercent" | "opposePercent" | "undecidedPercent") {
  return data
    .map((point, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const raw = point[key] ?? 0;
      const y = 84 - raw * 0.68;
      return `${x},${y}`;
    })
    .join(" ");
}

export function SentimentHistoryChart({
  data,
  title = "Sentiment over time",
  currentValue,
  compact = false,
  showLegend = true,
}: SentimentHistoryChartProps) {
  const safeData = data.filter((point) => typeof point.label === "string" && Number.isFinite(point.supportPercent));

  if (safeData.length < 2) {
    return null;
  }

  const supportLine = buildLine(safeData, "supportPercent");
  const opposeLine = buildLine(safeData, "opposePercent");
  const undecidedLine = buildLine(safeData, "undecidedPercent");
  const latest = safeData.at(-1) ?? safeData[safeData.length - 1];

  return (
    <div className={compact ? "rounded-2xl border border-white/10 bg-white/[0.03] px-2.5 py-2" : "rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">{title}</p>
          {!compact && typeof currentValue === "number" ? (
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{currentValue}% support</p>
          ) : null}
        </div>
        {showLegend ? (
          <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
            <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-emerald-200">Support</span>
            <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-rose-200">Oppose</span>
            <span className="rounded-full bg-slate-500/20 px-2.5 py-1 text-slate-300">Undecided</span>
          </div>
        ) : null}
      </div>

      <div className={compact ? "mt-1.5" : "mt-4"}>
        <svg viewBox="0 0 100 84" className={compact ? "h-24 w-full overflow-visible" : "h-36 w-full overflow-visible"} aria-hidden="true">
          {[20, 40, 60, 80].map((value) => {
            const y = 84 - value * 0.68;
            return <line key={value} x1="0" x2="100" y1={y} y2={y} stroke="rgba(148,163,184,0.16)" strokeWidth="0.7" />;
          })}
          <polyline fill="none" stroke="#22c55e" strokeWidth={compact ? "2.7" : "2.8"} strokeLinecap="round" strokeLinejoin="round" points={supportLine} />
          <polyline fill="none" stroke="#fb7185" strokeWidth={compact ? "2.15" : "2.3"} strokeLinecap="round" strokeLinejoin="round" points={opposeLine} />
          <polyline fill="none" stroke="#94a3b8" strokeWidth={compact ? "1.95" : "2.1"} strokeLinecap="round" strokeLinejoin="round" points={undecidedLine} />
        </svg>
      </div>

      <div className={compact ? "mt-1 flex items-center justify-between px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500" : "mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"}>
        <span>{safeData[0]?.label}</span>
        <span>{latest.label}</span>
      </div>
    </div>
  );
}
