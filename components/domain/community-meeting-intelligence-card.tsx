import Link from "next/link";

import type { CommunityMeetingSummary } from "@/lib/public-meetings/types";

function formatDate(value: string | null) {
  if (!value) return "Date pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">{text}</div>;
}

export function CommunityMeetingIntelligenceCard({ summary }: { summary: CommunityMeetingSummary }) {
  const hasAnyRecords =
    summary.upcoming_meetings.length ||
    summary.recent_decisions.length ||
    summary.open_questions.length ||
    summary.recently_approved_spending.length ||
    summary.public_comment_opportunities.length;

  return (
    <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Meeting records</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Local decisions and open questions</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Public agendas, minutes, packets, and transcripts become ballot-style local questions after source-backed review.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
          {summary.matching_public_body_count} source{summary.matching_public_body_count === 1 ? "" : "s"} matched
        </span>
      </div>

      {!hasAnyRecords ? (
        <div className="mt-5">
          <EmptyPanel text="No parsed meeting records are available for this community yet. Admins can upload agendas, minutes, packets, or transcripts to start the review workflow." />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Upcoming meetings</p>
            <div className="mt-4 space-y-3">
              {summary.upcoming_meetings.length ? (
                summary.upcoming_meetings.map((meeting) => (
                  <article key={meeting.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{formatDate(meeting.meeting_date)}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{meeting.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{meeting.public_body_name}</p>
                    {meeting.agenda_url ? (
                      <Link href={meeting.agenda_url} className="mt-2 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Agenda
                      </Link>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyPanel text="No upcoming meetings have been parsed yet." />
              )}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Recent decisions</p>
            <div className="mt-4 space-y-3">
              {summary.recent_decisions.length ? (
                summary.recent_decisions.map((decision) => (
                  <article key={decision.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{formatDate(decision.meeting_date)}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{decision.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{decision.public_body_name}{decision.result ? ` · ${decision.result}` : ""}</p>
                    {decision.source_url ? (
                      <Link href={decision.source_url} className="mt-2 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Source
                      </Link>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyPanel text="No source-backed vote decisions have been parsed yet." />
              )}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Local ballot-style questions</p>
            <div className="mt-4 space-y-3">
              {summary.open_questions.length ? (
                summary.open_questions.map((question) => (
                  <article key={question.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{question.policy_area}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{question.question_text}</p>
                    <p className="mt-1 text-xs text-slate-500">{question.review_status} · {question.outcome_status} · {Math.round(question.confidence_score * 100)}% confidence</p>
                  </article>
                ))
              ) : (
                <EmptyPanel text="No reviewed local questions are ready yet." />
              )}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Spending and public comment</p>
            <div className="mt-4 space-y-3">
              {summary.recently_approved_spending.length ? (
                summary.recently_approved_spending.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{item.policy_area}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.fiscal_impact_summary}</p>
                  </article>
                ))
              ) : summary.public_comment_opportunities.length ? (
                summary.public_comment_opportunities.map((meeting) => (
                  <article key={meeting.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{formatDate(meeting.meeting_date)}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{meeting.title}</p>
                    {meeting.agenda_url ? (
                      <Link href={meeting.agenda_url} className="mt-2 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Public comment info
                      </Link>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyPanel text="No spending items or public comment opportunities have been parsed yet." />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
