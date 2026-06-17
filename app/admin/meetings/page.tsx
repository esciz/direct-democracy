import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getPublicMeetingAdminDashboard } from "@/lib/public-meetings/public";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type AdminMeetingsPageProps = {
  searchParams?: Promise<{
    view?: string;
    type?: string;
    upload?: string;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Date pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function confidenceLabel(value: number) {
  if (value >= 0.8) return "High";
  if (value >= 0.5) return "Medium";
  return "Low";
}

export default async function AdminMeetingsPage({ searchParams }: AdminMeetingsPageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }

  const params = searchParams ? await searchParams : {};
  const dashboard = await getPublicMeetingAdminDashboard();
  const bodyById = new Map(dashboard.publicBodies.map((body) => [body.id, body]));
  const meetingById = new Map(dashboard.meetings.map((meeting) => [meeting.id, meeting]));
  const filteredItems = dashboard.meetingItems
    .filter((item) => (params.view === "low-confidence" ? item.confidence_score < 0.65 : true))
    .filter((item) => (params.type ? item.item_type === params.type : true));

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Meeting record review"
        description="Review parsed meetings, agenda items, extracted votes, and generated citizen questions before anything becomes public-facing."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/meetings/upload" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Upload record
            </Link>
            <Link href="/admin/meeting-sources" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Source registry
            </Link>
            <Link href="/admin/meeting-actions" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Action queue
            </Link>
          </div>
        }
      />

      {params.upload === "staged" ? (
        <section className="rounded-[1.35rem] border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50">
          Upload staged. Run <span className="font-mono text-xs">npm run meetings:import</span> to extract text, split items, and refresh generated review files.
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Meetings</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{dashboard.meetings.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Items</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{dashboard.meetingItems.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Votes</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{dashboard.voteRecords.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Draft questions</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{dashboard.reviewQueues.draftQuestions.length}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Filters</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Review queue</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/meetings" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">
              All
            </Link>
            <Link href="/admin/meetings?view=low-confidence" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">
              Low confidence
            </Link>
            <Link href="/admin/meetings?type=action" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">
              Action items
            </Link>
            <Link href="/admin/meetings?type=consent" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">
              Consent
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredItems.length ? (
          filteredItems.slice(0, 60).map((item) => {
            const meeting = meetingById.get(item.meeting_id);
            const body = meeting ? bodyById.get(meeting.public_body_id) : null;
            return (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                        {item.item_type}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                        {confidenceLabel(item.confidence_score)} · {Math.round(item.confidence_score * 100)}%
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                        {item.policy_area}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{item.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {body?.name ?? "Body pending"} · {formatDate(meeting?.meeting_date)} · {item.cached_text_path ?? "cached text pending"}
                    </p>
                    {item.fiscal_impact_summary ? <p className="mt-2 text-sm text-amber-100">Fiscal impact: {item.fiscal_impact_summary}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.source_url ? (
                      <Link href={item.source_url} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100">
                        Source URL
                      </Link>
                    ) : null}
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
                      {item.id.slice(0, 28)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
            No parsed meeting items match this filter. Upload a meeting record and run npm run meetings:import.
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Extracted votes</p>
          <div className="mt-4 space-y-3">
            {dashboard.voteRecords.slice(0, 12).map((vote) => (
              <article key={vote.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <p className="text-sm font-semibold text-slate-100">{vote.official_name} · {vote.vote}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{vote.vote_text}</p>
              </article>
            ))}
            {!dashboard.voteRecords.length ? <p className="text-sm text-slate-400">No explicit roll-call votes extracted yet.</p> : null}
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Draft citizen questions</p>
          <div className="mt-4 space-y-3">
            {dashboard.citizenQuestions.slice(0, 12).map((question) => (
              <article key={question.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                <p className="text-sm font-semibold text-slate-100">{question.question_text}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {question.status} · {question.policy_area} · {Math.round(question.confidence_score * 100)}% confidence
                </p>
              </article>
            ))}
            {!dashboard.citizenQuestions.length ? <p className="text-sm text-slate-400">No draft questions generated yet.</p> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
