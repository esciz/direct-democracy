import Link from "next/link";
import { redirect } from "next/navigation";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PageIntro } from "@/components/ui/page-intro";
import { getAdminOfficials } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");

function readGenerated<T>(fileName: string, fallback: T): T {
  const filePath = path.join(GENERATED_DIR, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function formatGeneratedDate(value: string | null | undefined) {
  if (!value) return "Not generated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not generated";
  return date.toLocaleString();
}

export default async function AdminOfficialsPage() {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const officials = await getAdminOfficials();
  const coverage = readGenerated<{ generatedAt?: string; totals?: Record<string, number>; failures?: string[] }>("officials-coverage-audit.json", {});
  const currentOfficials = readGenerated<{ generatedAt?: string; records?: Array<{ id: string; name: string; title: string; role_category: string; selection_method: string; source_label: string; source_url: string | null; last_verified_at: string | null }> }>("current-officials-runtime.json", { records: [] });

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Officials"
        description="Review normalized officeholder records imported from Nevada beta civic sources."
        actions={
          <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Dashboard
          </Link>
        }
      />

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Current officeholder runtime</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">Officials coverage guard</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Public community pages use compact current-official records. Historical official actions remain separate for vote and meeting attribution.
            </p>
          </div>
          <Link href="/admin/operations?operation=officials_carson_city_refresh" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Refresh controls
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Runtime officials", coverage.totals?.runtimeOfficials ?? currentOfficials.records?.length ?? 0],
            ["Carson City", coverage.totals?.carsonCityRuntimeOfficials ?? 0],
            ["Priority gaps", coverage.totals?.emptyPublicSectionRisks ?? "audit pending"],
            ["Failures", coverage.totals?.failures ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-slate-950/35 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
              <p className="mt-2 text-lg font-semibold text-slate-50">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">Last generated {formatGeneratedDate(coverage.generatedAt ?? currentOfficials.generatedAt)}</p>
        {coverage.failures?.length ? (
          <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">
            {coverage.failures.slice(0, 4).join(" ")}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1fr_1fr_0.7fr_0.7fr_1fr]">
          <span>Name</span>
          <span>Public title</span>
          <span>Role</span>
          <span>Method</span>
          <span>Source</span>
        </div>
        <div className="divide-y divide-white/10">
          {(currentOfficials.records ?? []).length > 0 ? (
            (currentOfficials.records ?? []).slice(0, 50).map((official) => (
              <article key={official.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1fr_1fr_0.7fr_0.7fr_1fr]">
                <p className="font-semibold text-slate-50">{official.name}</p>
                <p className="text-slate-300">{official.title}</p>
                <p className="text-slate-300">{official.role_category.replaceAll("_", " ")}</p>
                <p className="text-slate-300">{official.selection_method}</p>
                <div>
                  {official.source_url ? <a href={official.source_url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-200">{official.source_label}</a> : <p className="text-slate-300">{official.source_label}</p>}
                  <p className="mt-1 text-xs text-slate-500">Verified {formatGeneratedDate(official.last_verified_at)}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="px-4 py-8 text-sm text-slate-400">No current-officeholder runtime records have been generated yet.</p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1fr_1fr_0.8fr_0.6fr_0.7fr]">
          <span>Name</span>
          <span>Office</span>
          <span>Jurisdiction</span>
          <span>Status</span>
          <span>Updated</span>
        </div>
        <div className="divide-y divide-white/10">
          {officials.length > 0 ? (
            officials.map((official) => (
              <article key={official.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1fr_1fr_0.8fr_0.6fr_0.7fr]">
                <div>
                  <p className="font-semibold text-slate-50">{official.fullName}</p>
                  <p className="mt-1 text-xs text-slate-400">{official.partyText ?? "No party recorded"}</p>
                </div>
                <p className="text-slate-300">{official.officeTitle}</p>
                <p className="text-slate-300">{official.jurisdictionName}</p>
                <p className="font-semibold text-slate-100">{official.status}</p>
                <div>
                  <p className="text-slate-300">{formatDate(official.updatedAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">{official.sourceName ?? "No source"}</p>
                </div>
              </article>
            ))
          ) : (
            <p className="px-4 py-8 text-sm text-slate-400">No normalized officials have been imported yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
