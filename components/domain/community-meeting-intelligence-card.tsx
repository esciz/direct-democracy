import Link from "next/link";

import type { CommunityMeetingSummary } from "@/lib/public-meetings/types";

function formatDate(value: string | null) {
  if (!value) return "Date pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">{text}</div>;
}

function cleanTopic(value: string) {
  return value
    .replace(/^\s*\d+(?:\.[A-Z0-9]+)*\s*[.)]\s*/i, "")
    .replace(/\b(?:recommendation|appearance|discussion|possible action|for possible action)\b[:\s-]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function CommunityMeetingIntelligenceCard({ summary }: { summary: CommunityMeetingSummary }) {
  const hasAnyRecords =
    summary.upcoming_meetings.length ||
    summary.recent_decisions.length ||
    summary.open_questions.length ||
    summary.recently_approved_spending.length ||
    (summary.public_cases?.length ?? 0) ||
    summary.public_comment_opportunities.length;

  return (
    <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Community hub</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Meetings as civic events in {summary.community_name}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Upcoming meetings show what residents can watch next. Completed meetings summarize decisions, votes, spending, cases, and public-comment opportunities when reviewed source material is available.
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
            <p className="text-sm font-semibold text-slate-100">Upcoming civic events</p>
            <div className="mt-4 space-y-3">
              {summary.upcoming_meetings.length ? (
                summary.upcoming_meetings.map((meeting) => (
                  <article key={meeting.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{formatDate(meeting.meeting_date)}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{meeting.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{meeting.public_body_name}</p>
                    {meeting.major_topics?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {meeting.major_topics.slice(0, 3).map((topic) => (
                          <span key={topic} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300">
                            {cleanTopic(topic)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Expected topics will come from the agenda as source parsing improves. Open the details to review agenda material and public-comment timing.
                      </p>
                    )}
                    {meeting.agenda_url ? (
                      <Link href={meeting.agenda_url} className="mt-2 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Agenda
                      </Link>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyPanel text="No upcoming local meetings are currently parsed. Statewide or county records may still appear in the community dashboard above." />
              )}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">What changed recently</p>
            <div className="mt-4 space-y-3">
              {summary.recent_decisions.length ? (
                summary.recent_decisions.map((decision) => (
                  <article key={decision.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{formatDate(decision.meeting_date)}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{cleanTopic(decision.title)}</p>
                    <p className="mt-1 text-xs text-slate-500">{decision.public_body_name}{decision.result ? ` · ${decision.result}` : ""}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      This is a source-backed meeting action. It may represent a motion, vote outcome, approval, denial, or other official decision.
                    </p>
                    {decision.source_url ? (
                      <Link href={decision.source_url} className="mt-2 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Source
                      </Link>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyPanel text="No reviewed local vote decisions currently available." />
              )}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Voting questions residents can understand</p>
            <div className="mt-4 space-y-3">
              {summary.open_questions.length ? (
                summary.open_questions.map((question) => (
                  <article key={question.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] font-semibold text-cyan-100">{question.policy_area}</span>
                      {question.civic_layer_label ? <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300">{question.civic_layer_label}</span> : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{question.public_question ?? cleanTopic(question.question_text)}</p>
                    <p className="mt-1 text-xs text-slate-500">{question.jurisdiction_display_name ?? question.jurisdiction} · {question.review_status} · {question.outcome_status} · {Math.round(question.confidence_score * 100)}% confidence</p>
                    {question.citizen_summary || question.plain_language_summary ? (
                      <p className="mt-2 text-xs leading-5 text-slate-400">{question.citizen_summary ?? question.plain_language_summary}</p>
                    ) : null}
                    {question.source_title ? <p className="mt-2 text-xs text-slate-500">Source: {[question.source_item_number, question.source_title].filter(Boolean).join(" / ")}</p> : null}
                  </article>
                ))
              ) : (
                <EmptyPanel text="No reviewed local voting questions currently available." />
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
                    <p className="mt-2 text-sm font-semibold text-slate-100">{cleanTopic(item.title)}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.fiscal_impact_summary}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Spending items may affect budgets, grants, contracts, fees, services, or public resources.
                    </p>
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
                <EmptyPanel text="No reviewed local spending items or public-comment opportunities currently available." />
              )}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 lg:col-span-2">
            <p className="text-sm font-semibold text-slate-100">Public cases</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {summary.public_cases?.length ? (
                summary.public_cases.map((caseItem) => (
                  <article key={caseItem.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] font-semibold text-cyan-100">{caseItem.civic_layer_label}</span>
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[11px] font-semibold text-amber-100">{caseItem.review_status}</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300">{caseItem.priority}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{caseItem.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{caseItem.plain_language_summary}</p>
                    {caseItem.related_meeting_id ? (
                      <Link href={`/events/${caseItem.related_meeting_id}`} className="mt-2 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Meeting source
                      </Link>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyPanel text="No reviewed local court cases currently available." />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
