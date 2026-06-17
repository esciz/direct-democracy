import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { rerunFactorySourceAction, updateReviewQueueItemStatusAction } from "@/lib/civic-data/factory-actions";
import { DATA_FACTORY_PRIORITIES, DATA_FACTORY_QA_RULES, getCivicDataFactoryDashboard, type FactoryRow } from "@/lib/civic-data/factory";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function formatDate(value?: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Not imported yet";
}

function StatusBadge({ value }: { value?: string | null }) {
  if (!value) return null;

  return (
    <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
      {value.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
      No {label.toLowerCase()} found in stored data yet.
    </div>
  );
}

function RowActions({ row }: { row: FactoryRow }) {
  return (
    <div className="flex flex-wrap gap-2">
      {row.href ? (
        <Link href={row.href} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:border-cyan-200/40">
          Open
        </Link>
      ) : null}
      <button type="button" disabled className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-500">
        Edit
      </button>
      <button type="button" disabled className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-500">
        Merge
      </button>
      <button type="button" disabled className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-500">
        Attach source
      </button>
      <button type="button" disabled className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-500">
        Flag
      </button>
    </div>
  );
}

function RowList({ title, description, rows, emptyLabel }: { title: string; description?: string; rows: FactoryRow[]; emptyLabel?: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">{rows.length} visible</span>
      </div>
      <div className="mt-4 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-50">{row.title}</p>
                    <StatusBadge value={row.status} />
                  </div>
                  {row.subtitle ? <p className="mt-1 text-sm leading-6 text-slate-400">{row.subtitle}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">Updated {formatDate(row.updatedAt)}</p>
                  {row.sourceName ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Source:{" "}
                      {row.sourceUrl ? (
                        <Link href={row.sourceUrl} className="text-cyan-200 hover:text-cyan-100">
                          {row.sourceName}
                        </Link>
                      ) : (
                        row.sourceName
                      )}
                    </p>
                  ) : null}
                </div>
                <div className="flex max-w-full flex-col items-start gap-2 md:items-end">
                  {row.actionHint ? <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{row.actionHint}</p> : null}
                  <RowActions row={row} />
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState label={emptyLabel ?? title} />
        )}
      </div>
    </section>
  );
}

export default async function AdminDataFactoryPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const dashboard = await getCivicDataFactoryDashboard();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Civic Data Factory"
        description="Repeatable, reviewable pipelines for candidate knowledge, campaign finance, issue positions, and meeting records. Public pages continue to read stored, source-attributed data only."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Nevada data QA
            </Link>
            <Link href="/admin/documents" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Document intake
            </Link>
            <Link href="/admin/data-factory/candidate-knowledge" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Candidate knowledge
            </Link>
            <Link href="/admin/data-factory/news-sources" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Local news sources
            </Link>
            <Link href="/admin/sources" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Source registry
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Sources", value: dashboard.summary.sources },
          { label: "Recent Runs", value: dashboard.summary.recentImportRuns },
          { label: "Source Records", value: dashboard.summary.sourceRecords },
          { label: "Field Attributions", value: dashboard.summary.sourceAttributions },
          { label: "Pending News", value: dashboard.summary.pendingNewsMentions },
          { label: "Finance Link Gaps", value: dashboard.summary.missingCampaignFinanceLinks },
          { label: "District Source Gaps", value: dashboard.summary.missingDistrictSources },
          { label: "Meeting Source Gaps", value: dashboard.summary.missingMeetingSources },
          { label: "Pending Review", value: dashboard.summary.pendingReview },
          { label: "Open QA Issues", value: dashboard.summary.openQualityIssues },
          { label: "Stale Sources", value: dashboard.summary.staleSources },
          { label: "Factory Layers", value: DATA_FACTORY_PRIORITIES.length },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-50">{metric.value.toLocaleString()}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-5">
        <h2 className="text-lg font-semibold text-slate-50">Factory pipelines</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {DATA_FACTORY_PRIORITIES.map((pipeline) => (
            <div key={pipeline.key} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <p className="font-semibold text-slate-50">{pipeline.label}</p>
              <p className="mt-2 text-xs font-semibold text-cyan-100">{pipeline.importCommand}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{pipeline.reviewCommand}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pipeline.outputs.slice(0, 6).map((output) => (
                  <span key={output} className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                    {output}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Data Sources</h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {dashboard.sources.map((source) => (
            <div key={source.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-50">{source.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{source.sourceType} · {source.dataCategory ?? "uncategorized"}</p>
                  <p className="mt-1 text-xs text-slate-500">Last success {formatDate(source.lastSuccessAt)}</p>
                </div>
                <StatusBadge value={source.syncStatus} />
              </div>
              <form action={rerunFactorySourceAction} className="mt-3">
                <input type="hidden" name="sourceSlug" value={source.slug} />
                <button type="submit" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:border-cyan-200/40">
                  Rerun import
                </button>
              </form>
            </div>
          ))}
          {!dashboard.sources.length ? <EmptyState label="data sources" /> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Import Runs</h2>
        <div className="mt-4 space-y-3">
          {dashboard.importRuns.length ? (
            dashboard.importRuns.map((run) => (
              <div key={run.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-50">{run.source.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Found {run.recordsFound} · Created {run.recordsCreated} · Updated {run.recordsUpdated} · Flagged {run.recordsFlaggedForReview}
                    </p>
                    {run.errorLog ? <p className="mt-2 text-xs text-amber-200">Last error is stored internally; last good data remains available.</p> : null}
                  </div>
                  <div className="text-right">
                    <StatusBadge value={run.status} />
                    <p className="mt-2 text-xs text-slate-500">{formatDate(run.startedAt)}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="import runs" />
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <RowList title="Candidate Knowledge Gaps" rows={dashboard.gaps.candidateKnowledge} />
        <RowList title="Campaign Finance Gaps" rows={dashboard.gaps.campaignFinance} />
        <RowList title="Issue Position Gaps" rows={dashboard.gaps.issuePositions} />
        <RowList title="Meeting Data Gaps" rows={dashboard.gaps.meetings} />
        <RowList title="Duplicate Records" rows={dashboard.duplicateRecords} />
        <RowList title="Conflicting Sources" rows={dashboard.conflictingSources} />
        <RowList title="Stale Sources" rows={dashboard.staleSources} />
        <RowList title="Unmatched Documents" rows={dashboard.unmatchedDocuments} />
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Pending Review</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Review queue actions update review metadata only. They do not overwrite verified/manual civic records.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">{dashboard.pendingReview.length} visible</span>
        </div>
        <div className="mt-4 space-y-3">
          {dashboard.pendingReview.length ? (
            dashboard.pendingReview.map((row) => (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-50">{row.title}</p>
                    {row.subtitle ? <p className="mt-1 text-sm leading-6 text-slate-400">{row.subtitle}</p> : null}
                    <p className="mt-2 text-xs text-slate-500">Updated {formatDate(row.updatedAt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["approved", "Approve"],
                      ["rejected", "Reject"],
                      ["verified", "Mark verified"],
                    ].map(([status, label]) => (
                      <form key={status} action={updateReviewQueueItemStatusAction}>
                        <input type="hidden" name="itemId" value={row.id} />
                        <input type="hidden" name="status" value={status} />
                        <button type="submit" className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-300/20">
                          {label}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState label="pending review items" />
          )}
        </div>
      </section>

      <RowList title="Recently Updated" rows={dashboard.recentlyUpdated} />

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Bad data cleanup rules</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {DATA_FACTORY_QA_RULES.map((rule) => (
            <span key={rule} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-300">
              {rule}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
