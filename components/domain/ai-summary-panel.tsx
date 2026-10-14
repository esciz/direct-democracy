type AiSummaryPanelProps = {
  title?: string;
  summary: string;
  bullets?: string[];
  compact?: boolean;
};

export function AiSummaryPanel({ title = "AI Summary", summary, bullets = [], compact = false }: AiSummaryPanelProps) {
  return (
    <details className={`rounded-[1.5rem] border border-slate-200 bg-slate-50 ${compact ? "p-4" : "p-5"}`}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{title}</p>
            <p className="mt-2 text-sm font-medium text-slate-700">Informational only. Does not determine the final rating or outcome.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">Open</span>
        </div>
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-sm leading-6 text-slate-700">{summary}</p>
        {bullets.length ? (
          <div className="space-y-2">
            {bullets.map((bullet) => (
              <p key={bullet} className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                {bullet}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}
