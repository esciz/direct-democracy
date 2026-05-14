"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type UpcomingElectionPaneItem = {
  id: string;
  title: string;
  jurisdictionLabel: string;
  levelLabel: string;
  dateLabel: string;
  countdownLabel: string;
  milestoneLabel: string;
  relevanceNote: string;
  summary: string;
  keyRacesSummary: string;
  ballotMeasuresSummary: string;
  href: string;
};

type HomeUpcomingElectionsPaneProps = {
  elections: UpcomingElectionPaneItem[];
};

export function HomeUpcomingElectionsPane({ elections }: HomeUpcomingElectionsPaneProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentElection = elections[currentIndex] ?? null;
  const progressLabel = useMemo(() => {
    if (!elections.length) {
      return "No upcoming elections";
    }

    return `Election ${currentIndex + 1} of ${elections.length}`;
  }, [currentIndex, elections.length]);

  if (!elections.length) {
    return (
      <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
        No upcoming elections found for your jurisdictions.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{progressLabel}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{elections.length} applicable elections</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex <= 0}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/20 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex((index) => Math.min(elections.length - 1, index + 1))}
            disabled={currentIndex >= elections.length - 1}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/20 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Skip
          </button>
          <Link
            href="/elections"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/20 hover:text-cyan-100"
          >
            View all
          </Link>
        </div>
      </div>

      {currentElection ? (
        <article className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(165deg,rgba(11,21,37,0.98),rgba(6,12,24,0.98))] p-6 shadow-[0_28px_60px_-36px_rgba(2,8,23,0.92)] backdrop-blur sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(129,140,248,0.1),transparent_30%)]" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              Upcoming Election
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
              {currentElection.jurisdictionLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
              {currentElection.levelLabel}
            </span>
            <span className="rounded-full border border-amber-300/18 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
              {currentElection.relevanceNote}
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50">{currentElection.title}</h3>
          <p className="mt-2 text-sm text-slate-400">{currentElection.dateLabel}</p>

          <div className="mt-4 rounded-[1.25rem] border border-emerald-300/18 bg-emerald-500/10 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">{currentElection.milestoneLabel}</p>
            <p className="mt-2 text-lg font-semibold text-slate-50">{currentElection.countdownLabel}</p>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-400">{currentElection.summary}</p>

          <div className="mt-4 space-y-3">
            <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Key races</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{currentElection.keyRacesSummary}</p>
            </div>
            <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ballot measures</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{currentElection.ballotMeasuresSummary}</p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href={currentElection.href}
              className="dd-button-primary inline-flex rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
            >
              View Election
            </Link>
          </div>
        </article>
      ) : null}
    </div>
  );
}
