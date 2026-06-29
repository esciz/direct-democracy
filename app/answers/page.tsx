import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { getResidentQuestionAnswersRuntime } from "@/lib/cases/resident-intake-store";

function targetLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parsed);
}

export default async function ResidentAnswersPage() {
  const runtime = await getResidentQuestionAnswersRuntime();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Resident Answers"
        title="Reviewed civic Q&A"
        description="Public answers from resident-submitted questions after moderation and routing review. Raw resident submissions, private notes, and unverified claims stay private."
        meta={
          <>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {runtime.totals.reviewedAnswers} reviewed answers
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {runtime.totals.answersWithSourceUrl} with source links
            </span>
          </>
        }
        actions={
          <Link href="/cases/submit" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
            Ask a question
          </Link>
        }
      />

      <section className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-300/10 p-6 shadow-card">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Public boundary</p>
        <p className="mt-3 text-sm leading-6 text-cyan-50/85">
          These answers are published only after review. They summarize a routed civic question and reviewed answer without exposing the resident's raw submission, private contact details, or internal reviewer notes.
        </p>
      </section>

      {runtime.records.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {runtime.records.map((answer) => (
            <article key={answer.id} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                <span className="rounded-full bg-civic-50 px-2.5 py-1 text-civic-700">Reviewed answer</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{targetLabel(answer.targetType)}</span>
                {answer.community ? <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-cyan-700">{answer.community}</span> : null}
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">{answer.questionTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{answer.answerSummary}</p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">Routed to:</span> {answer.recipientName ?? "Reviewed civic body"}{" "}
                  <span className="text-slate-500">({targetLabel(answer.recipientType)})</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">Published {formatDate(answer.publishedAt)}</p>
              </div>
              {answer.sourceUrl ? (
                <Link href={answer.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Open source
                </Link>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-[1.75rem] border border-dashed border-white/20 bg-white/[0.04] p-8 text-center shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">No reviewed answers yet</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-50">Resident questions are still private or under review.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Answers appear here only when an admin marks a routed question as answer published and provides a reviewed answer summary.
          </p>
        </section>
      )}
    </div>
  );
}
