type ProfileViewerAlignmentCardProps = {
  eyebrow?: string;
  title: string;
  summary: string;
  description: string;
  alignedCount: number;
  againstCount: number;
  mixedCount: number;
  sparse?: boolean;
};

const SEGMENTS = [
  {
    key: "alignedCount",
    label: "Aligned with you",
    tone: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
  },
  {
    key: "mixedCount",
    label: "Mixed / unclear",
    tone: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700",
    text: "text-slate-700",
  },
  {
    key: "againstCount",
    label: "Against you",
    tone: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700",
    text: "text-rose-700",
  },
] as const;

export function ProfileViewerAlignmentCard({
  eyebrow = "Your alignment",
  title,
  summary,
  description,
  alignedCount,
  againstCount,
  mixedCount,
  sparse = false,
}: ProfileViewerAlignmentCardProps) {
  const total = Math.max(alignedCount + againstCount + mixedCount, 1);
  const values = {
    alignedCount,
    againstCount,
    mixedCount,
  };

  return (
    <div className="rounded-[1.45rem] border border-emerald-100 bg-emerald-50/40 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-ink">{title}</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{summary}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {sparse ? (
          <span className="rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Partial
          </span>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-full bg-white shadow-inner">
        <div className="flex h-3.5 w-full min-w-0">
          {SEGMENTS.map((segment) => {
            const count = values[segment.key];
            if (!count) return null;

            return <div key={segment.key} className={segment.tone} style={{ width: `${(count / total) * 100}%` }} />;
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {SEGMENTS.map((segment) => {
          const count = values[segment.key];
          return (
            <div key={segment.key} className="rounded-2xl border border-white/80 bg-white/95 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{segment.label}</p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${segment.chip}`}>{count}</span>
              </div>
              <p className={`mt-2 text-xl font-semibold tracking-tight ${segment.text}`}>{Math.round((count / total) * 100)}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
