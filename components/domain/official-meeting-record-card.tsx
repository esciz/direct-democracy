import Link from "next/link";

import type { OfficialMeetingRecordSummary } from "@/lib/public-meetings/types";

function formatDate(value: string | null) {
  if (!value) return "Date pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatPercent(value: number | null) {
  return typeof value === "number" ? `${Math.round(value)}%` : "Answer questions";
}

function voteLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function OfficialMeetingRecordCard({ summary }: { summary: OfficialMeetingRecordSummary }) {
  const hasVotes = summary.matched_vote_count > 0;

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Meeting voting record</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Source-backed local decisions</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Agenda, minutes, packet, and roll-call records are imported from public meeting sources and kept with source links and confidence labels.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
          Updated {formatDate(summary.last_updated_at)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Matched votes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{summary.matched_vote_count}</p>
        </div>
        <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Policy areas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{summary.by_policy_area.length}</p>
        </div>
        <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Citizen questions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{summary.matched_question_count}</p>
        </div>
        <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Your alignment</p>
          <p className="mt-2 text-2xl font-semibold text-slate-50">{formatPercent(summary.citizen_alignment_percent)}</p>
        </div>
      </div>

      {hasVotes ? (
        <>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-slate-100">Voting record by policy area</p>
              <div className="mt-4 space-y-3">
                {summary.by_policy_area.map((area) => (
                  <div key={area.policy_area} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">{area.policy_area}</p>
                      <p className="text-xs font-semibold text-slate-400">{area.total} vote{area.total === 1 ? "" : "s"}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {area.yes} yes · {area.no} no · {area.abstain} abstain · {area.absent} absent · {area.recused} recused
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-slate-100">Recent notable votes</p>
              <div className="mt-4 space-y-3">
                {summary.recent_notable_votes.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-white/10 bg-black/15 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{formatDate(entry.meeting_date)}</p>
                      <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                        {voteLabel(entry.vote)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-100">{entry.item_title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {entry.public_body_name} · {entry.policy_area} · {Math.round(entry.confidence_score * 100)}% confidence
                    </p>
                    {entry.source_url ? (
                      <Link href={entry.source_url} className="mt-2 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Open source
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-sm font-semibold text-slate-100">Source-backed timeline</p>
            <div className="mt-4 space-y-2">
              {summary.source_backed_timeline.map((entry) => (
                <div key={entry.id} className="grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-3 text-sm md:grid-cols-[8rem_1fr_auto] md:items-center">
                  <p className="text-xs font-semibold text-slate-500">{formatDate(entry.meeting_date)}</p>
                  <div>
                    <p className="font-semibold text-slate-100">{entry.item_title}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.public_body_name} · {entry.policy_area}</p>
                  </div>
                  {entry.source_url ? (
                    <Link href={entry.source_url} className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                      Source
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-500">Source pending</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
          Source-backed meeting votes have not been imported for this profile yet. Once an admin imports agendas, minutes, packets, or transcripts, verified vote records and citizen questions will appear here with source links.
        </div>
      )}
    </section>
  );
}
