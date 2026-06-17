import Link from "next/link";

import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getServiceCatalogs } from "@/lib/govcrm/submission-engine";

export const dynamic = "force-dynamic";

export default async function GovPublicPortalIndexPage() {
  await requireGovCrmAccess();
  const catalogs = getServiceCatalogs();

  return (
    <GovCrmPageShell
      title="Public portal previews"
      description="Preview resident-facing service portals that governments could expose publicly after configuration and authorization."
    >
      <section className="grid gap-4 md:grid-cols-2">
        {catalogs.map((catalog) => (
          <Link key={catalog.id} href={`/gov/public/${catalog.slug}`} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-emerald-300/35 hover:bg-emerald-400/10">
            <p className="text-lg font-semibold text-white">{catalog.governmentEntityName}</p>
            <p className="mt-2 text-sm text-slate-400">{catalog.jurisdiction}</p>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {catalog.categories.length} categories and {catalog.categories.reduce((sum, category) => sum + category.actions.length, 0)} service action stubs.
            </p>
          </Link>
        ))}
      </section>
    </GovCrmPageShell>
  );
}
