import Link from "next/link";
import { redirect } from "next/navigation";

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
  }>;
};

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
  });
  const returnPath = href(params);

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

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Cards</p><p className="mt-3 text-3xl font-semibold text-white">{allCards.length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Approved</p><p className="mt-3 text-3xl font-semibold text-white">{allCards.filter((card) => card.review_status === "approved").length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Needs review</p><p className="mt-3 text-3xl font-semibold text-white">{allCards.filter((card) => card.review_status !== "approved").length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Roll-call pending</p><p className="mt-3 text-3xl font-semibold text-white">{allCards.filter((card) => card.needs_roll_call_review).length}</p></div>
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
        {cards.slice(0, 160).map((card) => (
          <article key={card.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">{card.policy_area}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{card.review_status}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{card.outcome_status}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{Math.round(card.confidence_score * 100)}% confidence</span>
              {card.needs_roll_call_review ? <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">Roll call pending</span> : null}
              {card.financial_impact_context?.badges.map((badge) => (
                <span key={badge} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">{badge}</span>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{card.body_name} · {card.jurisdiction} · {formatDate(card.meeting_date)}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{card.question_text}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{card.plain_language_summary}</p>
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
              <button name="reviewStatus" value="approved" className="dd-button-primary rounded-full px-3 py-2 text-xs font-semibold">Approve</button>
              <button name="reviewStatus" value="ready" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Ready</button>
              <button name="reviewStatus" value="needs_review" className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">Needs review</button>
              <button name="reviewStatus" value="rejected" className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">Reject</button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
