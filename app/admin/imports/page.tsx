import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { syncNevadaElectionsSourcesAction, syncNevadaOfficialsSourcesAction } from "@/lib/civic-data/actions";
import { getAdminImportRuns } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value) : "In progress";
}

type AdminImportsPageProps = {
  searchParams?: Promise<{
    error?: string;
    synced?: string;
  }>;
};

export default async function AdminImportsPage({ searchParams }: AdminImportsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const runs = await getAdminImportRuns();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Import runs"
        description="Inspect recent manual and scheduled civic data sync attempts, including record counts and parser errors."
        actions={
          <div className="flex flex-wrap gap-2">
            <form action={syncNevadaOfficialsSourcesAction}>
              <button type="submit" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
                Sync Officials
              </button>
            </form>
            <form action={syncNevadaElectionsSourcesAction}>
              <button type="submit" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
                Sync Elections
              </button>
            </form>
            <Link href="/admin/imports/manual-candidates" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Manual Candidates
            </Link>
            <Link href="/admin/sources" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Sources
            </Link>
          </div>
        }
      />

      {params?.synced ? (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {params.synced === "elections" ? "Election source sync completed." : "Officials source sync completed."}
        </div>
      ) : null}
      {params?.error ? (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">One or more source syncs failed. Review import logs below.</div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1.1fr_0.8fr_0.8fr_0.5fr_0.5fr]">
          <span>Source</span>
          <span>Started</span>
          <span>Completed</span>
          <span>Seen</span>
          <span>Changed</span>
        </div>
        <div className="divide-y divide-white/10">
          {runs.length > 0 ? (
            runs.map((run) => (
              <article key={run.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.1fr_0.8fr_0.8fr_0.5fr_0.5fr]">
                <div>
                  <p className="font-semibold text-slate-50">{run.sourceName}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{run.status.replaceAll("_", " ")}</p>
                  {run.errorLog ? <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-xs text-rose-100">{run.errorLog}</pre> : null}
                </div>
                <p className="text-slate-300">{formatDate(run.startedAt)}</p>
                <p className="text-slate-300">{formatDate(run.completedAt)}</p>
                <p className="text-slate-100">{run.recordsSeen.toLocaleString()}</p>
                <p className="text-slate-100">{run.recordsChanged.toLocaleString()}</p>
              </article>
            ))
          ) : (
            <p className="px-4 py-8 text-sm text-slate-400">No import runs have been recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
