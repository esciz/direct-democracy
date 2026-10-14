import Link from "next/link";

import { GovCrmPageShell } from "@/app/gov/_components";
import { getServiceCatalogs } from "@/lib/govcrm/submission-engine";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovCatalogsPage() {
  await requireGovCrmAccess();
  const catalogs = getServiceCatalogs();

  return (
    <GovCrmPageShell
      title="Service catalogs"
      description="Configurable service catalogs for state, county, city, school district, university, and special district submission workflows."
    >
      <section className="grid gap-4 md:grid-cols-2">
        {catalogs.map((catalog) => (
          <article key={catalog.id} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">{catalog.governmentEntityName}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {catalog.jurisdiction} - {catalog.entityType.replace("_", " ")}
                </p>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
                {catalog.categories.length} categories
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {catalog.categories.reduce((sum, category) => sum + category.actions.length, 0)} configured service action stubs. No resident submissions are seeded.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/gov/catalogs/${catalog.slug}`} className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
                Staff view
              </Link>
              <Link href={`/gov/public/${catalog.slug}`} className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
                Portal preview
              </Link>
            </div>
          </article>
        ))}
      </section>
    </GovCrmPageShell>
  );
}
