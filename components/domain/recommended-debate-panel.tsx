import Link from "next/link";

import type { DebateRecommendationSummary } from "@/types/domain";

type RecommendedDebatePanelProps = {
  title: string;
  description: string;
  recommendations: DebateRecommendationSummary[];
  compact?: boolean;
};

export function RecommendedDebatePanel({
  title,
  description,
  recommendations,
  compact = false,
}: RecommendedDebatePanelProps) {
  if (!recommendations.length) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Recommended Debates</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>

      <div className={`mt-6 grid gap-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        {recommendations.map((recommendation) => (
          <article key={recommendation.id} className="rounded-3xl bg-slate-50 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-civic-700 ring-1 ring-slate-200">
                {recommendation.reasonLabel}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {recommendation.issueText}
              </span>
            </div>

            <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{recommendation.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{recommendation.description}</p>
            <p className="mt-3 text-sm text-slate-600">{recommendation.reasonDescription}</p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{recommendation.jurisdictionName}</span>
              {recommendation.opponentName ? (
                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                  {recommendation.opponentName}
                  {recommendation.opponentRole ? ` · ${recommendation.opponentRole}` : ""}
                </span>
              ) : null}
              {recommendation.opponentCredibilityLabel ? (
                <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">
                  Credibility: {recommendation.opponentCredibilityLabel}
                </span>
              ) : null}
            </div>

            {recommendation.rewardHint ? <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500">{recommendation.rewardHint}</p> : null}

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-500">Recommended because this issue matters in your civic record.</span>
              <Link href={recommendation.href} className="text-sm font-semibold text-civic-700 transition hover:text-civic-900">
                {recommendation.callToActionLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
