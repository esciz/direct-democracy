import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { getNvSosOperationalStatus, getNvSosSourceDashboard } from "@/lib/nv-sos/public";
import { getCurrentUser } from "@/lib/server/auth-session";
import type { NvSosExpandedSource, NvSosFetchLogEntry, NvSosSource } from "@/lib/nv-sos/pipeline";

export const dynamic = "force-dynamic";

function statusClass(status?: string) {
  if (status === "success_html" || status === "success_pdf") return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  if (status?.startsWith("blocked_") || status === "forbidden") return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  if (status === "error" || status === "error_http" || status === "error_fetch" || status === "not_found") return "border-rose-300/20 bg-rose-500/10 text-rose-100";
  return "border-white/10 bg-white/[0.05] text-slate-300";
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function latestBySourceId(entries: NvSosFetchLogEntry[]) {
  const map = new Map<string, NvSosFetchLogEntry>();
  for (const entry of entries) map.set(entry.source_id, entry);
  return map;
}

function SeedSourceRow({ source, latest }: { source: NvSosSource; latest?: NvSosFetchLogEntry }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-50">{source.id}</h2>
            <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-100">
              seed
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusClass(latest?.status)}`}>
              {latest?.status?.replaceAll("_", " ") ?? "not fetched"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">{source.source_type.replaceAll("_", " ")} · {source.expected_content_type}</p>
          <a href={source.source_url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs font-semibold text-cyan-200">
            {source.source_url}
          </a>
          {source.notes ? <p className="mt-2 text-xs leading-5 text-slate-500">{source.notes}</p> : null}
          {latest?.error ? <p className="mt-2 text-xs leading-5 text-rose-200">{latest.error}</p> : null}
        </div>
        <div className="grid gap-2 text-sm text-slate-300 lg:min-w-72">
          <p>Last fetched: {formatDate(latest?.fetched_at)}</p>
          <p>HTTP: {latest?.http_status ?? "pending"} · bytes: {latest?.bytes ?? 0}</p>
          <p className="break-all">Cache: {latest?.cached_path ?? "none"}</p>
          <p>Cookies used: {latest?.used_cookie_file ? "yes" : "no"}</p>
        </div>
      </div>
    </article>
  );
}

function ExpandedSourceRow({ source, latest }: { source: NvSosExpandedSource; latest?: NvSosFetchLogEntry }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-50">{source.source_id}</h2>
            <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100">
              expanded
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${statusClass(latest?.status)}`}>
              {latest?.status?.replaceAll("_", " ") ?? "not fetched"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {source.source_type.replaceAll("_", " ")} · {source.candidate_name ?? "Candidate pending"} · {source.discovery_context.link_text ?? "No link label"}
          </p>
          <a href={source.source_url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-xs font-semibold text-cyan-200">
            {source.source_url}
          </a>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Parent: {source.parent_source_id ?? "none"} · From: {source.discovery_context.discovered_from_url ?? "unknown"}
          </p>
          {latest?.error ? <p className="mt-2 text-xs leading-5 text-rose-200">{latest.error}</p> : null}
        </div>
        <div className="grid gap-2 text-sm text-slate-300 lg:min-w-72">
          <p>Last fetched: {formatDate(latest?.fetched_at)}</p>
          <p>HTTP: {latest?.http_status ?? "pending"} · bytes: {latest?.bytes ?? 0}</p>
          <p className="break-all">Cache: {latest?.cached_path ?? "none"}</p>
          <p>Cookies used: {latest?.used_cookie_file ? "yes" : "no"}</p>
        </div>
      </div>
    </article>
  );
}

export default async function AdminNvSosSourcesPage() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") redirect("/profile");

  const [dashboard, operationalStatus] = await Promise.all([getNvSosSourceDashboard(), getNvSosOperationalStatus()]);
  const allFetch = [...dashboard.fetchLog, ...dashboard.expandedFetchLog];
  const latestEntries = [...latestBySourceId(allFetch).values()];
  const blockedEntries = latestEntries.filter((entry) => entry.status.startsWith("blocked_") || entry.status === "forbidden");
  const blockedUniqueUrlCount = new Set(blockedEntries.map((entry) => entry.source_url)).size;
  const successEntries = latestEntries.filter((entry) => entry.status === "success_html" || entry.status === "success_pdf");
  const successCount = successEntries.length;
  const lastSuccessfulFetch = operationalStatus?.last_successful_live_fetch_at ?? successEntries.map((entry) => entry.fetched_at).sort().at(-1) ?? null;
  const lastSuccessfulParse = operationalStatus?.last_successful_parse_at ?? null;
  const recordsServedFromCache = operationalStatus?.records_served_from_cache ?? 0;
  const sessionStatus = operationalStatus?.session_status ?? (allFetch.length > 0 && successCount === 0 ? "stale_blocked_session" : "active_session");
  const staleSessionWarning = sessionStatus === "stale_blocked_session";
  const latest = latestBySourceId(allFetch);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin · Nevada SOS"
        title="Source registry"
        description="Seed and discovered Nevada SoS sources are fetched with cached session state and blocked pages are logged instead of crashing the pipeline."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/nv-sos-documents" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Documents
            </Link>
            <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Dashboard
            </Link>
          </div>
        }
      />

      <section className={`rounded-2xl border p-5 ${staleSessionWarning ? "border-amber-300/25 bg-amber-500/10" : "border-emerald-300/20 bg-emerald-500/10"}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className={`text-sm font-semibold ${staleSessionWarning ? "text-amber-50" : "text-emerald-50"}`}>
              {staleSessionWarning ? "Stale/blocked session" : "Active session"}
            </p>
            <p className={`mt-2 max-w-3xl text-sm leading-6 ${staleSessionWarning ? "text-amber-100/80" : "text-emerald-100/80"}`}>
              {operationalStatus?.next_recommended_action ?? "Operational status has not been generated yet. Run npm run nv-sos:status after the next pipeline run."}
            </p>
          </div>
          <div className="grid gap-1 text-sm text-slate-200 lg:min-w-72">
            <p>Last successful live fetch: {formatDate(lastSuccessfulFetch)}</p>
            <p>Last successful cached parse: {formatDate(lastSuccessfulParse)}</p>
            <p>Records served from cache: {recordsServedFromCache}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Seed sources</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{dashboard.seedSources.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Discovered URLs</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{dashboard.discovered.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Expanded sources</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{dashboard.expanded.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Last live success</p>
          <p className="mt-3 text-sm font-semibold text-slate-50">{formatDate(lastSuccessfulFetch)}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className={`rounded-2xl border p-5 ${staleSessionWarning ? "border-amber-300/20 bg-amber-500/10" : "border-emerald-300/20 bg-emerald-500/10"}`}>
          <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${staleSessionWarning ? "text-amber-100/70" : "text-emerald-100/70"}`}>Session</p>
          <p className={`mt-3 text-sm font-semibold ${staleSessionWarning ? "text-amber-50" : "text-emerald-50"}`}>{staleSessionWarning ? "Stale/blocked" : "Active"}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Success</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-50">{successCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/70">Blocked unique URLs</p>
          <p className="mt-3 text-3xl font-semibold text-amber-50">{operationalStatus?.blocked_unique_urls ?? blockedUniqueUrlCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Cache records</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-50">{recordsServedFromCache}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-5">
        <p className="text-sm font-semibold text-cyan-50">Refresh Nevada SoS Session</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Run `npm run nv-sos:bootstrap`, complete the browser challenge in the headed browser, press Enter in the terminal after the candidate filing page loads, then rerun `npm run nv-sos:all`.
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Cookie export: {dashboard.hasCookieFile ? "present" : "missing"} · Playwright storage state: {dashboard.hasStorageState ? "present" : "missing"} · Last successful cached parse: {formatDate(lastSuccessfulParse)}.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Seed sources</p>
          <div className="space-y-3">
            {dashboard.seedSources.map((source) => (
              <SeedSourceRow key={source.id} source={source} latest={latest.get(source.id)} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Expanded sources</p>
          <div className="space-y-3">
            {dashboard.expanded.map((source) => (
              <ExpandedSourceRow key={source.source_id} source={source} latest={latest.get(source.source_id)} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
