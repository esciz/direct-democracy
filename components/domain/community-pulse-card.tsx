import type { VoteQuestionCardSummary } from "@/types/domain";

type CommunityPulseCardProps = {
  question: VoteQuestionCardSummary;
};

export function CommunityPulseCard({ question }: CommunityPulseCardProps) {
  return (
    <article className="rounded-3xl bg-slate-50 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          {question.communityLabel}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {question.voteType ? question.voteType.replace(/([A-Z])/g, " $1") : "Public vote"}
        </span>
      </div>
      {question.shortTitle ? <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{question.shortTitle}</p> : null}
      <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">{question.questionText}</h3>
      {question.plainLanguageSummary ? <p className="mt-2 text-sm leading-6 text-slate-600">{question.plainLanguageSummary}</p> : null}
      <div className="mt-4 space-y-3">
        {(["yes", "no", "skip"] as const).map((answer) => (
          <div key={answer} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>{answer}</span>
              <span>{question.percentages[answer]}%</span>
            </div>
            <div className="h-2 rounded-full bg-white">
              <div className="h-2 rounded-full bg-civic-500" style={{ width: `${question.percentages[answer]}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {question.totalResponses} public responses
      </p>
    </article>
  );
}
