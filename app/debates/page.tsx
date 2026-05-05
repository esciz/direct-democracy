import Link from "next/link";

import { RecommendedDebatePanel } from "@/components/domain/recommended-debate-panel";
import { PageIntro } from "@/components/ui/page-intro";
import { canUserCreateDebate } from "@/lib/auth/guards";
import { getRecommendedDebatesForUser } from "@/lib/debates/recommendations";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getPhaseOneDebates } from "@/lib/debates/store";

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DebatesPage() {
  const user = await getCurrentUser();
  const [debates, recommendedDebates] = await Promise.all([
    getPhaseOneDebates(),
    getRecommendedDebatesForUser(user.id, { limit: 3 }).catch(() => []),
  ]);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Debates"
        title="Structured debates"
        description="Simple civic debates with two sides and ordered statements. Recommended debates now surface the strongest issue-based invitations instead of pushing random conflict."
        actions={
          canUserCreateDebate(user) ? (
            <Link
              href="/debates/new"
              className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Start debate
            </Link>
          ) : undefined
        }
      />

      <RecommendedDebatePanel
        title="Recommended for your civic record"
        description="These debate invitations prioritize issue overlap, jurisdiction relevance, and higher-quality participants so the platform feels more alive without rewarding noise."
        recommendations={recommendedDebates}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {debates.length ? (
          debates.map((debate) => (
            <article key={debate.id} className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">
                  Debate
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {formatDateLabel(debate.createdAt)}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {debate.issueText ? <p className="text-sm font-medium text-slate-500">{debate.issueText}</p> : null}
                <h2 className="text-xl font-semibold text-ink">{debate.title}</h2>
                <p className="text-sm leading-7 text-slate-700">{debate.description}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Side A</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{debate.sideAName}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Side B</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{debate.sideBName}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-500">
                    {debate.statementCount} statement{debate.statementCount === 1 ? "" : "s"}
                  </p>
                  <Link href={`/debates/${debate.id}`} className="text-sm font-semibold text-civic-700 hover:text-civic-900">
                    View debate
                  </Link>
                </div>
              </div>
            </article>
          ))
        ) : (
          <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 shadow-card lg:col-span-2">
            No debates yet.
          </section>
        )}
      </section>
    </div>
  );
}
