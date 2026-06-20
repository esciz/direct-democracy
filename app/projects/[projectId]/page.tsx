import Link from "next/link";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
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

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const project = await getProjectById(projectId);

  if (!project) {
    notFound();
  }

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
      />

      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-50">What is happening?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{project.summary}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Responsible body</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{project.agency ?? "Agency pending"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Cost</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{project.cost ?? "Not parsed yet"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Timeline</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{formatDate(project.timeline)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Confidence</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{project.confidence === null ? "Unknown" : `${Math.round(project.confidence * 100)}%`}</p>
          </div>
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
