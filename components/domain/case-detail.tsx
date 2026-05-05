import { Suspense } from "react";
import Link from "next/link";

import { CaseSupportPanel } from "@/components/domain/case-support-panel";
import { CommunityBriefThemesSection } from "@/components/domain/community-brief-themes-section";
import { RevealIconChip } from "@/components/domain/reveal-icon-chip";
import { TruthMeter } from "@/components/domain/truth-meter";
import { VoteCard } from "@/components/domain/vote-card";
import { canUserVote } from "@/lib/auth/guards";
import { getTruthMeter } from "@/lib/truth/ratings";
import { getIssueVisualToken } from "@/lib/ui/visual-tokens";
import type { AuthUser, CaseDetail as CaseDetailType, VoteQuestionCardSummary } from "@/types/domain";

function courtLabel(value: CaseDetailType["courtLevel"]) {
  return value === "local" ? "Local court" : value === "state" ? "State court" : "Federal court";
}

export async function CaseDetail({
  caseItem,
  user,
  returnPath,
  voteQuestion = null,
}: {
  caseItem: CaseDetailType;
  user: AuthUser;
  returnPath: string;
  voteQuestion?: VoteQuestionCardSummary | null;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            {courtLabel(caseItem.courtLevel)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
            {caseItem.stage}
          </span>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
            {caseItem.status}
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{caseItem.title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-700">{caseItem.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {caseItem.issueTags.map((tag) => (
            <RevealIconChip key={tag} {...getIssueVisualToken(tag)} tone="civic" />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{caseItem.followCount} following</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{caseItem.supportCount} supporting</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{caseItem.jurisdictionName}</span>
        </div>
        {caseItem.keyDates.length ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {caseItem.keyDates.map((entry) => (
              <div key={`${entry.label}-${entry.date}`} className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{entry.label}</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {new Date(`${entry.date}T12:00:00Z`).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
        Public support and community input only. This page is not a legal filing, not legal advice, and not direct amicus participation.
      </section>

      {voteQuestion ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Structured case vote</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Vote on how convincing this case is</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                This vote does not decide the legal outcome. It captures whether the public finds the case record persuasive based on the visible claim, evidence, and access context.
              </p>
            </div>
            <Link
              href="/voting"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Explore all vote objects
            </Link>
          </div>

          <div className="mt-6">
            <VoteCard question={voteQuestion} compact returnPath={returnPath} canAnswer={canUserVote(user)} />
          </div>
        </section>
      ) : null}

      <CaseSupportPanel caseItem={caseItem} user={user} returnPath={returnPath} />

      <Suspense fallback={<CaseSupportStatementsFallback />}>
        <CaseSupportStatementsSection caseItem={caseItem} user={user} returnPath={returnPath} />
      </Suspense>

      <Suspense fallback={<CaseCommunityBriefThemesFallback />}>
        <CaseCommunityBriefThemesSection caseItem={caseItem} user={user} returnPath={returnPath} />
      </Suspense>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Next step context</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Community-backed themes can help clarify what matters publicly here. In a future version, those themes could be reviewed by outside legal
          partners before any real court-facing work happens.
        </p>
        <div className="mt-5">
          <Link
            href="/cases"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to cases
          </Link>
        </div>
      </section>
    </div>
  );
}

async function CaseSupportStatementsSection({
  caseItem,
  user,
  returnPath,
}: {
  caseItem: CaseDetailType;
  user: AuthUser;
  returnPath: string;
}) {
  try {
    const supportStatementMeters = await Promise.all(
      caseItem.supportStatements.map(async (statement) => ({
        statementId: statement.id,
        meter: await getTruthMeter(statement.id, user.id),
      })),
    );
    const meterByStatementId = new Map(supportStatementMeters.map((entry) => [entry.statementId, entry.meter]));

    return (
      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Public support statements</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Short public statements showing why people think this case matters to their community.
        </p>
        <div className="mt-5 space-y-3">
          {caseItem.supportStatements.length ? (
            caseItem.supportStatements.map((statement) => {
              const meter = meterByStatementId.get(statement.id);

              return (
                <article key={statement.id} className="rounded-3xl bg-slate-50 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {statement.userName}
                    </span>
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {new Date(statement.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{statement.statement}</p>
                  {meter ? (
                    <div className="mt-4">
                      <TruthMeter meter={meter} viewerRole={user.role} returnPath={returnPath} compact />
                    </div>
                  ) : (
                    <div className="mt-4 rounded-3xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                      Accuracy context is temporarily unavailable for this statement.
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No public support statements yet.</div>
          )}
        </div>
      </section>
    );
  } catch (error) {
    console.error(`[case-detail] support statements failed for ${caseItem.id}`, error);
    return <CaseSupportStatementsFallback failed />;
  }
}

function CaseSupportStatementsFallback({ failed = false }: { failed?: boolean }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">Public support statements</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {failed
          ? "Public support statements are temporarily unavailable."
          : "Loading public support statements and community-rated accuracy."}
      </p>
    </section>
  );
}

async function CaseCommunityBriefThemesSection({
  caseItem,
  user,
  returnPath,
}: {
  caseItem: CaseDetailType;
  user: AuthUser;
  returnPath: string;
}) {
  try {
    return <CommunityBriefThemesSection caseId={caseItem.id} themes={caseItem.communityBriefThemes} user={user} returnPath={returnPath} />;
  } catch (error) {
    console.error(`[case-detail] community themes failed for ${caseItem.id}`, error);
    return <CaseCommunityBriefThemesFallback failed />;
  }
}

function CaseCommunityBriefThemesFallback({ failed = false }: { failed?: boolean }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Community brief themes</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Public-interest themes people want reviewed</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {failed
          ? "Community brief themes are temporarily unavailable."
          : "Loading community-backed themes for this case."}
      </p>
    </section>
  );
}
