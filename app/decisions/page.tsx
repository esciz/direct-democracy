import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { getDecisionCards } from "@/lib/civic/decision-pages";
import { compareDecisionTrustThenDate, getDecisionTrustView } from "@/lib/civic/public-decision-trust";

type DecisionsPageProps = {
  searchParams?: Promise<{
    jurisdiction?: string;
    status?: string;
    review?: string;
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

function voteAttributionLabel(decision: { voteCount: { totalKnown: number; display: string } }) {
  if (decision.voteCount.totalKnown > 0) return "Named votes parsed";
  if (!/^no\b/i.test(decision.voteCount.display)) return "Aggregate outcome only";
  return "Votes need review";
}

function residentImpactLabel(decision: { financialImpact: { estimatedAmount: number | null; description: string | null; raw: string | null }; relatedIssues: string[] }) {
  if (decision.financialImpact.estimatedAmount || decision.financialImpact.description || decision.financialImpact.raw) return "Money involved";
  if (decision.relatedIssues.length) return "Issue-linked";
  return "Impact summary";
}

function pillTone(value: string) {
  if (value === "approved" || value === "reviewed") return "border-emerald-300/20 bg-emerald-500/10 text-emerald-200";
  if (value === "ready" || value === "preview") return "border-cyan-300/20 bg-cyan-500/10 text-cyan-200";
  if (value.includes("review") || value === "limited" || value === "denied") return "border-amber-300/20 bg-amber-500/10 text-amber-200";
  return "border-white/10 bg-white/5 text-slate-300";
}

function Pill({ children, value = "" }: { children: string; value?: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${pillTone(value)}`}>{children}</span>;
}

function filterHref(input: { jurisdiction?: string; status?: string; review?: string }) {
  const params = new URLSearchParams();
  if (input.jurisdiction) params.set("jurisdiction", input.jurisdiction);
  if (input.status) params.set("status", input.status);
  if (input.review) params.set("review", input.review);
  const query = params.toString();
  return query ? `/decisions?${query}` : "/decisions";
}

export default async function DecisionsPage({ searchParams }: DecisionsPageProps) {
  const params = searchParams ? await searchParams : {};
  const cards = await getDecisionCards();
  const jurisdictions = [...new Set(cards.map((card) => card.jurisdiction).filter(Boolean))].sort((left, right) => left.localeCompare(right));
  const selectedJurisdiction = params.jurisdiction ?? "all";
  const selectedStatus = params.status ?? "all";
  const selectedReview = params.review ?? "all";
  const filtered = cards
    .filter((card) => selectedJurisdiction === "all" || card.jurisdiction === selectedJurisdiction)
    .filter((card) => selectedStatus === "all" || card.voteOutcome === selectedStatus)
    .filter((card) => selectedReview === "all" || getDecisionTrustView(card).state === selectedReview)
    .sort(compareDecisionTrustThenDate);
  const visible = filtered.slice(0, 80);
  const trustCounts = cards.reduce(
    (counts, card) => {
      counts[getDecisionTrustView(card).state] += 1;
      return counts;
    },
    { approved: 0, ready: 0, needs_review: 0 },
  );
  const withMoney = cards.filter((card) => card.financialImpact.estimatedAmount || card.financialImpact.description || card.financialImpact.raw).length;
  const withNamedVotes = cards.filter((card) => card.voteCount.totalKnown > 0).length;

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Decisions"
        title="Public decisions translated for residents"
        description="Browse source-backed government actions as citizen-readable decisions. Technical agenda references stay available, but the first view is what happened, why it matters, and what evidence supports it."
        actions={
          <Link href="/communities" className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/45">
            Browse communities
          </Link>
        }
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{cards.length} generated</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{trustCounts.approved} reviewed</span>
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">{trustCounts.ready} previews</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{trustCounts.needs_review} limited</span>
          </>
        }
      />

      <section className="dd-panel rounded-[1.75rem] p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Named vote coverage", withNamedVotes],
            ["Money parsed", withMoney],
            ["Jurisdictions", jurisdictions.length],
            ["Showing", visible.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-xl font-semibold text-slate-50">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={filterHref({ status: selectedStatus, review: selectedReview })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedJurisdiction === "all" ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
            All jurisdictions
          </Link>
          {jurisdictions.slice(0, 10).map((jurisdiction) => (
            <Link key={jurisdiction} href={filterHref({ jurisdiction, status: selectedStatus, review: selectedReview })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedJurisdiction === jurisdiction ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
              {jurisdiction}
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["All outcomes", "all"],
            ["Approved", "approved"],
            ["Proposed", "proposed"],
            ["Denied", "denied"],
          ].map(([label, value]) => (
            <Link key={value} href={filterHref({ jurisdiction: selectedJurisdiction === "all" ? undefined : selectedJurisdiction, status: value, review: selectedReview })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedStatus === value ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
              {label}
            </Link>
          ))}
          {[
            ["All review states", "all"],
            ["Reviewed", "approved"],
            ["Source-backed preview", "ready"],
            ["Needs review", "needs_review"],
          ].map(([label, value]) => (
            <Link key={value} href={filterHref({ jurisdiction: selectedJurisdiction === "all" ? undefined : selectedJurisdiction, status: selectedStatus, review: value })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${selectedReview === value ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-white/5 text-slate-300"}`}>
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {visible.map((decision) => {
          const trust = getDecisionTrustView(decision);
          const attribution = voteAttributionLabel(decision);
          const impact = residentImpactLabel(decision);
          return (
            <Link key={decision.id} href={`/decisions/${decision.id}`} className={`block rounded-[1.35rem] border p-5 transition hover:border-cyan-300/25 hover:bg-white/[0.06] ${trust.state === "needs_review" ? "border-amber-300/20 bg-amber-500/[0.06]" : "border-white/10 bg-white/[0.04]"}`}>
              <div className="flex flex-wrap gap-2">
                <Pill value="ready">decision</Pill>
                <Pill value={decision.voteOutcome}>{decision.voteOutcome}</Pill>
                <Pill value={trust.state === "needs_review" ? "limited" : trust.state}>{trust.label}</Pill>
                <Pill>{decision.voteCount.display}</Pill>
                <Pill value={decision.voteCount.totalKnown > 0 ? "approved" : attribution.includes("Aggregate") ? "limited" : "slate"}>{attribution}</Pill>
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Question for residents</p>
              <h2 className="mt-4 text-lg font-semibold leading-7 text-slate-50">{decision.title}</h2>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{decision.summary}</p>
              <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{impact}</p>
                <p className="mt-1 text-sm leading-6 text-slate-300">{decision.whyItMatters}</p>
              </div>
              <p className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${trust.state === "approved" ? "border-emerald-300/15 bg-emerald-500/10 text-emerald-100" : trust.state === "ready" ? "border-cyan-300/15 bg-cyan-500/10 text-cyan-100" : "border-amber-300/20 bg-amber-500/10 text-amber-100"}`}>
                {trust.description}
              </p>
              <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">
                <p>{decision.jurisdiction} · {decision.meeting.bodyName} · {formatDate(decision.meeting.date)}</p>
                <p>{formatMoney(decision.financialImpact.estimatedAmount) ?? decision.financialImpact.description ?? decision.financialImpact.raw ?? "No amount parsed"} · {Math.round(decision.confidence * 100)}% confidence · {decision.sourceReferences.length} source{decision.sourceReferences.length === 1 ? "" : "s"}</p>
              </div>
            </Link>
          );
        })}
      </section>

      {!visible.length ? (
        <section className="rounded-[1.75rem] border border-dashed border-white/12 bg-white/[0.03] p-6 text-sm leading-6 text-slate-400">
          No decisions match these filters. Try a broader jurisdiction, outcome, or review state.
        </section>
      ) : null}
    </div>
  );
}
