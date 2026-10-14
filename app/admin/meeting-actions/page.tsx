import Link from "next/link";
import { redirect } from "next/navigation";

import { MeetingActionCardView } from "@/components/domain/meeting-action-card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageIntro } from "@/components/ui/page-intro";
import { getMeetingActionCards, type MeetingActionCardFilters, type MeetingActionCardReviewMode } from "@/lib/public-meetings/action-cards";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type AdminMeetingActionsPageProps = {
  searchParams?: Promise<{
    body?: string;
    dateFrom?: string;
    dateTo?: string;
    topic?: string;
    review?: string;
    fiscal?: string;
    outcome?: string;
    rollCall?: string;
    priority?: string;
  }>;
};

function normalizeReview(value: string | undefined): MeetingActionCardReviewMode {
  return value === "ready" || value === "needs_review" ? value : "all";
}

function buildHref(filters: MeetingActionCardFilters & { priority?: string }) {
  const params = new URLSearchParams();
  if (filters.body) params.set("body", filters.body);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.review && filters.review !== "all") params.set("review", filters.review);
  if (filters.hasFiscalImpact) params.set("fiscal", "1");
  if (filters.hasOutcome) params.set("outcome", "1");
  if (filters.rollCallPending) params.set("rollCall", "1");
  if (filters.priority) params.set("priority", filters.priority);
  const query = params.toString();
  return query ? `/admin/meeting-actions?${query}` : "/admin/meeting-actions";
}

export default async function AdminMeetingActionsPage({ searchParams }: AdminMeetingActionsPageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  const params = searchParams ? await searchParams : {};
  const priority = params.priority && ["1", "2", "3", "4"].includes(params.priority) ? params.priority : "";
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
  const { cards: baseCards, allCards, bodies, topics } = await getMeetingActionCards(filters);
  const cards = priority ? baseCards.filter((card) => String(card.priority) === priority) : baseCards;
  const priorityCounts = [1, 2, 3, 4].map((value) => ({
    value,
    count: allCards.filter((card) => card.priority === value).length,
  }));
  const tabs = [
    { label: "All priorities", href: buildHref({ ...filters, priority: "" }), active: !priority },
    ...priorityCounts.map((entry) => ({
      label: `P${entry.value} (${entry.count})`,
      href: buildHref({ ...filters, priority: String(entry.value) }),
      active: priority === String(entry.value),
    })),
  ];

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Meeting action review queue"
        description="Prioritize source-backed agenda topics before they become public voting/action cards. This queue stays at topic level until named roll calls are explicitly parsed or manually reviewed."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/actions" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Public card view
            </Link>
            <Link href="/admin/meetings" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Meeting records
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Queue</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{cards.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Roll-call review</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{allCards.filter((card) => card.priority === 1).length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Financial review</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{allCards.filter((card) => card.priority === 2).length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Low-conf PDF</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{allCards.filter((card) => card.priority === 4).length}</p>
        </div>
      </section>

      <section className="space-y-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <FilterTabs tabs={tabs} />
        <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" action="/admin/meeting-actions">
          <input type="hidden" name="priority" value={priority} />
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
          cards.slice(0, 100).map((card) => <MeetingActionCardView key={card.id} card={card} admin />)
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
            No action-card review items match these filters.
          </div>
        )}
      </section>
    </div>
  );
}
