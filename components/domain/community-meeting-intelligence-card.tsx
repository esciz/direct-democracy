import Link from "next/link";

import { CivicDetails } from "@/components/ui/civic-details";
import { highLevelSummary, plainLanguageTitle } from "@/lib/civic/plain-language";
import type { CommunityMeetingSummary } from "@/lib/public-meetings/types";

function formatDate(value: string | null) {
  if (!value) return "Date pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="dd-simple-card border-dashed text-sm leading-6 text-slate-400">{highLevelSummary(text, text)}</div>;
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
      <div>
        <p className="text-xs font-semibold text-cyan-200">Local meetings</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">What is happening in {summary.community_name}?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Start with the next meetings and recent decisions. Open the extra records only when you want more detail.
        </p>
      </div>

      {!hasAnyRecords ? (
        <div className="mt-5"><EmptyPanel text="No reviewed meeting records are available for this community yet." /></div>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Coming up</h3>
              <div className="mt-3 space-y-3">
                {summary.upcoming_meetings.length ? summary.upcoming_meetings.slice(0, 3).map((meeting) => (
                  <article key={meeting.id} className="dd-simple-card">
                    <p className="text-xs font-semibold text-cyan-200">{formatDate(meeting.meeting_date)}</p>
                    <h4 className="mt-2 text-sm font-semibold leading-6 text-slate-100">{plainLanguageTitle(meeting.title)}</h4>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {meeting.major_topics?.length
                        ? `Likely topics: ${meeting.major_topics.slice(0, 2).map((topic) => plainLanguageTitle(topic, 70)).join(" · ")}`
                        : "Open the agenda for topics and public-comment details."}
                    </p>
                    {meeting.agenda_url ? <Link href={meeting.agenda_url} className="mt-3 inline-flex text-xs font-semibold text-cyan-200">View agenda →</Link> : null}
                    <CivicDetails label="Meeting source details">
                      <p>{meeting.public_body_name}</p>
                      <p>{meeting.relationship_scope === "statewide_overlay" ? "Statewide meeting relevant to this community" : "Local meeting record"}</p>
                    </CivicDetails>
                  </article>
                )) : <EmptyPanel text="No upcoming local meetings are available." />}
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-100">What changed</h3>
              <div className="mt-3 space-y-3">
                {summary.recent_decisions.length ? summary.recent_decisions.slice(0, 3).map((decision) => (
                  <article key={decision.id} className="dd-simple-card">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-cyan-200">{formatDate(decision.meeting_date)}</p>
                      {decision.result ? <span className="text-xs font-medium text-emerald-200">{decision.result}</span> : null}
                    </div>
                    <h4 className="mt-2 text-sm font-semibold leading-6 text-slate-100">{plainLanguageTitle(decision.title)}</h4>
                    <p className="mt-1 text-xs leading-5 text-slate-400">A recorded action by {decision.public_body_name}.</p>
                    {decision.source_url ? <Link href={decision.source_url} className="mt-3 inline-flex text-xs font-semibold text-cyan-200">View source →</Link> : null}
                  </article>
                )) : <EmptyPanel text="No reviewed recent decisions are available." />}
              </div>
            </div>
          </div>

          <CivicDetails label="More meeting records" className="mt-6">
            <div className="grid gap-6 pt-2 lg:grid-cols-2">
              <div>
                <h3 className="font-semibold text-slate-200">Questions for residents</h3>
                <div className="mt-3 space-y-3">
                  {summary.open_questions.length ? summary.open_questions.map((question) => (
                    <article key={question.id} className="dd-simple-card">
                      <h4 className="text-sm font-semibold leading-6 text-slate-100">{plainLanguageTitle(question.public_question ?? question.question_text, 150)}</h4>
                      {question.citizen_summary || question.plain_language_summary ? <p className="mt-2 text-xs leading-5 text-slate-400">{highLevelSummary(question.citizen_summary ?? question.plain_language_summary, "A summary is being reviewed.", 150)}</p> : null}
                      <CivicDetails><p>{question.policy_area} · {question.jurisdiction_display_name ?? question.jurisdiction} · {Math.round(question.confidence_score * 100)}% confidence</p></CivicDetails>
                    </article>
                  )) : <EmptyPanel text="No reviewed voting questions are available." />}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-200">Spending and public comment</h3>
                <div className="mt-3 space-y-3">
                  {summary.recently_approved_spending.length ? summary.recently_approved_spending.map((item) => (
                    <article key={item.id} className="dd-simple-card">
                      <h4 className="text-sm font-semibold leading-6 text-slate-100">{plainLanguageTitle(item.title)}</h4>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{highLevelSummary(item.fiscal_impact_summary, "The cost details are still being reviewed.", 140)}</p>
                    </article>
                  )) : summary.public_comment_opportunities.length ? summary.public_comment_opportunities.map((meeting) => (
                    <article key={meeting.id} className="dd-simple-card">
                      <p className="text-xs text-cyan-200">{formatDate(meeting.meeting_date)}</p>
                      <h4 className="mt-2 text-sm font-semibold text-slate-100">{plainLanguageTitle(meeting.title)}</h4>
                      {meeting.agenda_url ? <Link href={meeting.agenda_url} className="mt-3 inline-flex text-xs font-semibold text-cyan-200">How to comment →</Link> : null}
                    </article>
                  )) : <EmptyPanel text="No spending or public-comment records are available." />}
                </div>
              </div>

              {summary.public_cases?.length ? (
                <div className="lg:col-span-2">
                  <h3 className="font-semibold text-slate-200">Related public cases</h3>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {summary.public_cases.map((caseItem) => (
                      <article key={caseItem.id} className="dd-simple-card">
                        <h4 className="text-sm font-semibold leading-6 text-slate-100">{plainLanguageTitle(caseItem.title)}</h4>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{highLevelSummary(caseItem.plain_language_summary, "This public case is being reviewed.", 150)}</p>
                        {caseItem.related_meeting_id ? <Link href={`/events/${caseItem.related_meeting_id}`} className="mt-3 inline-flex text-xs font-semibold text-cyan-200">View related meeting →</Link> : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </CivicDetails>
        </>
      )}
    </section>
  );
}
