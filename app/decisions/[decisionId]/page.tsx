import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { getResidentQuestionAnswersForTarget } from "@/lib/cases/resident-intake-store";
import { getDecisionPageData, type DecisionVoteRecord } from "@/lib/civic/decision-pages";
import { getDecisionTrustView } from "@/lib/civic/public-decision-trust";

type DecisionPageProps = {
  params: Promise<{
    decisionId: string;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function confidenceLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "Confidence unknown";
  return `${Math.round(value * 100)}% confidence`;
}

function Pill({ children, tone = "slate" }: { children: string; tone?: "slate" | "cyan" | "green" | "amber" | "rose" }) {
  const classes = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    cyan: "border-cyan-300/20 bg-cyan-500/10 text-cyan-200",
    green: "border-emerald-300/20 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-300/20 bg-amber-500/10 text-amber-200",
    rose: "border-rose-300/20 bg-rose-500/10 text-rose-200",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${classes[tone]}`}>{children}</span>;
}

function voteTone(vote: string): "green" | "rose" | "amber" | "slate" {
  if (vote === "yes") return "green";
  if (vote === "no") return "rose";
  if (vote === "abstain") return "amber";
  return "slate";
}

function evidenceLabel(vote: DecisionVoteRecord) {
  if (vote.evidenceType === "unanimous_with_attendance_roster") return "attendance verified";
  if (vote.evidenceType === "explicit_roll_call_group") return "roll-call group";
  if (vote.evidenceType === "inline_named_vote") return "inline named vote";
  if (vote.evidenceType === "motion_mover") return "motion maker";
  if (vote.evidenceType === "motion_second") return "second";
  return vote.evidenceType.replaceAll("_", " ");
}

function voteAttributionSummary(input: { namedVotes: DecisionVoteRecord[]; voteCountDisplay: string; totalKnown: number }) {
  if (input.namedVotes.length > 0) {
    return {
      label: `${input.namedVotes.length} named vote${input.namedVotes.length === 1 ? "" : "s"} parsed`,
      tone: "green" as const,
      description: "Individual votes are shown because the source evidence explicitly connects names to vote choices or validated attendance logic.",
    };
  }
  if (!/^no\b/i.test(input.voteCountDisplay)) {
    return {
      label: "Aggregate outcome only",
      tone: "amber" as const,
      description: "The source gives an outcome or vote count, but Direct Democracy is not assigning individual votes without named source text or verified attendance.",
    };
  }
  return {
    label: "Vote attribution needs review",
    tone: "slate" as const,
    description: "The current source records do not support individual vote attribution yet.",
  };
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-slate-950/20 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function DecisionPage({ params }: DecisionPageProps) {
  const { decisionId } = await params;
  const [data, residentAnswers] = await Promise.all([
    getDecisionPageData(decisionId),
    getResidentQuestionAnswersForTarget({ targetType: "decision", targetId: decisionId, limit: 3 }),
  ]);
  if (!data) notFound();

  const { decision, actionResult, namedVotes, motionMetadata, projects, issues } = data;
  const money = formatMoney(decision.financialImpact.estimatedAmount);
  const trust = getDecisionTrustView(decision);
  const needsReview = trust.state === "needs_review" || actionResult?.needsReview;
  const voteStatus =
    namedVotes.length > 0
      ? `${namedVotes.length} named vote${namedVotes.length === 1 ? "" : "s"} parsed`
      : decision.voteCount.totalKnown > 0
        ? decision.voteCount.display
        : "Individual votes not parsed";
  const voteAttribution = voteAttributionSummary({ namedVotes, voteCountDisplay: decision.voteCount.display, totalKnown: decision.voteCount.totalKnown });

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href={decision.meeting.href || "/events"} className="inline-flex text-sm font-semibold text-cyan-200 hover:text-cyan-100">
          Back to meeting
        </Link>

        <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),rgba(15,23,42,0.96)] p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
          <div className="flex flex-wrap gap-2">
            <Pill tone="cyan">{decision.decisionType}</Pill>
            <Pill tone={decision.voteOutcome === "approved" ? "green" : decision.voteOutcome === "denied" ? "rose" : "slate"}>{decision.voteOutcome}</Pill>
            <Pill tone={trust.tone}>{trust.label}</Pill>
            <Pill tone={voteAttribution.tone}>{voteAttribution.label}</Pill>
            <Pill>{confidenceLabel(decision.confidence)}</Pill>
          </div>
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Citizen decision</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">{decision.title}</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">{decision.summary}</p>
              <p className="mt-5 max-w-3xl rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50">
                Why it matters: {decision.whyItMatters}
              </p>
              <p className="mt-3 max-w-3xl rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">
                Vote attribution: {voteAttribution.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <FavoriteToggleControl
                  targetType="decision"
                  targetId={decision.id}
                  visibleLabel="Follow decision"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/15"
                />
                <Link href={`/cases/submit?targetType=decision&targetId=${encodeURIComponent(decision.id)}&topic=${encodeURIComponent(decision.title)}&agency=${encodeURIComponent(decision.meeting.bodyName)}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100">
                  Ask about this decision
                </Link>
                <Link href="/profile" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100">
                  View watchlist
                </Link>
              </div>
            </div>
            <aside className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">At a glance</p>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-slate-500">Jurisdiction</dt>
                  <dd className="mt-1 font-semibold text-slate-100">{decision.jurisdiction}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Public body</dt>
                  <dd className="mt-1 font-semibold text-slate-100">{decision.meeting.bodyName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Meeting date</dt>
                  <dd className="mt-1 font-semibold text-slate-100">{formatDate(decision.meeting.date)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Vote status</dt>
                  <dd className="mt-1 font-semibold text-slate-100">{voteStatus}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Money involved</dt>
                  <dd className="mt-1 font-semibold text-slate-100">{money ?? decision.financialImpact.description ?? decision.financialImpact.raw ?? "No amount parsed"}</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <div className={`rounded-2xl border p-4 text-sm leading-6 ${trust.state === "approved" ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : trust.state === "ready" ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100" : "border-amber-300/20 bg-amber-500/10 text-amber-100"}`}>
          <span className="font-semibold">{trust.label}.</span> {trust.description} The original source links and snippets remain visible below.
          {needsReview && actionResult?.needsReview ? " The extracted action result is also marked for review." : ""}
        </div>

        <Section eyebrow="Resident answers" title="Reviewed questions about this decision">
          {residentAnswers.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {residentAnswers.map((answer) => (
                <article key={answer.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="green">reviewed answer</Pill>
                    <Pill>{answer.recipientType.replaceAll("_", " ")}</Pill>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-50">{answer.questionTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{answer.answerSummary}</p>
                  <p className="mt-3 text-xs text-slate-500">Routed to {answer.recipientName ?? "reviewed civic body"}</p>
                  {answer.sourceUrl ? (
                    <a href={answer.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                      Open source
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
              No reviewed resident answers are linked to this decision yet. Submitted questions stay private until an admin publishes a reviewed answer.
            </div>
          )}
        </Section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Section eyebrow="Outcome" title="What happened?">
              <div className="space-y-4 text-sm leading-6 text-slate-300">
                <p>{actionResult?.outcome ?? decision.voteOutcome}</p>
                {actionResult?.motionText ? <p className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-slate-400">Motion: {actionResult.motionText}</p> : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Vote count", decision.voteCount.display],
                    ["Motion by", actionResult?.mover ?? motionMetadata.find((vote) => vote.action_type === "MOTION_MADE")?.official_name ?? "Not parsed"],
                    ["Second by", actionResult?.seconder ?? motionMetadata.find((vote) => vote.action_type === "MOTION_SECONDED")?.official_name ?? "Not parsed"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="mt-2 font-semibold text-slate-100">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Section eyebrow="Votes" title="Who voted for it?">
              {namedVotes.length ? (
                <div className="space-y-3">
                  {namedVotes.map((vote) => (
                    <article key={vote.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-50">{vote.official_name ?? "Official name pending"}</h3>
                          <p className="mt-1 text-xs text-slate-500">{vote.official_id ? `Matched official: ${vote.official_id}` : "Official identity not matched yet"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={voteTone(vote.vote)}>{vote.vote}</Pill>
                          <Pill tone={vote.evidenceType.includes("attendance") ? "amber" : "green"}>{evidenceLabel(vote)}</Pill>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-400">{vote.source_snippet ?? vote.vote_text ?? "Source snippet pending"}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {confidenceLabel(vote.confidence_score)}{vote.inference_rule ? ` · ${vote.inference_rule}` : ""}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
                  Individual named votes are not available for this action yet. The aggregate outcome remains visible when the source states it, but Direct Democracy does not assign individual votes without explicit source text or verified attendance logic.
                </div>
              )}
            </Section>

            <Section eyebrow="Accountability" title="Projects and issues connected to this decision">
              <div className="grid gap-4">
                {projects.length ? (
                  projects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06]">
                      <div className="flex flex-wrap gap-2">
                        <Pill tone="cyan">project</Pill>
                        <Pill tone={project.needsReview ? "amber" : "green"}>{project.status}</Pill>
                      </div>
                      <h3 className="mt-3 font-semibold text-slate-50">{project.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{project.description}</p>
                      <p className="mt-3 text-xs text-slate-500">{project.responsibleBody ?? project.jurisdiction} · {formatMoney(project.budget) ?? project.budgetDescription ?? "Budget not parsed"}</p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">No project record is currently linked to this decision.</div>
                )}
                {issues.length ? (
                  <div className="flex flex-wrap gap-2">
                    {issues.map((issue) => (
                      <Link key={issue.id} href={`/issues/${issue.issueSlug ?? issue.id}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:border-cyan-300/30">
                        {issue.issueText}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </Section>
          </div>

          <aside className="space-y-6">
            <Section eyebrow="Source" title="Official record">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-300">
                  <p className="font-semibold text-slate-50">Source trail comes after the citizen summary.</p>
                  <p className="mt-2 text-slate-400">Agenda IDs, packets, snippets, and cached paths support the explanation above; they are not used as the public headline unless no better plain-language summary exists.</p>
                </div>
                <Link href={decision.meeting.href || "/events"} className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm transition hover:border-cyan-300/25">
                  <p className="font-semibold text-slate-50">{decision.meeting.title}</p>
                  <p className="mt-2 text-slate-400">{decision.meeting.bodyName} · {formatDate(decision.meeting.date)}</p>
                  <span className="mt-3 inline-flex text-xs font-semibold text-cyan-200">Open meeting</span>
                </Link>
                {decision.sourceReferences.map((source, index) => {
                  const content = (
                    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm font-semibold text-slate-50">{source.label || `Source ${index + 1}`}</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{source.path ?? source.url ?? "Source path pending"}</p>
                      {source.snippet ? <p className="mt-3 text-sm leading-6 text-slate-400">{source.snippet}</p> : null}
                      <span className="mt-3 inline-flex text-xs font-semibold text-cyan-200">{source.url ? "Open source" : "Cached source"}</span>
                    </article>
                  );
                  return source.url ? (
                    <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="block">
                      {content}
                    </a>
                  ) : (
                    <div key={`${source.path}-${index}`}>{content}</div>
                  );
                })}
              </div>
            </Section>

            <Section eyebrow="Public impact" title="Who may be affected?">
              <div className="flex flex-wrap gap-2">
                {decision.affectedGroups.length ? decision.affectedGroups.map((group) => <Pill key={group}>{group}</Pill>) : <Pill>Residents</Pill>}
              </div>
            </Section>

            <Section eyebrow="Provenance" title="What generated this page?">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Decision ID</dt>
                  <dd className="mt-1 break-words font-mono text-xs text-slate-300">{decision.id}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Agenda item ID</dt>
                  <dd className="mt-1 break-words font-mono text-xs text-slate-300">{decision.agendaItemId}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Generated</dt>
                  <dd className="mt-1 text-slate-300">{formatDate(data.generatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Sources</dt>
                  <dd className="mt-1 text-slate-300">{data.sourceCount}</dd>
                </div>
              </dl>
            </Section>
          </aside>
        </div>
      </div>
    </main>
  );
}
