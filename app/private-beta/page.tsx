import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getPrivateBetaFeedbackSummary, listPrivateBetaPublicUpdates } from "@/lib/private-beta/feedback";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function PrivateBetaPage() {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect("/auth?next=%2Fprivate-beta");
  }

  const summary = getPrivateBetaFeedbackSummary();
  const updates = listPrivateBetaPublicUpdates();
  const testPath = [
    { title: "Sign in and profile", detail: "Confirm account access, sign out, sign back in, and profile buttons." },
    { title: "Voter verification", detail: "Try the guided verification path and report any confusing step." },
    { title: "Vote flow", detail: "Open Vote, inspect a card, submit a civic signal when allowed, and check history." },
    { title: "Explore data", detail: "Browse communities, events, officials, cases, elections, and issues for stale or missing records." },
    { title: "Community hub", detail: "Open your community page and check whether the dashboard explains what matters." },
    { title: "Send feedback", detail: "Report the first broken, stale, or confusing thing while it is fresh." },
  ];

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Private Beta"
        title="Tester hub"
        description="A simple operating page for invited testers. The site stays no-index while we verify account flows, civic data freshness, and feedback triage."
        meta={
          <>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
              Signed in as {user.name}
            </span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
              {summary.open} open reports
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/feedback" className="rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
              Send feedback
            </Link>
            <Link href="/profile" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30">
              Profile
            </Link>
          </div>
        }
      />

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Suggested Pass</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Run through the core flows</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
            Private link only
          </span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {testPath.map((item, index) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step {index + 1}</p>
              <h3 className="mt-2 text-base font-semibold text-slate-50">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Queue</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Feedback status</h2>
          <div className="mt-5 grid gap-3">
            {[
              ["Open", summary.open],
              ["Resolved", summary.resolved],
              ["Public updates", summary.publicUpdates],
              ["Needs follow-up", summary.needsFollowUp],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3">
                <span className="text-sm font-semibold text-slate-200">{label}</span>
                <span className="text-lg font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Resolved</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Tester-visible updates</h2>
            </div>
            <Link href="/feedback" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100">
              Report another issue
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {updates.length ? (
              updates.slice(0, 8).map((update) => (
                <article key={update.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                      Resolved
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(update.resolvedAt)}</span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-50">{update.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{update.update}</p>
                  {update.pageUrl ? <p className="mt-2 text-xs text-cyan-200">{update.pageUrl}</p> : null}
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-400">
                No tester-visible resolved updates yet. Admins can add a public resolved note when closing feedback.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
