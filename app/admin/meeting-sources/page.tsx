import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getPublicMeetingAdminDashboard } from "@/lib/public-meetings/public";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminMeetingSourcesPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }

  const dashboard = await getPublicMeetingAdminDashboard();
  const activeSources = dashboard.seedSources.filter((source) => source.active);
  const scraperCounts = dashboard.seedSources.reduce<Record<string, number>>((counts, source) => {
    counts[source.scraperType] = (counts[source.scraperType] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Public meeting source registry"
        description="Seeded Nevada-first public bodies for agenda, minutes, packet, transcript, and vote-record ingestion. Automated scraper adapters come after manual and cache-first review are stable."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/meetings/upload" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Upload meeting record
            </Link>
            <Link href="/admin/meetings" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Review parsed records
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Seed sources</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{dashboard.seedSources.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Active</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{activeSources.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Generated bodies</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{dashboard.publicBodies.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Last import</p>
          <p className="mt-3 text-sm font-semibold text-slate-50">{formatDate(dashboard.ingestionReport?.generated_at)}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Scraper readiness</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Source types</h2>
          </div>
          <p className="text-sm text-slate-400">Manual import works now. Platform-specific scrapers are queued for the next phase.</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(scraperCounts).map(([scraperType, count]) => (
            <span key={scraperType} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-slate-300">
              {scraperType} · {count}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Manual browser cache</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Blocked-provider coverage</h2>
          </div>
          <p className="text-sm text-slate-400">
            JSON report: <span className="font-mono text-xs">data/generated/public-meeting-manual-provider-report.json</span>
          </p>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {dashboard.manualProviderReport.length ? (
            dashboard.manualProviderReport.map((report) => (
              <article key={report.provider_id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-100">{report.source_name}</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                    {report.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">{report.manifest_path}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Cached {report.cached_files}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Meetings {report.parsed_meetings}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Items {report.parsed_items}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Pages {report.detail_pages_collected ?? 0}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">PDFs {report.pdfs_collected ?? 0}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">JSON {report.json_collected ?? 0}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Votes/actions {report.vote_action_records_parsed ?? 0}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Roll-call {report.roll_call_parsed_count ?? 0}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Roll-call review {report.roll_call_needs_review_count ?? 0}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Low-conf PDF {report.low_confidence_pdf_records ?? 0}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Questions ready {report.question_ready_count ?? 0}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Questions review {(report.question_needs_context_count ?? 0) + (report.question_needs_financial_review_count ?? 0) + (report.question_needs_vote_outcome_count ?? 0)}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Needs review {report.needs_review_count ?? 0}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Interactive {report.interactive_session_needed ? "yes" : "no"}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">Failures {report.parser_failures}</span>
                </div>
                {report.boarddocs_failures?.length ? (
                  <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                    <p className="font-semibold">BoardDocs failures</p>
                    {report.boarddocs_failures.slice(0, 4).map((failure) => (
                      <p key={`${failure.url}-${failure.reason}`} className="mt-1 break-all">{failure.url}: {failure.reason}</p>
                    ))}
                  </div>
                ) : null}
                {report.parser_gaps?.length ? <p className="mt-3 text-xs leading-5 text-amber-100/80">Parser gaps: {report.parser_gaps.join("; ")}</p> : null}
                {report.next_recommended_action ? <p className="mt-2 text-xs leading-5 text-slate-400">Next: {report.next_recommended_action}</p> : null}
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-slate-400">
              No manual source report yet. Run <span className="font-mono text-xs">npm run meetings:bootstrap:sources</span>, add saved files, then run{" "}
              <span className="font-mono text-xs">npm run meetings:import:manual</span>.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {dashboard.seedSources.map((source) => (
          <article key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold text-white">{source.name}</p>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                    {source.level}
                  </span>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                    {source.scraperType}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{source.jurisdiction}</p>
                {source.notes ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{source.notes}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {source.meetingIndexUrl ? (
                  <Link href={source.meetingIndexUrl} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100 hover:border-cyan-300/30">
                    Meeting index
                  </Link>
                ) : null}
                {source.agendaArchiveUrl ? (
                  <Link href={source.agendaArchiveUrl} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100 hover:border-cyan-300/30">
                    Agenda archive
                  </Link>
                ) : null}
                {source.videoArchiveUrl ? (
                  <Link href={source.videoArchiveUrl} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100 hover:border-cyan-300/30">
                    Video
                  </Link>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
