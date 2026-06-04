import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import { manualSyncSourceAction } from "@/lib/civic-data/actions";
import { getAdminDataSources } from "@/lib/civic-data/service";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type AdminSourcesPageProps = {
  searchParams?: Promise<{
    error?: string;
    synced?: string;
  }>;
};

function formatDate(value?: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Never";
}

export default async function AdminSourcesPage({ searchParams }: AdminSourcesPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const sources = await getAdminDataSources();

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Data sources"
        description="Review source health, trigger manual imports, and inspect sync status for the Nevada beta data pipeline."
        actions={
          <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
            Dashboard
          </Link>
        }
      />

      {params?.synced ? (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Manual sync completed for {params.synced}.</div>
      ) : null}
      {params?.error ? (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">Sync could not be completed. Check the source error log.</div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="grid gap-4 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr]">
          <span>Source</span>
          <span>Last Sync</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        <div className="divide-y divide-white/10">
          {sources.map((source) => (
            <article key={source.slug} className="grid gap-4 px-4 py-5 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.7fr] md:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-50">{source.name}</h2>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
                    {source.sourceType.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{source.description}</p>
                <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-sm font-semibold text-cyan-200 hover:text-cyan-100">
                  {source.url}
                </a>
                {source.errorLog ? <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/25 p-3 text-xs text-rose-100">{source.errorLog}</pre> : null}
              </div>
              <p className="text-sm text-slate-300">{formatDate(source.lastSyncAt)}</p>
              <p className="text-sm font-semibold text-slate-100">{source.syncStatus.replaceAll("_", " ")}</p>
              <form action={manualSyncSourceAction}>
                <input type="hidden" name="sourceSlug" value={source.slug} />
                <button type="submit" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
                  Manual Sync
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

