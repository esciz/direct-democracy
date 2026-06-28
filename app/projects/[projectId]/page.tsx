import Link from "next/link";
import { notFound } from "next/navigation";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { PageIntro } from "@/components/ui/page-intro";
import { getDecisionCards } from "@/lib/civic/decision-pages";
import { getProjectById } from "@/lib/community/product-hub";

type ProjectDetailPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Timeline pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Timeline pending";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const [project, decisionCards] = await Promise.all([getProjectById(projectId), getDecisionCards()]);

  if (!project) {
    notFound();
  }

  const relatedDecisionIds = new Set([...(project.relatedVotingCards ?? []), ...(project.relatedVotes ?? [])]);
  const relatedDecisions = decisionCards.filter((decision) => relatedDecisionIds.has(decision.id) || relatedDecisionIds.has(decision.sourceVotingCardId ?? ""));
  const budgetLabel = project.cost ?? formatMoney(project.budget) ?? project.budgetDescription ?? "Not parsed yet";
  const responsibleBody = project.responsibleBody ?? project.agency ?? project.sourceMeetings?.[0]?.title ?? "Responsible body pending";

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Project"
        title={project.project_title || project.title}
        description="Source-backed project lead. Inferred project records stay marked for review until a capital plan, budget, public works page, or agenda source confirms details."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{project.jurisdiction || "Jurisdiction pending"}</span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">{project.status}</span>
            {project.needsReview ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Needs review</span> : null}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <FavoriteToggleControl
              targetType="project"
              targetId={project.id}
              visibleLabel="Follow project"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            />
            <Link href={`/cases/submit?topic=${encodeURIComponent(project.project_title || project.title)}&agency=${encodeURIComponent(responsibleBody)}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
              Ask about this project
            </Link>
          </div>
        }
      />

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">What is happening?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{project.summary}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Responsible body</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{responsibleBody}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Cost</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{budgetLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Timeline</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{formatDate(project.timeline ?? project.startDate)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Confidence</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{project.confidence === null ? "Unknown" : `${Math.round(project.confidence * 100)}%`}</p>
          </div>
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Decisions connected to this project</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          These are the source-backed public decisions that generated or reference this project. Open a decision to see the meeting, outcome, vote evidence, and source snippets.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {relatedDecisions.length ? (
            relatedDecisions.map((decision) => (
              <Link key={decision.id} href={`/decisions/${decision.id}`} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06]">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">{decision.voteOutcome}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">{decision.voteCount.display}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold leading-6 text-slate-50">{decision.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{decision.summary}</p>
                <p className="mt-3 text-xs leading-5 text-slate-500">{decision.jurisdiction} · {decision.meeting.bodyName} · {formatDate(decision.meeting.date)}</p>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
              No canonical decision card is linked to this project yet. The source meeting links below remain available while relationship coverage improves.
            </div>
          )}
        </div>
      </section>

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Source and related records</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {project.source_url ? (
            <a href={project.source_url} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200">
              Source
            </a>
          ) : null}
          {project.relatedMeetingIds.map((meetingId) => (
            <Link key={meetingId} href={`/events/${meetingId}`} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100">
              Related meeting
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
