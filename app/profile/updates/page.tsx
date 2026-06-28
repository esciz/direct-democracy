import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { getCitizenUpdateDigest } from "@/lib/citizen-actions/updates";
import { getCurrentUser } from "@/lib/server/auth-session";

function badgeClass(tone: "green" | "amber" | "slate" | "cyan") {
  const classes = {
    green: "bg-civic-50 text-civic-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
    cyan: "bg-cyan-50 text-cyan-700",
  };
  return `rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${classes[tone]}`;
}

function updateLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function ProfileUpdatesPage() {
  const user = await getCurrentUser();
  const digest = await getCitizenUpdateDigest(user);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Watchlist Updates"
        title="What changed on your civic watchlist"
        description="A deterministic digest from followed communities, decisions, projects, meetings, issues, cases, and elections. No speculative alerts, no fake push counts."
        meta={
          <>
            <span className={badgeClass("cyan")}>{digest.totals.updatesGenerated} updates</span>
            <span className={badgeClass("green")}>{digest.totals.sourceBackedUpdates} source-backed</span>
            <span className={badgeClass(digest.totals.reviewNeededUpdates ? "amber" : "slate")}>{digest.totals.reviewNeededUpdates} need review</span>
          </>
        }
        actions={
          <Link href="/profile" className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
            Back to profile
          </Link>
        }
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Followed", digest.totals.followedItems],
            ["Updates", digest.totals.updatesGenerated],
            ["Source-backed", digest.totals.sourceBackedUpdates],
            ["Limited source", digest.totals.limitedSourceUpdates],
            ["Stale", digest.totals.staleFollowedItems],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-lg font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Digest</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-ink">Latest followed-item updates</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          These cards explain why an item is on your radar and link back to the best available civic page or source-backed detail.
        </p>

        {digest.records.length ? (
          <div className="mt-6 space-y-4">
            {digest.records.map((record) => (
              <article key={record.id} className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap gap-2">
                  <span className={badgeClass(record.sourceBacked ? "green" : "amber")}>{record.sourceBacked ? "Source-backed" : "Limited source"}</span>
                  <span className={badgeClass(record.needsReview ? "amber" : "slate")}>{record.needsReview ? "Needs review" : updateLabel(record.updateType)}</span>
                  <span className={badgeClass("cyan")}>{record.targetType}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-ink">{record.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{record.summary}</p>
                <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">{record.whyItMatters}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link href={record.href} className="inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                    Open item
                  </Link>
                  <span className="text-xs text-slate-500">{record.sourceLabel}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            No watchlist updates yet. Follow a community, decision, project, meeting, issue, case, or election to start this digest.
          </div>
        )}
      </section>
    </div>
  );
}
