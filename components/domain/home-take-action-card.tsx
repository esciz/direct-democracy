"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";

import { HomeVotePreviewPane } from "@/components/domain/home-vote-preview-pane";
import type { VoteQuestionCardSummary } from "@/types/domain";

export type HomeTakeActionIssue = {
  id: string;
  title: string;
  summary: string;
  meta: string;
  href: string;
};

export type HomeTakeActionMeeting = {
  id: string;
  title: string;
  summary: string;
  meta: string;
  href: string;
  status: "upcoming" | "past";
};

export type HomeTakeActionSignal = {
  id: string;
  label: string;
  title: string;
  summary: string;
  href: string;
  opposingPoint?: string | null;
};

export type HomeTakeActionPoll = {
  id: string;
  title: string;
  summary: string;
  meta: string;
  href: string;
};

export type HomeTakeActionPetition = {
  id: string;
  title: string;
  summary: string;
  meta: string;
  href: string;
};

type HomeTakeActionCardProps = {
  communityName: string;
  voteQuestions: VoteQuestionCardSummary[];
  canVote: boolean;
  activeIssues: HomeTakeActionIssue[];
  savedIssues: HomeTakeActionIssue[];
  meetings: HomeTakeActionMeeting[];
  signals: HomeTakeActionSignal[];
  polls: HomeTakeActionPoll[];
  petitions: HomeTakeActionPetition[];
};

type TabId = "vote" | "issues" | "meetings" | "signal" | "polls" | "petitions";

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  { id: "vote", label: "Vote", description: "Answer the next formal civic question." },
  { id: "issues", label: "Issues", description: "Track active, trending, and saved issues." },
  { id: "meetings", label: "Meetings", description: "See upcoming and recent civic events." },
  { id: "signal", label: "Voices", description: "Read useful comments with counterpoints." },
  { id: "polls", label: "Polls", description: "Respond to citizen polls in context." },
  { id: "petitions", label: "Petitions", description: "Support structured public requests." },
];

function EmptyTab({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/[0.035] p-6 text-sm leading-6 text-slate-400">
      <p>{text}</p>
      <Link href={href} className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100">
        {action}
      </Link>
    </div>
  );
}

function ActionList({
  items,
  empty,
}: {
  items: Array<{
    id: string;
    label?: string;
    title: string;
    summary: string;
    meta?: string;
    href: string;
    opposingPoint?: string | null;
  }>;
  empty: ReactNode;
}) {
  if (!items.length) {
    return <>{empty}</>;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
          <div className="flex flex-wrap items-center gap-2">
            {item.label ? (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                {item.label}
              </span>
            ) : null}
            {item.meta ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {item.meta}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-50">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{item.summary}</p>
          {item.opposingPoint ? (
            <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
              <span className="font-semibold">Counterpoint:</span> {item.opposingPoint}
            </div>
          ) : null}
          <Link href={item.href} className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100">
            Open
          </Link>
        </article>
      ))}
    </div>
  );
}

export function HomeTakeActionCard({
  communityName,
  voteQuestions,
  canVote,
  activeIssues,
  savedIssues,
  meetings,
  signals,
  polls,
  petitions,
}: HomeTakeActionCardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("vote");
  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const issueItems = useMemo(
    () => [
      ...activeIssues.map((issue) => ({ ...issue, label: "Active / trending" })),
      ...savedIssues.map((issue) => ({ ...issue, label: "Saved" })),
    ],
    [activeIssues, savedIssues],
  );
  const upcomingMeetings = meetings.filter((meeting) => meeting.status === "upcoming");
  const pastMeetings = meetings.filter((meeting) => meeting.status === "past");

  return (
    <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Take Action</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Your civic action card</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            One place to vote, track issues, prepare for meetings, read useful voices, answer polls, and support petitions in {communityName}.
          </p>
        </div>
        <Link href="/take-action" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/20 hover:text-cyan-100">
          Full action center
        </Link>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/15 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full rounded-[1.1rem] px-4 py-3 text-left transition ${
                activeTab === tab.id
                  ? "bg-civic-400 text-slate-950"
                  : "text-slate-300 hover:bg-white/[0.06] hover:text-slate-50"
              }`}
            >
              <span className="block text-sm font-semibold">{tab.label}</span>
              <span className={`mt-1 block text-xs leading-5 ${activeTab === tab.id ? "text-slate-800" : "text-slate-500"}`}>
                {tab.description}
              </span>
            </button>
          ))}
        </div>

        <div className="min-w-0 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{selectedTab.label}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-50">{selectedTab.description}</h3>
            </div>
          </div>

          {activeTab === "vote" ? (
            <HomeVotePreviewPane questions={voteQuestions} canVote={canVote} />
          ) : null}

          {activeTab === "issues" ? (
            <ActionList
              items={issueItems}
              empty={<EmptyTab text="No active or saved issues are ready for this home view yet." href="/issues" action="Browse issues" />}
            />
          ) : null}

          {activeTab === "meetings" ? (
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-100">Upcoming</p>
                <ActionList
                  items={upcomingMeetings.map((meeting) => ({ ...meeting, label: "Upcoming" }))}
                  empty={<EmptyTab text="No upcoming meetings are currently parsed for this community." href="/events" action="Browse events" />}
                />
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold text-slate-100">Past decisions</p>
                <ActionList
                  items={pastMeetings.map((meeting) => ({ ...meeting, label: "Recent" }))}
                  empty={<EmptyTab text="No recent meeting decisions are reviewed yet." href="/events" action="Browse past events" />}
                />
              </div>
            </div>
          ) : null}

          {activeTab === "signal" ? (
            <ActionList
              items={signals}
              empty={<EmptyTab text="No follower or trusted-voice comments are ready here yet." href="/feed" action="Open feed" />}
            />
          ) : null}

          {activeTab === "polls" ? (
            <ActionList
              items={polls.map((poll) => ({ ...poll, label: "Poll" }))}
              empty={<EmptyTab text="No active contextual polls are available right now." href="/polls" action="Browse polls" />}
            />
          ) : null}

          {activeTab === "petitions" ? (
            <ActionList
              items={petitions.map((petition) => ({ ...petition, label: "Petition" }))}
              empty={<EmptyTab text="No source-backed petitions are ready for this community yet." href="/petitions" action="Browse petitions" />}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
