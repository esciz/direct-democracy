import Link from "next/link";

export type SourceExplorerItem = {
  id: string;
  sourceName: string;
  sourceType: string;
  sourceUrl?: string | null;
  lastImportedAt?: string | Date | null;
  fieldsDerived: string[];
  reviewStatus?: string | null;
  confidenceScore?: number | null;
  notes?: string | null;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "Last imported pending";

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function labelize(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function SourceExplorer({ items, emptyText = "Source records are pending review." }: { items: SourceExplorerItem[]; emptyText?: string }) {
  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Source explorer</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">How this profile is sourced</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Public fields should trace back to stored source records, import timestamps, review status, and confidence. No live scraping runs here.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
          {items.length} source{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {items.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-50">{item.sourceName}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{labelize(item.sourceType)}</p>
                </div>
                <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                  {item.reviewStatus ? (
                    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                      {labelize(item.reviewStatus)}
                    </span>
                  ) : null}
                  {typeof item.confidenceScore === "number" ? (
                    <span className="rounded-full border border-emerald-300/18 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                      {Math.round(item.confidenceScore * 100)}% confidence
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">{formatDate(item.lastImportedAt)}</p>
              {item.notes ? <p className="mt-3 text-sm leading-6 text-slate-400">{item.notes}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {item.fieldsDerived.map((field) => (
                  <span key={field} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                    {field}
                  </span>
                ))}
              </div>
              {item.sourceUrl ? (
                <Link href={item.sourceUrl} className="mt-4 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                  Open source
                </Link>
              ) : (
                <p className="mt-4 text-xs font-semibold text-slate-500">Source URL pending</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
          {emptyText}
        </div>
      )}
    </section>
  );
}
