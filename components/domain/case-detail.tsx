import { Suspense } from "react";
import Link from "next/link";

import { CaseSupportPanel } from "@/components/domain/case-support-panel";
import { CommunityBriefThemesSection } from "@/components/domain/community-brief-themes-section";
import { RevealIconChip } from "@/components/domain/reveal-icon-chip";
import { SentimentHistoryChart } from "@/components/domain/sentiment-history-chart";
import { TruthMeter } from "@/components/domain/truth-meter";
import { VoteCard } from "@/components/domain/vote-card";
import { canUserVote } from "@/lib/auth/guards";
import { buildSentimentHistory } from "@/lib/sentiment/history";
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
  const currentSupport = Math.min(82, Math.max(28, 32 + caseItem.supportCount * 8 + caseItem.followCount * 3));
  const history = buildSentimentHistory(`case-detail-${caseItem.id}`, currentSupport, { points: 8, opposeBias: 27 });
  const displayDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Pending";

  return (
    <div className="space-y-6">
      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-cyan-300/18 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            {courtLabel(caseItem.courtLevel)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            {caseItem.stage}
          </span>
          <span className="rounded-full border border-amber-300/18 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
            {caseItem.status}
          </span>
          {caseItem.isRealCourtRecord ? (
            <span className="rounded-full border border-emerald-300/18 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
              Public court data
            </span>
          ) : null}
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50">{caseItem.title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">{caseItem.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {caseItem.issueTags.map((tag) => (
            <RevealIconChip key={tag} {...getIssueVisualToken(tag)} tone="civic" />
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">{caseItem.followCount} following</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">{caseItem.supportCount} supporting</span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">{caseItem.jurisdictionName}</span>
        </div>
        {caseItem.isRealCourtRecord ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Court</p>
              <p className="mt-2 text-sm font-semibold text-slate-50">{caseItem.courtName ?? "Court pending"}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Case number</p>
              <p className="mt-2 text-sm font-semibold text-slate-50">{caseItem.caseNumber ?? "Pending"}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Case type</p>
              <p className="mt-2 text-sm font-semibold text-slate-50">{caseItem.caseType?.replaceAll("_", " ") ?? "Unknown"}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Last checked</p>
              <p className="mt-2 text-sm font-semibold text-slate-50">{displayDate(caseItem.lastCheckedAt)}</p>
            </div>
          </div>
        ) : null}
        {!caseItem.isRealCourtRecord ? (
          <div className="mt-6">
          <SentimentHistoryChart data={history} title="Sentiment over time" currentValue={currentSupport} />
          </div>
        ) : null}
        {caseItem.keyDates.length ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {caseItem.keyDates.map((entry) => (
              <div key={`${entry.label}-${entry.date}`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{entry.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-50">
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

      <section className="rounded-[1.75rem] border border-amber-300/16 bg-amber-500/10 p-5 text-sm text-amber-100 shadow-card">
        Public court metadata only. This page is not a legal filing, not legal advice, and not direct amicus participation. Criminal records are displayed neutrally; charges are allegations unless a sourced disposition says otherwise.
      </section>

      {caseItem.isRealCourtRecord ? (
        <>
          <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Timeline / docket</h2>
            <div className="mt-5 space-y-3">
              {caseItem.docketEntries?.length ? (
                caseItem.docketEntries.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-slate-100">{entry.title}</p>
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{displayDate(entry.entryDate)}</span>
                    </div>
                    {entry.description ? <p className="mt-2 text-sm leading-6 text-slate-400">{entry.description}</p> : null}
                    {entry.documentUrl ? (
                      <Link href={entry.documentUrl} className="mt-3 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Open public document
                      </Link>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-slate-400">Docket entries pending review.</div>
              )}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Public parties</h2>
              <div className="mt-5 space-y-2">
                {caseItem.parties?.length ? (
                  caseItem.parties.map((party) => (
                    <div key={party.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm font-semibold text-slate-100">{party.partyName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{party.partyRole ?? "Party role pending"}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-slate-400">Public party details pending review.</div>
                )}
              </div>
            </div>

            <div className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Public documents</h2>
              <div className="mt-5 space-y-2">
                {caseItem.documents?.length ? (
                  caseItem.documents.map((document) => (
                    <div key={document.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm font-semibold text-slate-100">{document.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{document.documentType ?? "Document"}</p>
                      {document.documentUrl ? (
                        <Link href={document.documentUrl} className="mt-3 inline-flex text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                          Open original
                        </Link>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-slate-400">Public documents pending review.</div>
                )}
              </div>
            </div>
          </section>

          <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Source explorer</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {caseItem.sourceAttributions?.length ? (
                caseItem.sourceAttributions.map((source) => (
                  <div key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-semibold text-slate-100">{source.sourceName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{source.reviewStatus.replaceAll("_", " ")}</p>
                    {source.fieldsDerived.length ? <p className="mt-2 text-xs text-slate-400">Fields: {source.fieldsDerived.join(", ")}</p> : null}
                    {source.sourceUrl ? (
                      <Link href={source.sourceUrl} className="mt-3 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                        Open source
                      </Link>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-slate-400">Source attribution pending.</div>
              )}
            </div>
          </section>
        </>
      ) : null}

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
