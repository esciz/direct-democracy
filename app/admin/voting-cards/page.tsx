import Link from "next/link";
import { redirect } from "next/navigation";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PageIntro } from "@/components/ui/page-intro";
import { updateMeetingVotingCardReviewAction } from "@/lib/public-meetings/voting-card-review-actions";
import { getMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    jurisdiction?: string;
    body?: string;
    policy?: string;
    meeting?: "upcoming" | "completed";
    outcome?: "approved" | "pending" | "all";
    review?: "approved" | "needs_review" | "all";
    financial?: "with_financial" | "tax_stated" | "tax_unknown" | "tax_unlikely" | "tax_needs_review" | "all";
    nextAction?: string;
  }>;
};

type DecisionReviewQueue = {
  generatedAt?: string;
  totals?: {
    needsReview: number;
    withParsedVoteCount: number;
    withFinancialImpact: number;
    possibleNonDecision: number;
  };
  byNextAction?: Array<{ key: string; count: number }>;
  byJurisdiction?: Array<{ key: string; count: number }>;
  priorityQueue?: Array<{
    id: string;
    sourceVotingCardId: string;
    title: string;
    jurisdiction: string;
    voteOutcome: string;
    voteCount: string;
    confidence: number;
    reasons: string[];
    sourceRecoveryStatus?: string;
    sourceRecoveryReason?: string;
    nextAction: string;
    priorityScore: number;
    adminHref: string;
    publicHref: string;
  }>;
};

type DecisionReviewLedger = {
  records?: Array<{
    id: string;
    cardId: string;
    previousStatus: string;
    nextStatus: string;
    reviewerId: string;
    reviewedAt: string;
    note: string | null;
    reason: string | null;
  }>;
};

function readGenerated<T>(fileName: string, fallback: T): T {
  const filePath = path.join(process.cwd(), "data", "generated", fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function href(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `/admin/voting-cards?${text}` : "/admin/voting-cards";
}

function formatDate(value: string | null) {
  if (!value) return "Date pending";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date pending" : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminVotingCardsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");
  const params = searchParams ? await searchParams : {};
  const { cards, allCards, jurisdictions, bodies, policyAreas } = await getMeetingVotingCards({
    jurisdiction: params.jurisdiction,
    body: params.body,
    policyArea: params.policy,
    meetingStatus: params.meeting,
    outcome: params.outcome,
    review: params.review,
    financial: params.financial,
  });
  const returnPath = href(params);
  const financialCards = allCards.filter((card) => card.financial_impact_context);
  const taxFeeStatedCards = allCards.filter((card) => card.financial_impact_context?.direct_tax_impact === "stated");
  const unknownTaxImpactCards = allCards.filter((card) => card.financial_impact_context?.direct_tax_impact === "unknown");
  const needsTaxDebtReviewCards = allCards.filter((card) => card.financial_impact_context?.direct_tax_impact === "needs_review");
  const reviewQueue = readGenerated<DecisionReviewQueue>("decision-review-queue.json", {});
  const reviewLedger = readGenerated<DecisionReviewLedger>("decision-review-overrides.json", {});
  const recentReviews = (reviewLedger.records ?? []).slice(0, 8);
  const queueItems = reviewQueue.priorityQueue ?? [];
  const selectedNextAction = params.nextAction;
  const topReviewItems = (selectedNextAction ? queueItems.filter((item) => item.nextAction === selectedNextAction) : queueItems).slice(0, 8);
  const sourceVotingCardIdsForNextAction = new Set(queueItems.filter((item) => !selectedNextAction || item.nextAction === selectedNextAction).map((item) => item.sourceVotingCardId));
  const reviewItemBySourceCardId = new Map(queueItems.map((item) => [item.sourceVotingCardId, item]));
  const visibleCards = selectedNextAction ? cards.filter((card) => sourceVotingCardIdsForNextAction.has(card.id)) : cards;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Meeting voting cards"
        description="Review source-backed public questions generated from meeting agenda items, outcomes, fiscal impacts, and official actions."
        actions={
          <>
            <Link href="/admin/meeting-actions" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">Topic queue</Link>
            <Link href="/voting" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">Voting</Link>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Cards</p><p className="mt-3 text-3xl font-semibold text-white">{allCards.length}</p></div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">Financial impact</p><p className="mt-3 text-3xl font-semibold text-white">{financialCards.length}</p></div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Tax/fee stated</p><p className="mt-3 text-3xl font-semibold text-white">{taxFeeStatedCards.length}</p></div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">Tax unknown</p><p className="mt-3 text-3xl font-semibold text-white">{unknownTaxImpactCards.length}</p></div>
        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-100">Tax/debt review</p><p className="mt-3 text-3xl font-semibold text-white">{needsTaxDebtReviewCards.length}</p></div>
      </section>

      <section className="rounded-[1.75rem] border border-amber-300/20 bg-amber-500/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">Priority review queue</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{reviewQueue.totals?.needsReview ?? 0} decision cards need review</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/90">
              Ranked by named votes, financial impact, completed outcomes, source confidence, and priority Nevada jurisdictions.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-amber-50 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-200/20 bg-black/15 p-3"><span className="block text-xs uppercase tracking-[0.14em] text-amber-100">Parsed vote counts</span><strong className="text-lg">{reviewQueue.totals?.withParsedVoteCount ?? 0}</strong></div>
            <div className="rounded-2xl border border-amber-200/20 bg-black/15 p-3"><span className="block text-xs uppercase tracking-[0.14em] text-amber-100">Financial impact</span><strong className="text-lg">{reviewQueue.totals?.withFinancialImpact ?? 0}</strong></div>
            <div className="rounded-2xl border border-amber-200/20 bg-black/15 p-3"><span className="block text-xs uppercase tracking-[0.14em] text-amber-100">Possible non-decisions</span><strong className="text-lg">{reviewQueue.totals?.possibleNonDecision ?? 0}</strong></div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3">
            {topReviewItems.length ? topReviewItems.map((item) => (
              <Link key={item.id} href={item.adminHref} className="block rounded-2xl border border-amber-200/20 bg-black/15 p-4 transition hover:border-amber-100/40">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-amber-200/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-50">score {item.priorityScore}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-200">{item.voteOutcome}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-200">{item.voteCount}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-200">{Math.round(item.confidence * 100)}%</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-6 text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-amber-100/80">{item.jurisdiction} · {item.nextAction.replaceAll("_", " ")}</p>
              </Link>
            )) : <p className="rounded-2xl border border-amber-200/20 bg-black/15 p-4 text-sm text-amber-100">Run npm run decisions:review-queue to generate prioritized review items.</p>}
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200/20 bg-black/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Top next actions</p>
              <div className="mt-3 space-y-2 text-sm text-amber-50">
                {(reviewQueue.byNextAction ?? []).slice(0, 6).map((row) => (
                  <Link key={row.key} href={href({ review: "needs_review", nextAction: row.key })} className={`flex justify-between gap-3 hover:text-white ${selectedNextAction === row.key ? "text-white" : ""}`}>
                    <span>{row.key.replaceAll("_", " ")}</span>
                    <strong>{row.count}</strong>
                  </Link>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200/20 bg-black/15 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Top jurisdictions</p>
              <div className="mt-3 space-y-2 text-sm text-amber-50">
                {(reviewQueue.byJurisdiction ?? []).slice(0, 6).map((row) => (
                  <Link key={row.key} href={href({ review: "needs_review", jurisdiction: row.key })} className="flex justify-between gap-3 hover:text-white">
                    <span>{row.key}</span>
                    <strong>{row.count}</strong>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-300/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Human review throughput</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{reviewLedger.records?.length ?? 0} review actions logged</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/85">
              Review actions append to a generated ledger so approvals, rejections, and rewrites are auditable without a schema migration.
            </p>
          </div>
          <Link href="/admin/voting-cards?review=needs_review" className="rounded-full border border-cyan-200/20 bg-black/20 px-4 py-2 text-sm font-semibold text-cyan-50">
            Work queue
          </Link>
        </div>
        {recentReviews.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recentReviews.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-cyan-200/20 bg-black/20 p-4 text-sm text-cyan-50">
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                  <span className="rounded-full bg-white/10 px-2.5 py-1">{`${entry.previousStatus} -> ${entry.nextStatus}`}</span>
                  <span className="rounded-full bg-white/10 px-2.5 py-1">{new Date(entry.reviewedAt).toLocaleString("en-US")}</span>
                </div>
                {entry.reason ? <p className="mt-2 leading-6"><span className="font-semibold">Reason:</span> {entry.reason}</p> : null}
                {entry.note ? <p className="mt-1 leading-6 text-cyan-100/80"><span className="font-semibold">Note:</span> {entry.note}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-cyan-200/20 bg-black/20 p-4 text-sm text-cyan-50/85">
            No human review actions have been logged yet.
          </p>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/voting-cards" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">All</Link>
          <Link href={href({ review: "approved" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Approved</Link>
          <Link href={href({ review: "needs_review" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Needs review</Link>
          <Link href={href({ meeting: "completed" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Completed</Link>
          <Link href={href({ meeting: "upcoming" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Upcoming</Link>
          <Link href={href({ outcome: "approved" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Approved outcomes</Link>
          <Link href={href({ outcome: "pending" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Pending outcomes</Link>
          <Link href={href({ financial: "with_financial" })} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">Financial impact</Link>
          <Link href={href({ financial: "tax_stated" })} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100">Direct tax/fee stated</Link>
          <Link href={href({ financial: "tax_unknown" })} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">Tax impact unknown</Link>
          <Link href={href({ financial: "tax_needs_review" })} className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">Needs tax/debt review</Link>
          {(reviewQueue.byNextAction ?? []).map((row) => (
            <Link key={row.key} href={href({ review: "needs_review", nextAction: row.key })} className={`rounded-full border px-3 py-2 text-xs font-semibold ${selectedNextAction === row.key ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-50" : "border-white/10 bg-white/5 text-slate-100"}`}>
              {row.key.replaceAll("_", " ")} ({row.count})
            </Link>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select defaultValue={params.jurisdiction ?? ""} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" onChange={undefined}>
            <option value="">Jurisdictions: use filter chips below</option>
            {jurisdictions.map((value) => <option key={value}>{value}</option>)}
          </select>
          <select defaultValue={params.body ?? ""} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" onChange={undefined}>
            <option value="">Bodies: use links in cards</option>
            {bodies.map((value) => <option key={value}>{value}</option>)}
          </select>
          <select defaultValue={params.policy ?? ""} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" onChange={undefined}>
            <option value="">Policy areas</option>
            {policyAreas.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
      </section>

      <section className="space-y-3">
        {visibleCards.slice(0, 160).map((card) => {
          const reviewItem = reviewItemBySourceCardId.get(card.id);
          return (
          <article key={card.id} id={card.id} className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">{card.policy_area}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{card.review_status}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{card.outcome_status}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{Math.round(card.confidence_score * 100)}% confidence</span>
              {card.needs_roll_call_review ? <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">Roll call pending</span> : null}
              {card.financial_impact_context?.badges.map((badge) => (
                <span key={badge} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">{badge}</span>
              ))}
              {card.civic_layer_label ? <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">{card.civic_layer_label}</span> : null}
              {reviewItem?.sourceRecoveryStatus ? <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100">{reviewItem.sourceRecoveryStatus.replaceAll("_", " ")}</span> : null}
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{card.jurisdiction_display_name ?? card.jurisdiction} · {formatDate(card.meeting_date)}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{card.public_question ?? card.question_text}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{card.citizen_summary ?? card.plain_language_summary}</p>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3 text-xs leading-5 text-slate-400">
              <span className="font-semibold text-slate-100">Source detail:</span>{" "}
              {[card.source_item_number, card.source_title ?? card.agenda_language_original, card.governing_body_display_name ?? card.body_name].filter(Boolean).join(" / ")}
            </div>
            {reviewItem?.sourceRecoveryReason ? (
              <div className="mt-3 rounded-xl border border-violet-300/20 bg-violet-300/10 p-3 text-xs leading-5 text-violet-100">
                <span className="font-semibold text-violet-50">Recovery status:</span> {reviewItem.sourceRecoveryReason}
              </div>
            ) : null}
            {card.outcome_text || card.financial_impact || card.affected_groups.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {card.outcome_text ? <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300"><span className="font-semibold text-slate-100">Outcome:</span> {card.outcome_text}</p> : null}
                {card.financial_impact ? <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-50"><span className="font-semibold">Financial:</span> {card.financial_impact}</p> : null}
                {card.affected_groups.length ? <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300"><span className="font-semibold text-slate-100">Affected:</span> {card.affected_groups.join(", ")}</p> : null}
              </div>
            ) : null}
            {card.financial_impact_context ? (
              <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Tax / cost impact</p>
                <p className="mt-2 leading-6">{card.financial_impact_context.tax_cost_summary}</p>
                <dl className="mt-3 grid gap-2 text-xs text-amber-100 sm:grid-cols-4">
                  <div><dt className="font-semibold text-amber-50">Amount</dt><dd>{card.financial_impact_context.amount ?? "Not isolated"}</dd></div>
                  <div><dt className="font-semibold text-amber-50">Fund/source</dt><dd>{card.financial_impact_context.fund_source ?? "Not stated"}</dd></div>
                  <div><dt className="font-semibold text-amber-50">Fiscal year</dt><dd>{card.financial_impact_context.fiscal_year ?? "Not stated"}</dd></div>
                  <div><dt className="font-semibold text-amber-50">Tax status</dt><dd>{card.financial_impact_context.direct_tax_impact.replace(/_/g, " ")}</dd></div>
                </dl>
                {card.financial_impact_context.source_snippet ? (
                  <p className="mt-3 border-t border-amber-200/15 pt-3 text-xs leading-5 text-amber-100"><span className="font-semibold text-amber-50">Snippet:</span> {card.financial_impact_context.source_snippet}</p>
                ) : null}
              </div>
            ) : null}
            <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-100">Source snippets</summary>
              {card.source_snippets.map((snippet) => <p key={snippet} className="mt-2 leading-6">{snippet}</p>)}
            </details>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={href({ jurisdiction: card.jurisdiction })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">{card.jurisdiction}</Link>
              <Link href={href({ body: card.body_name })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">{card.body_name}</Link>
              <Link href={href({ policy: card.policy_area })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">{card.policy_area}</Link>
              <Link href={card.source_event_href} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">Event</Link>
              {card.source_url ? <Link href={card.source_url} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">Source</Link> : null}
            </div>
            <form action={updateMeetingVotingCardReviewAction} className="mt-4 flex flex-wrap gap-2">
              <input type="hidden" name="cardId" value={card.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <div className="grid w-full gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Public question</span>
                  <textarea name="publicQuestion" rows={3} defaultValue={card.public_question ?? card.question_text} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Citizen summary</span>
                  <textarea name="citizenSummary" rows={3} defaultValue={card.citizen_summary ?? card.plain_language_summary} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Public title</span>
                  <input name="publicTitle" defaultValue={card.public_title ?? card.title} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Plain purpose</span>
                  <input name="plainPurpose" defaultValue={card.plain_purpose ?? ""} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Plain action</span>
                  <input name="plainAction" defaultValue={card.plain_action ?? ""} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Review reason</span>
                  <select name="reviewReason" defaultValue={reviewItem?.nextAction ?? ""} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                    <option value="">Choose reason</option>
                    <option value="review_named_vote_card_for_public_approval">Named vote card approved/reviewed</option>
                    <option value="review_tax_cost_language">Tax or cost language reviewed</option>
                    <option value="rewrite_citizen_summary_from_source">Citizen summary rewritten from source</option>
                    <option value="recover_minutes_or_action_result">Needs minutes/action-result recovery</option>
                    <option value="reject_or_reclassify_non_decision">Rejected or reclassified non-decision</option>
                    <option value="manual_source_review">Manual source review</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Review note</span>
                  <input name="reviewNote" placeholder="Optional internal note for audit trail" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
              </div>
              <button name="reviewStatus" value="approved" className="dd-button-primary rounded-full px-3 py-2 text-xs font-semibold">Approve</button>
              <button name="reviewStatus" value="ready" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Ready</button>
              <button name="reviewStatus" value="needs_review" className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">Needs review</button>
              <button name="reviewStatus" value="rejected" className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">Reject</button>
            </form>
          </article>
          );
        })}
      </section>
    </div>
  );
}
