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
      <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
        No upcoming elections found for your jurisdictions.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">{progressLabel}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{elections.length} applicable elections</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex <= 0}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex((index) => Math.min(elections.length - 1, index + 1))}
            disabled={currentIndex >= elections.length - 1}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Skip
          </button>
          <Link
            href="/elections"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700"
          >
            View all
          </Link>
        </div>
      </div>

      {currentElection ? (
        <article className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
              Upcoming Election
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {currentElection.jurisdictionLabel}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {currentElection.levelLabel}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {currentElection.relevanceNote}
            </span>
          </div>

          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{currentElection.title}</h3>
          <p className="mt-2 text-sm text-slate-600">{currentElection.dateLabel}</p>

          <div className="mt-4 rounded-[1.25rem] border border-civic-200 bg-civic-50/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{currentElection.milestoneLabel}</p>
            <p className="mt-2 text-lg font-semibold text-ink">{currentElection.countdownLabel}</p>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-600">{currentElection.summary}</p>

          <div className="mt-4 space-y-3">
            <div className="rounded-[1.15rem] bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Key races</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{currentElection.keyRacesSummary}</p>
            </div>
            <div className="rounded-[1.15rem] bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ballot measures</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{currentElection.ballotMeasuresSummary}</p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href={currentElection.href}
              className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              View Election
            </Link>
          </div>
        </article>
      ) : null}
    </div>
  );
}
