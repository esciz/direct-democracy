import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { NewsSourceAccessMethod, NewsSourceType } from "@prisma/client";

import { PageIntro } from "@/components/ui/page-intro";
import { runNewsMentionImportAction } from "@/lib/news-mentions/actions";
import { saveNewsSourceAction, seedCarsonNowNewsSource } from "@/lib/news-mentions/source-actions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type NewsSourcesPageProps = {
  searchParams?: Promise<{ saved?: string }>;
};

const exampleSources = [
  "Carson Now",
  "This Is Reno",
  "Reno Gazette Journal",
  "Nevada Independent",
  "KOLO",
  "KRNV",
  "KUNR",
  "Nevada Current",
  "Washoe County newsroom",
  "City of Reno newsroom",
  "Carson City newsroom",
  "UNR news",
];

function formatDate(value?: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Never";
}

function formatValue(value: string) {
  return value.replace(/_/g, " ");
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
      {label}
      {children}
    </label>
  );
}

const inputClass = "rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100";

export default async function AdminNewsSourcesPage({ searchParams }: NewsSourcesPageProps) {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  await seedCarsonNowNewsSource();

  const params = searchParams ? await searchParams : undefined;
  const [sources, recentRuns, pendingCount] = await Promise.all([
    prisma.newsSource.findMany({ orderBy: [{ active: "desc" }, { sourceName: "asc" }] }),
    prisma.newsMentionSearchRun.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
    prisma.newsMention.count({ where: { reviewStatus: "pending_review" } }),
  ]);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin · Data Factory"
        title="Local news sources"
        description="Configure local publishers and government newsrooms for metadata-only civic news ingestion. Imports run by script or admin action, never during public page render."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/data-factory" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Data Factory
            </Link>
            <Link href="/admin/news-mentions" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Review mentions
            </Link>
          </div>
        }
      />

      {params?.saved ? (
        <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-100">
          Saved source {params.saved}.
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <form action={saveNewsSourceAction} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-lg font-semibold text-slate-50">Add or edit source</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Source name">
              <input name="sourceName" defaultValue="Carson Now" className={inputClass} required />
            </Field>
            <Field label="Source slug">
              <input name="sourceSlug" defaultValue="carson_now" className={inputClass} />
            </Field>
            <Field label="Source URL">
              <input name="sourceUrl" defaultValue="https://www.carsonnow.org/" className={inputClass} required />
            </Field>
            <Field label="Source domain">
              <input name="sourceDomain" defaultValue="carsonnow.org" className={inputClass} />
            </Field>
            <Field label="Jurisdiction">
              <input name="jurisdiction" defaultValue="Carson City / Northern Nevada" className={inputClass} />
            </Field>
            <Field label="Refresh frequency">
              <input name="refreshFrequency" defaultValue="daily" className={inputClass} />
            </Field>
            <Field label="Source type">
              <select name="sourceType" defaultValue={NewsSourceType.local_news} className={inputClass}>
                {Object.values(NewsSourceType).map((value) => (
                  <option key={value} value={value}>
                    {formatValue(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Access method">
              <select name="accessMethod" defaultValue={NewsSourceAccessMethod.rss_or_html} className={inputClass}>
                {Object.values(NewsSourceAccessMethod).map((value) => (
                  <option key={value} value={value}>
                    {formatValue(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="RSS URL">
              <input name="rssUrl" defaultValue="https://www.carsonnow.org/feed" className={inputClass} />
            </Field>
            <Field label="Sitemap URL">
              <input name="sitemapUrl" className={inputClass} />
            </Field>
            <Field label="Search URL template">
              <input name="searchUrlTemplate" defaultValue="https://www.carsonnow.org/search/node/{query}" className={inputClass} />
            </Field>
            <Field label="Category URLs">
              <textarea name="categoryUrls" defaultValue={"https://www.carsonnow.org/categories/news\nhttps://www.carsonnow.org/categories/government"} rows={3} className={inputClass} />
            </Field>
            <Field label="Default query terms">
              <textarea
                name="defaultQueryTerms"
                defaultValue={"Carson City\nBoard of Supervisors\nMayor\nClerk-Recorder\nAssessor\nSheriff\nDistrict Attorney\nSchool Board\nPlanning Commission\nelections\nballot question\ncampaign\ncandidate"}
                rows={6}
                className={inputClass}
              />
            </Field>
            <Field label="Notes">
              <textarea name="notes" defaultValue="Metadata-only local news source. Do not store full article text." rows={6} className={inputClass} />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
            <input name="active" type="checkbox" defaultChecked className="size-4 rounded border-white/20 bg-slate-950" />
            Active
          </label>
          <button type="submit" className="dd-button-primary mt-4 rounded-xl px-4 py-2 text-sm font-semibold">
            Save source
          </button>
        </form>

        <div className="space-y-4">
          <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-5">
            <h2 className="text-lg font-semibold text-slate-50">Admin workflow</h2>
            <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-300">
              <p>Add source, test source, preview discovered articles, approve source, run import, view import history, and disable the source if it gets noisy or broken.</p>
              <code className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-cyan-100">npm run civic:import-local-news -- --source=carson_now --limit=50</code>
              <code className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-cyan-100">npm run civic:import-local-news -- --all --limit=100</code>
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-lg font-semibold text-slate-50">Future source examples</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {exampleSources.map((source) => (
                <span key={source} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
                  {source}
                </span>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-lg font-semibold text-slate-50">Queue status</h2>
            <p className="mt-3 text-sm text-slate-300">{pendingCount.toLocaleString()} pending news mention records are waiting for review.</p>
          </section>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">Configured sources</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Each active source normalizes into the shared NewsMention queue.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">{sources.length} sources</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sources.map((source) => (
            <article key={source.id} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-50">{source.sourceName}</h3>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                      {source.active ? "active" : "disabled"}
                    </span>
                  </div>
                  <Link href={source.sourceUrl} target="_blank" className="mt-2 block break-all text-xs text-cyan-200 hover:text-cyan-100">
                    {source.sourceUrl}
                  </Link>
                  <p className="mt-2 text-xs text-slate-500">
                    {source.sourceSlug} · {formatValue(source.sourceType)} · {formatValue(source.accessMethod)} · last checked {formatDate(source.lastCheckedAt)}
                  </p>
                </div>
                <form action={runNewsMentionImportAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="provider" value={source.sourceSlug === "carson_now" ? "CARSON_NOW" : "LOCAL_CONFIGURED"} />
                  <input type="hidden" name="sourceSlug" value={source.sourceSlug} />
                  <input type="hidden" name="limit" value="10" />
                  <input type="hidden" name="dailyCap" value="50" />
                  <input type="hidden" name="force" value="on" />
                  <button type="submit" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:border-cyan-200/40">
                    Test import
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <h2 className="text-lg font-semibold text-slate-50">Import history</h2>
        <div className="mt-4 space-y-3">
          {recentRuns.length ? (
            recentRuns.map((run) => (
              <div key={run.id} className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300">
                <p className="font-semibold text-slate-100">
                  {formatValue(run.provider)} · {run.status}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {run.matchedQuery} · found {run.recordsFound} · created {run.recordsCreated} · updated {run.recordsUpdated} · {formatDate(run.startedAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-slate-400">No local news import history yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
