import Link from "next/link";

import type { ProfileNewsMentionCardData, PublicNewsMentionSummary } from "@/lib/news-mentions/store";

function formatNewsDate(value: string | null | undefined) {
  if (!value) return "Date not listed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not listed";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function NewsMentionsSection({
  mentions,
  cardData,
  showAdminDiagnostics = false,
  emptyText = "No reviewed news mentions available yet.",
}: {
  mentions?: PublicNewsMentionSummary[];
  cardData?: ProfileNewsMentionCardData;
  showAdminDiagnostics?: boolean;
  emptyText?: string;
}) {
  const displayedMentions = cardData?.mentions ?? mentions ?? [];
  const totalCount = cardData?.totalCount ?? displayedMentions.length;
  const approvedCount = cardData?.approvedCount ?? displayedMentions.filter((mention) => mention.reviewStatus === "approved").length;
  const verifiedCount = cardData?.verifiedCount ?? displayedMentions.filter((mention) => mention.reviewStatus === "verified").length;
  const pendingCount = cardData?.pendingCount ?? displayedMentions.filter((mention) => mention.reviewStatus === "pending_review").length;
  const publicVisibleCount = approvedCount + verifiedCount;
  const hasPendingOnly = publicVisibleCount === 0 && pendingCount > 0;

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Reviewed media coverage</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">In the News</h2>
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-100">
          {showAdminDiagnostics ? "Stored mentions" : "Approved / verified only"}
        </span>
      </div>

      {displayedMentions.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {displayedMentions.map((mention) => (
            <article key={mention.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm font-semibold leading-6 text-slate-100">{mention.title}</p>
                {showAdminDiagnostics ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                    {mention.reviewStatus.replace(/_/g, " ")}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                {mention.sourceName} · {formatNewsDate(mention.publishedAt)}
              </p>
              {mention.snippetOrSummary ? <p className="mt-2 text-sm leading-6 text-slate-400">{mention.snippetOrSummary}</p> : null}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href={mention.url}
                  className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/40 hover:text-white"
                  rel="noreferrer"
                  target="_blank"
                >
                  Open article
                </Link>
                {showAdminDiagnostics ? (
                  <span className="text-xs text-slate-500">
                    {mention.provider.replace(/_/g, " ")} · Confidence {(mention.confidenceScore * 100).toFixed(0)}%
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : hasPendingOnly ? (
        <div className="mt-5 rounded-2xl border border-amber-300/18 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          News mentions found — pending review.
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
          {emptyText}
          {showAdminDiagnostics ? <p className="mt-2 text-xs text-slate-500">Run npm run civic:import-news-mentions to fetch news mentions.</p> : null}
        </div>
      )}

      {showAdminDiagnostics ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Local / admin news diagnostics</p>
          <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <span>Total linked: {totalCount}</span>
            <span>Approved: {approvedCount}</span>
            <span>Verified: {verifiedCount}</span>
            <span>Pending: {pendingCount}</span>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
            <span>Provider: {cardData?.providerUsed?.replace(/_/g, " ") ?? "No import run yet"}</span>
            <span>Last import: {formatNewsDate(cardData?.lastImportRun?.startedAt)}</span>
            {cardData?.lastImportRun?.matchedQuery ? <span className="sm:col-span-2">Last query: {cardData.lastImportRun.matchedQuery}</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
