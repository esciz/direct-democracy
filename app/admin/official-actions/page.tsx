import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { updateOfficialActionReviewAction } from "@/lib/public-meetings/official-action-review-actions";
import { getEnrichedOfficialMeetingActions } from "@/lib/public-meetings/official-action-store";
import { buildPublicMeetingRosterCoverageReport } from "@/lib/public-meetings/official-rosters";
import { getPublicMeetingAdminDashboard } from "@/lib/public-meetings/public";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type AdminOfficialActionsPageProps = {
  searchParams?: Promise<{
    priority?: string;
    status?: string;
    type?: string;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Date pending";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date pending" : date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function buildHref(params: { priority?: string; status?: string; type?: string }) {
  const query = new URLSearchParams();
  if (params.priority) query.set("priority", params.priority);
  if (params.status) query.set("status", params.status);
  if (params.type) query.set("type", params.type);
  const text = query.toString();
  return text ? `/admin/official-actions?${text}` : "/admin/official-actions";
}

export default async function AdminOfficialActionsPage({ searchParams }: AdminOfficialActionsPageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  const params = searchParams ? await searchParams : {};
  const [actions, dashboard, rosterReport] = await Promise.all([
    getEnrichedOfficialMeetingActions(),
    getPublicMeetingAdminDashboard(),
    buildPublicMeetingRosterCoverageReport(),
  ]);
  const meetingById = new Map(dashboard.meetings.map((meeting) => [meeting.id, meeting]));
  const bodyById = new Map(dashboard.publicBodies.map((body) => [body.id, body]));
  const rollCallReviewItems = dashboard.meetingItems
    .filter((item) => item.roll_call_status === "needs_roll_call_review")
    .map((item) => {
      const meeting = meetingById.get(item.meeting_id) ?? null;
      const body = meeting ? bodyById.get(meeting.public_body_id) ?? null : null;
      return { item, meeting, body };
    })
    .sort((left, right) => (Date.parse(right.meeting?.meeting_date ?? "") || 0) - (Date.parse(left.meeting?.meeting_date ?? "") || 0));
  const filtered = actions
    .filter((action) => (params.priority ? String(action.priority) === params.priority : true))
    .filter((action) => (params.status ? action.review_status === params.status : true))
    .filter((action) => (params.type ? action.action_type === params.type : true));
  const actionTypes = [...new Set(actions.map((action) => action.action_type))].sort();
  const returnPath = buildHref(params);
  const rollCallBodiesWithoutRoster = rosterReport.body_reports
    .filter((body) => body.roll_call_review_items > 0 && !body.has_roster)
    .sort((left, right) => right.roll_call_review_items - left.roll_call_review_items);
  const topRollCallBodies = rosterReport.body_reports
    .filter((body) => body.roll_call_review_items > 0)
    .sort((left, right) => right.roll_call_review_items - left.roll_call_review_items)
    .slice(0, 8);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Official action extraction review"
        description="Review source-backed official-level actions extracted from meeting minutes, agenda packets, journals, and topic text. Individual votes stay private to this queue unless names are explicit and the action is approved."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/meeting-actions" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Topic queue
            </Link>
            <Link href="/admin/meetings" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Meetings
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Actions</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{actions.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Suggested</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{actions.filter((action) => action.review_status === "suggested_match").length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Unmatched</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{actions.filter((action) => !action.matched_official_id).length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Public-safe</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{actions.filter((action) => action.public_visible).length}</p>
        </div>
      </section>

      {rollCallBodiesWithoutRoster.length ? (
        <section className="rounded-[1.75rem] border border-amber-300/20 bg-amber-300/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">Roster warning</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Some roll-call review bodies have no official roster</h2>
          <p className="mt-2 text-sm leading-6 text-amber-50">
            Surname-only actors from these bodies will stay unmatched or review-only until an official roster seed is added.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {rollCallBodiesWithoutRoster.slice(0, 8).map((body) => (
              <span key={`${body.body_id}-${body.body_name}`} className="rounded-full border border-amber-200/20 bg-black/20 px-3 py-1.5 text-xs font-semibold text-amber-50">
                {body.body_name}: {body.roll_call_review_items}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {topRollCallBodies.length ? (
        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Roll-call cleanup priority</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {topRollCallBodies.map((body) => (
              <div key={`${body.body_id}-${body.body_name}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm">
                <span className="text-slate-200">{body.body_name}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${body.has_roster ? "bg-emerald-300/10 text-emerald-100" : "bg-amber-300/10 text-amber-100"}`}>
                  {body.roll_call_review_items} · {body.has_roster ? "roster ready" : "no roster"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/official-actions" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">All</Link>
          <Link href={buildHref({ priority: "1" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">P1 roll-call gaps</Link>
          <Link href={buildHref({ priority: "2" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">P2 low confidence</Link>
          <Link href={buildHref({ priority: "3" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">P3 unmatched</Link>
          <Link href={buildHref({ priority: "4" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">P4 conflicts</Link>
          <Link href={buildHref({ status: "unmatched" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Unmatched</Link>
          <Link href={buildHref({ status: "suggested_match" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Suggested</Link>
          <Link href={buildHref({ status: "approved" })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Approved</Link>
          {actionTypes.map((type) => (
            <Link key={type} href={buildHref({ type })} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">
              {type}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {filtered.length ? filtered.slice(0, 120).map((action) => (
          <article key={action.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">{action.action_type}</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{Math.round(action.confidence * 100)}% confidence</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{action.review_status}</span>
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">P{action.priority}</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">{action.official_name_raw}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {formatDate(action.meeting?.meeting_date)} · {action.body?.name ?? action.jurisdiction_body} · {action.body?.jurisdiction ?? "Jurisdiction pending"}
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-100">{action.item?.title ?? "Agenda item pending"}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{action.action_text}</p>
                <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                  <summary className="cursor-pointer font-semibold text-slate-100">Source snippet</summary>
                  <p className="mt-2 leading-6">{action.source_snippet}</p>
                </details>
                <p className="mt-3 text-xs text-amber-100">{action.priority_reason}</p>
                <p className="mt-2 text-xs text-slate-400">
                  Match: {action.match_reason ?? "No matcher reason recorded."}
                  {typeof action.match_confidence === "number" ? ` (${Math.round(action.match_confidence * 100)}% match confidence)` : ""}
                </p>
                <p className="mt-2 text-xs text-slate-500">Matched official: {action.matched_official_name ?? "Unmatched"}</p>
              </div>
              <form action={updateOfficialActionReviewAction} className="rounded-xl border border-white/10 bg-black/15 p-4">
                <input type="hidden" name="actionId" value={action.id} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Official name</label>
                <input name="officialNameRaw" defaultValue={action.official_name_raw} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Matched official id</label>
                <input name="officialId" defaultValue={action.matched_official_id ?? ""} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                <label className="mt-3 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Notes</label>
                <input name="notes" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button name="status" value="approved" className="dd-button-primary rounded-full px-3 py-2 text-xs font-semibold">Approve</button>
                  <button name="status" value="suggested_match" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Suggest</button>
                  <button name="status" value="unmatched" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">Unmatched</button>
                  <button name="status" value="rejected" className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">Reject</button>
                </div>
              </form>
            </div>
          </article>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">No official action records match these filters.</div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Roll-call outcome review</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Topic outcomes without named individual votes</h2>
          </div>
          <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-100">{rollCallReviewItems.length} items</span>
        </div>
        {rollCallReviewItems.slice(0, 80).map(({ item, meeting, body }) => (
          <article key={item.id} className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">Roll call pending</span>
              {item.vote_outcome ? <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">Topic outcome parsed</span> : null}
            </div>
            <p className="mt-3 text-sm text-slate-400">
              {formatDate(meeting?.meeting_date)} · {body?.name ?? "Public body pending"} · {body?.jurisdiction ?? "Jurisdiction pending"}
            </p>
            <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
            {item.vote_outcome ? <p className="mt-2 text-sm text-cyan-100">Outcome: {item.vote_outcome}</p> : null}
            <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-100">Source snippet</summary>
              <p className="mt-2 leading-6">{item.source_snippet ?? item.source_text.slice(0, 900)}</p>
            </details>
          </article>
        ))}
      </section>
    </div>
  );
}
