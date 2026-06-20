import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getPublicCivicCaseAdminQueue } from "@/lib/public-cases/public-civic-cases";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default async function AdminPublicCasesPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");
  const cases = await getPublicCivicCaseAdminQueue();
  const needsReview = cases.filter((entry) => entry.review_status === "needs_review");
  const highPriority = cases.filter((entry) => entry.priority === "urgent" || entry.priority === "high");

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Public civic case review"
        description="Review source-backed public concerns and government issue follow-ups extracted from meeting topics, public comment, and agenda records."
        actions={
          <>
            <Link href="/admin/cases/import" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">Import CSV/JSON</Link>
            <Link href="/cases" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">Public cases</Link>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Extracted</p><p className="mt-3 text-3xl font-semibold text-white">{cases.length}</p></div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">Needs review</p><p className="mt-3 text-3xl font-semibold text-white">{needsReview.length}</p></div>
        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-100">High priority</p><p className="mt-3 text-3xl font-semibold text-white">{highPriority.length}</p></div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">Public visibility</p><p className="mt-3 text-lg font-semibold text-white">Review-gated</p></div>
      </section>

      <section className="space-y-3">
        {cases.slice(0, 180).map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">{entry.civic_layer_label}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{entry.jurisdiction}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{entry.policy_area}</span>
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">{entry.review_status}</span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{pct(entry.confidence_score)} confidence</span>
              {entry.badges.map((badge) => (
                <span key={badge} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{badge}</span>
              ))}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-white">{entry.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{entry.plain_language_summary}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300"><span className="font-semibold text-slate-100">Priority:</span> {entry.priority}</p>
              <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300"><span className="font-semibold text-slate-100">Status:</span> {entry.status.replace(/_/g, " ")}</p>
              <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300"><span className="font-semibold text-slate-100">Source type:</span> {entry.source_type.replace(/_/g, " ")}</p>
            </div>
            {entry.source_snippet ? (
              <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                <summary className="cursor-pointer font-semibold text-slate-100">Redacted source snippet</summary>
                <p className="mt-2 leading-6">{entry.source_snippet}</p>
              </details>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.related_meeting_id ? <Link href={`/events/${entry.related_meeting_id}`} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">Meeting</Link> : null}
              {entry.related_voting_card_id ? <Link href="/admin/voting-cards" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">Voting card</Link> : null}
              {entry.source_url ? <Link href={entry.source_url} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">Source</Link> : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
