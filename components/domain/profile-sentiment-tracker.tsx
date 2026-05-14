import Link from "next/link";

import { SentimentHistoryChart } from "@/components/domain/sentiment-history-chart";
import { VoteCard } from "@/components/domain/vote-card";
import type { ProfileSentimentSummary } from "@/lib/votes/profile-sentiment";

type ProfileSentimentTrackerProps = {
  title: string;
  summary: ProfileSentimentSummary;
  returnPath: string;
  canVote?: boolean;
};

function trendTone(direction: ProfileSentimentSummary["trendDirection"]) {
  if (direction === "up") return "bg-emerald-50 text-emerald-700";
  if (direction === "down") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function SentimentHistoryGraph({ summary }: { summary: ProfileSentimentSummary }) {
  const safeHistory = summary.history.filter(
    (point) =>
      typeof point.label === "string" &&
      Number.isFinite(point.supportPercent) &&
      Number.isFinite(point.mixedPercent) &&
      Number.isFinite(point.opposePercent),
  );

  if (safeHistory.length < 2) {
    return null;
  }

  const highest = safeHistory.reduce((best, point) => (point.supportPercent > best.supportPercent ? point : best), safeHistory[0]);
  const lowest = safeHistory.reduce((best, point) => (point.supportPercent < best.supportPercent ? point : best), safeHistory[0]);
  const latest = safeHistory.at(-1) ?? safeHistory[safeHistory.length - 1];

  return (
    <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-50/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{summary.historyWindowLabel}</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-ink">52-week sentiment trend</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">Approve</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Mixed</span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">Disapprove</span>
        </div>
      </div>

      <div className="mt-4">
        <SentimentHistoryChart
          data={safeHistory.map((point) => ({
            label: point.label,
            date: point.label,
            supportPercent: point.supportPercent,
            opposePercent: point.opposePercent,
            undecidedPercent: point.mixedPercent,
          }))}
          title="Sentiment over time"
          currentValue={latest.supportPercent}
        />
      </div>

      {summary.historyTakeaway ? <p className="mt-4 text-sm leading-6 text-slate-600">{summary.historyTakeaway}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-ink">{latest.supportPercent}%</p>
          <p className="mt-1 text-xs text-slate-500">{latest.label}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">High</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-ink">{highest.supportPercent}%</p>
          <p className="mt-1 text-xs text-slate-500">{highest.label}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Low</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-ink">{lowest.supportPercent}%</p>
          <p className="mt-1 text-xs text-slate-500">{lowest.label}</p>
        </div>
      </div>
    </div>
  );
}

export function ProfileSentimentTracker({ title, summary, returnPath, canVote = true }: ProfileSentimentTrackerProps) {
  const total = Math.max(summary.totalResponses, 1);
  const segments = [
    {
      label: "Approve",
      count: summary.supportCount,
      percent: summary.supportPercent,
      barClass: "bg-emerald-500",
      chipClass: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Mixed",
      count: summary.mixedCount,
      percent: summary.mixedPercent,
      barClass: "bg-slate-400",
      chipClass: "bg-slate-100 text-slate-700",
    },
    {
      label: "Disapprove",
      count: summary.opposeCount,
      percent: summary.opposePercent,
      barClass: "bg-rose-500",
      chipClass: "bg-rose-50 text-rose-700",
    },
  ];

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)]">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-civic-700">Weekly public vote</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
              {summary.totalResponses} community vote{summary.totalResponses === 1 ? "" : "s"}
            </span>
          </div>

          <p className="mt-4 text-sm font-medium leading-6 text-slate-700">{summary.summary}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{summary.description}</p>

          <div className="mt-4 overflow-hidden rounded-full bg-slate-100 shadow-inner">
            <div className="flex h-3.5 w-full min-w-0">
              {segments.map((segment) =>
                segment.count ? <div key={segment.label} className={segment.barClass} style={{ width: `${(segment.count / total) * 100}%` }} /> : null,
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {segments.map((segment) => (
              <div key={segment.label} className="rounded-2xl border border-slate-200 bg-white/95 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{segment.label}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${segment.chipClass}`}>{segment.count}</span>
                </div>
                <p className="mt-2 text-xl font-semibold tracking-tight text-ink">{segment.percent}%</p>
              </div>
            ))}
          </div>

          {summary.trendLabel ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${trendTone(summary.trendDirection)}`}>
                Trend
              </span>
              <p className="text-sm text-slate-600">{summary.trendLabel}</p>
            </div>
          ) : null}

          <SentimentHistoryGraph summary={summary} />
        </div>

        <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Cast your weekly vote</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink">{summary.currentQuestion.subjectName ?? "Representative sentiment vote"}</h3>
            </div>
            {summary.currentQuestion.subjectHref ? (
              <Link
                href={summary.currentQuestion.subjectHref}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Open profile
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            <VoteCard question={summary.currentQuestion} compact returnPath={returnPath} canAnswer={canVote} />
          </div>
        </div>
      </div>
    </section>
  );
}
