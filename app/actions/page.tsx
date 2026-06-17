import Link from "next/link";

import { MeetingActionCardView } from "@/components/domain/meeting-action-card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageIntro } from "@/components/ui/page-intro";
import { getMeetingActionCards, type MeetingActionCardFilters, type MeetingActionCardReviewMode } from "@/lib/public-meetings/action-cards";

export const dynamic = "force-dynamic";

type ActionsPageProps = {
  searchParams?: Promise<{
    body?: string;
    dateFrom?: string;
    dateTo?: string;
    topic?: string;
    review?: string;
    fiscal?: string;
    outcome?: string;
    rollCall?: string;
  }>;
};

function normalizeReview(value: string | undefined): MeetingActionCardReviewMode {
  return value === "ready" || value === "needs_review" ? value : "all";
}

function buildHref(filters: MeetingActionCardFilters) {
  const params = new URLSearchParams();
  if (filters.body) params.set("body", filters.body);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.review && filters.review !== "all") params.set("review", filters.review);
  if (filters.hasFiscalImpact) params.set("fiscal", "1");
  if (filters.hasOutcome) params.set("outcome", "1");
  if (filters.rollCallPending) params.set("rollCall", "1");
  const query = params.toString();
  return query ? `/actions?${query}` : "/actions";
}

export default async function ActionsPage({ searchParams }: ActionsPageProps) {
  const params = searchParams ? await searchParams : {};
  const filters: MeetingActionCardFilters = {
    body: params.body || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    topic: params.topic || undefined,
    review: normalizeReview(params.review),
    hasFiscalImpact: params.fiscal === "1",
    hasOutcome: params.outcome === "1",
    rollCallPending: params.rollCall === "1",
  };
  const { cards, allCards, bodies, topics } = await getMeetingActionCards(filters);
  const readyCount = allCards.filter((card) => card.isReady).length;
  const reviewCount = allCards.length - readyCount;

  const reviewTabs = [
    { label: "All", href: buildHref({ ...filters, review: "all" }), active: filters.review === "all" },
    { label: `Ready (${readyCount})`, href: buildHref({ ...filters, review: "ready" }), active: filters.review === "ready" },
    { label: `Needs review (${reviewCount})`, href: buildHref({ ...filters, review: "needs_review" }), active: filters.review === "needs_review" },
  ];

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Public actions"
        title="Source-backed civic action cards"
        description="Browse agenda topics and public meeting actions imported from official meeting records. These cards show source-backed facts now, while clearly marking items that need human review."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/events?status=completed&source=official" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Completed meetings
            </Link>
            <Link href="/voting" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Vote
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Cards</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{cards.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Source-backed topics</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{allCards.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Fiscal impact</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{allCards.filter((card) => card.fiscalImpact).length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Roll call pending</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{allCards.filter((card) => card.namedRollCallPending).length}</p>
        </div>
      </section>

      <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <FilterTabs tabs={reviewTabs} />
        <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" action="/actions">
          <select name="body" defaultValue={filters.body ?? ""} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
            <option value="">All jurisdictions/bodies</option>
            {bodies.map((body) => <option key={body} value={body}>{body}</option>)}
          </select>
          <select name="topic" defaultValue={filters.topic ?? ""} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
            <option value="">All topics</option>
            {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
          </select>
          <input name="dateFrom" type="date" defaultValue={filters.dateFrom ?? ""} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
          <input name="dateTo" type="date" defaultValue={filters.dateTo ?? ""} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
          <select name="review" defaultValue={filters.review ?? "all"} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
            <option value="all">Ready + review</option>
            <option value="ready">Ready only</option>
            <option value="needs_review">Needs review</option>
          </select>
          <button className="dd-button-primary rounded-xl px-4 py-2 text-sm font-semibold">Apply</button>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="fiscal" value="1" defaultChecked={filters.hasFiscalImpact} /> Has fiscal impact</label>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="outcome" value="1" defaultChecked={filters.hasOutcome} /> Has outcome</label>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="rollCall" value="1" defaultChecked={filters.rollCallPending} /> Roll call pending</label>
        </form>
      </section>

      <section className="space-y-4">
        {cards.length ? (
          cards.slice(0, 80).map((card) => <MeetingActionCardView key={card.id} card={card} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
            No source-backed action cards match these filters.
          </div>
        )}
      </section>
    </div>
  );
}
