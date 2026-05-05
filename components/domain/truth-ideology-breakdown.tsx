import type { TruthIdeologyBreakdownEntry } from "@/lib/truth/ratings";

const TONE_BY_LABEL: Record<string, string> = {
  Accurate: "bg-emerald-500",
  "Mostly True": "bg-civic-500",
  "Mixed / Unclear": "bg-slate-400",
  Misleading: "bg-orange-500",
  False: "bg-rose-500",
};

type TruthIdeologyBreakdownProps = {
  entries: TruthIdeologyBreakdownEntry[];
};

export function TruthIdeologyBreakdown({ entries }: TruthIdeologyBreakdownProps) {
  if (!entries.length) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Truth ratings by ideological segment</p>
        <p className="text-sm text-slate-600">
          This shows how raters with different visible ideological signals assessed the same claim. It is descriptive context, not a final ruling.
        </p>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.ideology} className="space-y-2 rounded-[1.25rem] border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink">{entry.ideology}</p>
                {entry.badge ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {entry.badge}
                  </span>
                ) : null}
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {entry.totalRatings} rating{entry.totalRatings === 1 ? "" : "s"}
              </span>
            </div>

            <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
              {entry.distribution.map((bucket) => (
                <div
                  key={`${entry.ideology}-${bucket.label}`}
                  className={TONE_BY_LABEL[bucket.label] ?? "bg-slate-300"}
                  style={{ width: `${Math.max(bucket.percentage, bucket.count ? 6 : 0)}%` }}
                  aria-hidden="true"
                />
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {entry.distribution.map((bucket) => (
                <div key={`${entry.ideology}-${bucket.label}-legend`} className="flex items-center justify-between gap-3 rounded-full bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${TONE_BY_LABEL[bucket.label] ?? "bg-slate-300"}`} />
                    <span>{bucket.label}</span>
                  </span>
                  <span>
                    {bucket.count} · {bucket.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
