import Link from "next/link";
import { notFound } from "next/navigation";

import { GovCrmPageShell } from "@/app/gov/_components";
import { getServiceCatalogBySlug, getServiceActionStatusLabel } from "@/lib/govcrm/submission-engine";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

type GovCatalogDetailPageProps = {
  params: Promise<{ catalogId: string }>;
};

export const dynamic = "force-dynamic";

export default async function GovCatalogDetailPage({ params }: GovCatalogDetailPageProps) {
  await requireGovCrmAccess();
  const { catalogId } = await params;
  const catalog = getServiceCatalogBySlug(catalogId);
  if (!catalog) notFound();

  return (
    <GovCrmPageShell
      title={catalog.governmentEntityName}
      description={`Staff catalog configuration for ${catalog.jurisdiction}. Service actions can connect to document intake, form-fill, external links, and staff review workflows.`}
    >
      <div className="flex flex-wrap gap-2">
        <Link href={`/gov/public/${catalog.slug}`} className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
          Open portal preview
        </Link>
        <a href={catalog.sourceUrl} target="_blank" rel="noreferrer" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
          Official source
        </a>
      </div>

      <section className="space-y-4">
        {catalog.categories.map((category) => (
          <article key={category.id} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{category.name}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{category.description}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                {category.actions.length} actions
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {category.actions.map((action) => (
                <div key={action.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{action.title}</p>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                      {getServiceActionStatusLabel(action)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{action.staffProcessingDescription}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{action.actionType}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </GovCrmPageShell>
  );
}
