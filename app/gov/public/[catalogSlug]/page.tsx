import Link from "next/link";
import { notFound } from "next/navigation";

import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getServiceActionStatusLabel, getServiceCatalogBySlug } from "@/lib/govcrm/submission-engine";

type GovPublicCatalogPageProps = {
  params: Promise<{ catalogSlug: string }>;
};

export const dynamic = "force-dynamic";

export default async function GovPublicCatalogPage({ params }: GovPublicCatalogPageProps) {
  await requireGovCrmAccess();
  const { catalogSlug } = await params;
  const catalog = getServiceCatalogBySlug(catalogSlug);
  if (!catalog) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 pt-2 sm:px-6 lg:px-8">
      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">GovCRM portal preview</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{catalog.governmentEntityName}</h1>
        <p className="mt-3 text-lg text-slate-200">How can we help?</p>
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
          Search preview - service search will filter catalog actions after resident portal enrollment.
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalog.categories.map((category) => (
          <article key={category.id} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">{category.name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{category.description}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{category.actions.length} services</p>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        {catalog.categories.map((category) => (
          <div key={`actions-${category.id}`} className="space-y-3">
            <h2 className="text-xl font-semibold text-white">{category.name}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {category.actions.map((action) => (
                <Link key={action.id} href={`/gov/public/${catalog.slug}/${action.slug}`} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/35 hover:bg-cyan-400/10">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base font-semibold text-white">{action.title}</p>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                      {getServiceActionStatusLabel(action)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{action.publicUserDescription}</p>
                  <div className="mt-4 grid gap-2 text-xs text-slate-400">
                    <p>Estimated steps: {action.estimatedSteps.length}</p>
                    <p>Required documents: {action.requiredDocuments.length ? action.requiredDocuments.join(", ") : "None listed yet"}</p>
                    <p>Path: {action.actionType.replace("_", " ")}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
