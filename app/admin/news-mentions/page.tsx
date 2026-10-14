import Link from "next/link";
import { redirect } from "next/navigation";

import { CivicRecordReviewStatus, NewsMentionProviderName, NewsMentionTargetType } from "@prisma/client";

import { PageIntro } from "@/components/ui/page-intro";
import {
  flagIncorrectNewsMentionAction,
  linkNewsMentionToCandidateAction,
  linkNewsMentionToOfficialAction,
  mergeDuplicateNewsMentionsAction,
  runNewsMentionImportAction,
  updateNewsMentionReviewStatusAction,
} from "@/lib/news-mentions/actions";
import { getAdminNewsMentionQueue, getNewsMentionDiagnostics } from "@/lib/news-mentions/store";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type AdminNewsMentionsPageProps = {
  searchParams?: Promise<{
    status?: string;
    targetType?: string;
    targetId?: string;
  }>;
};

const reviewStatuses = [
  CivicRecordReviewStatus.pending_review,
  CivicRecordReviewStatus.approved,
  CivicRecordReviewStatus.verified,
  CivicRecordReviewStatus.rejected,
  CivicRecordReviewStatus.imported,
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not listed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not listed";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

const providerOptions = [
  { value: NewsMentionProviderName.CARSON_NOW, label: "Carson Now" },
  { value: NewsMentionProviderName.LOCAL_CONFIGURED, label: "Configured local source" },
  { value: NewsMentionProviderName.NEWS_API_ORG, label: "NewsAPI" },
];

export default async function AdminNewsMentionsPage({ searchParams }: AdminNewsMentionsPageProps) {
  const user = await getCurrentUser();

  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }

  const params = searchParams ? await searchParams : undefined;
  const statusParam = params?.status ?? CivicRecordReviewStatus.pending_review;
  const status = statusParam === "all" ? "all" : reviewStatuses.includes(statusParam as CivicRecordReviewStatus) ? (statusParam as CivicRecordReviewStatus) : CivicRecordReviewStatus.pending_review;
  const targetType =
    params?.targetType === NewsMentionTargetType.CANDIDATE || params?.targetType === NewsMentionTargetType.OFFICIAL
      ? params.targetType
      : undefined;
  const targetId = typeof params?.targetId === "string" && params.targetId.trim() ? params.targetId.trim() : undefined;
  const [mentions, candidates, officials, runCounts, diagnostics, newsSources] = await Promise.all([
    getAdminNewsMentionQueue(status),
    prisma.candidate.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, fullName: true, ballotName: true } }),
    prisma.official.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, fullName: true, office: { select: { title: true } } } }),
    prisma.newsMentionSearchRun.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
    getNewsMentionDiagnostics({ targetType, targetId }),
    prisma.newsSource.findMany({ orderBy: { sourceName: "asc" } }).catch(() => []),
  ]);
  const returnPath = `/admin/news-mentions?status=${status}`;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="News mention review"
        description="Import provider-normalized article mentions for existing candidates and officials, then approve or verify only sourced matches for public profiles."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Data Admin
            </Link>
            <Link href="/admin/enrichment" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Enrichment Review
            </Link>
            <Link href="/admin/data-factory/news-sources" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              News Sources
            </Link>
          </div>
        }
      />

      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-5">
        <h2 className="text-lg font-semibold text-slate-50">News ingestion safety</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
          This queue stores titles, source names, dates, URLs, and short snippets only. Provider lookups run through scripts or admin actions, never during public page render.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Temporary diagnostics</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              Provider {diagnostics.providerUsed.replace(/_/g, " ")} · {diagnostics.providerHealth.message} · Last run{" "}
              {diagnostics.lastRun?.startedAt ? diagnostics.lastRun.startedAt.toLocaleString() : "never"}
            </p>
          </div>
          <Link
            href={`/admin/news-mentions?status=all${diagnostics.targetType && diagnostics.targetId ? `&targetType=${diagnostics.targetType}&targetId=${diagnostics.targetId}` : ""}`}
            className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
          >
            Open all mentions
          </Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total imported mentions</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{diagnostics.totalMentions}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current profile</p>
            <p className="mt-2 text-sm font-semibold text-slate-100">{diagnostics.targetLabel ?? "No profile selected"}</p>
            <p className="mt-1 text-xs text-slate-500">{diagnostics.profileMentionCount} stored mention{diagnostics.profileMentionCount === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review status counts</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {diagnostics.statusCounts.length ? diagnostics.statusCounts.map((row) => `${formatStatus(row.reviewStatus)}: ${row.count}`).join(" · ") : "No mentions imported"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Profile status counts</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              {diagnostics.profileStatusCounts.length ? diagnostics.profileStatusCounts.map((row) => `${formatStatus(row.reviewStatus)}: ${row.count}`).join(" · ") : "No mentions for profile"}
            </p>
          </div>
        </div>
        {diagnostics.targetType && diagnostics.targetId ? (
          <form action={runNewsMentionImportAction} className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-slate-950/35 p-4 md:grid-cols-[1fr_1fr_0.6fr_auto]">
            <input name="targetType" type="hidden" value={diagnostics.targetType} />
            <input name="targetId" type="hidden" value={diagnostics.targetId} />
            <input name="provider" type="hidden" value={NewsMentionProviderName.CARSON_NOW} />
            <input name="sourceSlug" type="hidden" value="carson_now" />
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Target type
              <input value={diagnostics.targetType} readOnly className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100" />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Target id
              <input value={diagnostics.targetId} readOnly className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100" />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Daily cap
              <input name="dailyCap" defaultValue="20" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100" />
            </label>
            <button className="dd-button-primary self-end rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
              Import profile
            </button>
          </form>
        ) : null}
        {diagnostics.profileMentions.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {diagnostics.profileMentions.slice(0, 4).map((mention) => (
              <a key={mention.id} href={mention.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-sm font-semibold text-slate-100">{mention.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {mention.sourceName} · {formatStatus(mention.reviewStatus)} · {(mention.confidenceScore * 100).toFixed(0)}%
                </p>
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <form action={runNewsMentionImportAction} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Run import now</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Provider
              <select name="provider" defaultValue={NewsMentionProviderName.CARSON_NOW} className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100">
                {providerOptions.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Source
              <select name="sourceSlug" defaultValue="carson_now" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100">
                <option value="carson_now">Carson Now</option>
                {newsSources.map((source) => (
                  <option key={source.id} value={source.sourceSlug}>
                    {source.sourceName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Target limit
              <input name="limit" defaultValue="5" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100" />
            </label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Daily cap
              <input name="dailyCap" defaultValue="100" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100" />
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
            <input name="dryRun" type="checkbox" className="size-4 rounded border-white/20 bg-slate-950" />
            Dry run
          </label>
          <button className="dd-button-primary mt-4 rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
            Run provider
          </button>
        </form>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Import run status</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {runCounts.length ? (
              runCounts.map((row) => (
                <span key={row.status} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                  {row.status}: {row._count._all}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">No import runs yet</span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/admin/news-mentions?status=all" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
              All mentions
            </Link>
            {reviewStatuses.map((value) => (
              <Link key={value} href={`/admin/news-mentions?status=${value}`} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
                {formatStatus(value)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {mentions.length ? (
          mentions.map((mention) => (
            <article key={mention.id} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-50">{mention.title}</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      {formatStatus(mention.reviewStatus)}
                    </span>
                  </div>
                  <a href={mention.url} className="mt-2 block break-all text-xs text-cyan-200 hover:text-cyan-100" rel="noreferrer" target="_blank">
                    {mention.url}
                  </a>
                  <p className="mt-1 text-xs text-slate-500">
                    {mention.sourceName} · {formatDate(mention.publishedAt)} · Confidence {(mention.confidenceScore * 100).toFixed(0)}% · {mention.provider.replace(/_/g, " ")}
                  </p>
                  {mention.snippetOrSummary ? <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">{mention.snippetOrSummary}</p> : null}
                </div>
              </div>

              <form action={updateNewsMentionReviewStatusAction} className="grid gap-3 border-t border-white/10 pt-4 md:grid-cols-[0.7fr_auto]">
                <input name="mentionId" type="hidden" value={mention.id} />
                <input name="returnPath" type="hidden" value={returnPath} />
                <select className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" defaultValue={mention.reviewStatus} name="reviewStatus">
                  {reviewStatuses.map((value) => (
                    <option key={value} value={value}>
                      {formatStatus(value)}
                    </option>
                  ))}
                </select>
                <button className="dd-button-primary rounded-xl px-4 py-2 text-sm font-semibold" type="submit">
                  Save review
                </button>
              </form>

              <div className="grid gap-3 lg:grid-cols-3">
                <form action={linkNewsMentionToCandidateAction} className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-3">
                  <input name="mentionId" type="hidden" value={mention.id} />
                  <input name="returnPath" type="hidden" value={returnPath} />
                  <select name="candidateId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.ballotName ?? candidate.fullName}
                      </option>
                    ))}
                  </select>
                  <button className="dd-button-secondary rounded-xl px-3 py-2 text-xs font-semibold" type="submit">
                    Link candidate
                  </button>
                </form>
                <form action={linkNewsMentionToOfficialAction} className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-3">
                  <input name="mentionId" type="hidden" value={mention.id} />
                  <input name="returnPath" type="hidden" value={returnPath} />
                  <select name="officialId" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                    {officials.map((official) => (
                      <option key={official.id} value={official.id}>
                        {official.fullName} · {official.office.title}
                      </option>
                    ))}
                  </select>
                  <button className="dd-button-secondary rounded-xl px-3 py-2 text-xs font-semibold" type="submit">
                    Link official
                  </button>
                </form>
                <div className="grid gap-2 rounded-xl border border-white/10 bg-slate-950/35 p-3">
                  <form action={flagIncorrectNewsMentionAction}>
                    <input name="mentionId" type="hidden" value={mention.id} />
                    <input name="returnPath" type="hidden" value={returnPath} />
                    <button className="w-full rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100" type="submit">
                      Flag incorrect match
                    </button>
                  </form>
                  <form action={mergeDuplicateNewsMentionsAction}>
                    <input name="duplicateId" type="hidden" value={mention.id} />
                    <input name="returnPath" type="hidden" value={returnPath} />
                    <button className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300" type="submit">
                      Mark duplicate
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-5 text-sm leading-6 text-slate-400">
            No news mentions match this filter yet.
          </div>
        )}
      </section>
    </div>
  );
}
