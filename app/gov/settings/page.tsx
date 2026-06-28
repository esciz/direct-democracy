import Link from "next/link";

import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getGovCrmOperationsDashboard } from "@/lib/govcrm/operations-dashboard";
import { getGovTenantBySlug, GOV_TENANT_TYPE_LABELS, tenantHref } from "@/lib/govcrm/tenants";

export const dynamic = "force-dynamic";

function formatLabel(value: string | undefined) {
  return value?.replaceAll("_", " ") ?? "Pending";
}

type GovSettingsPageProps = {
  searchParams?: Promise<{
    tenant?: string;
  }>;
};

export default async function GovSettingsPage({ searchParams }: GovSettingsPageProps) {
  await requireGovCrmAccess();
  const params = searchParams ? await searchParams : undefined;
  const tenant = getGovTenantBySlug(params?.tenant);
  const dashboard = await getGovCrmOperationsDashboard();

  return (
    <GovCrmPageShell
      title="GovCRM trust settings"
      description="Read-only foundation controls for roles, claims, security, and data-domain separation. Future government workflow settings must preserve these product boundaries."
    >
      <section className="rounded-md border border-cyan-400/20 bg-cyan-400/10 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Active tenant profile</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{tenant.shortName} · {GOV_TENANT_TYPE_LABELS[tenant.type]}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">Review actor-specific modules, capabilities, departments, roles, and read-only public civic record policy.</p>
          </div>
          <Link href={tenantHref("/gov/settings/tenant", tenant)} className="inline-flex min-h-10 w-fit items-center justify-center rounded-md border border-cyan-300/30 bg-slate-950 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/10">
            Open tenant configuration
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Roles</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Platform role model</h2>
          <ul className="mt-5 space-y-3">
            {dashboard.health.trust.roles.map((role) => (
              <li key={role.id ?? role.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="font-semibold text-white">{role.label ?? formatLabel(role.id)}</p>
                <p className="mt-1 text-xs text-slate-400">Voting rights group: {formatLabel(role.votingRightsGroup)}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Claims</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Segmentation policy</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {dashboard.health.trust.claimDomains.map((domain) => (
              <span key={domain} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                {formatLabel(domain)}
              </span>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-300">
            Political affiliation, stakeholder status, organization affiliation, and demographics are optional segmentation signals. They are not required for participation and are never used for vote weighting.
          </p>
          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
            Verified Resident and Verified Voter keep equal participation rights. Segmentation is the civic signal.
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Security</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Foundation controls</h2>
          <ul className="mt-5 space-y-3">
            {dashboard.health.trust.securityControls.map((control) => (
              <li key={control.id ?? control.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-white">{control.label ?? formatLabel(control.id)}</p>
                  <span className="w-fit rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
                    {formatLabel(control.status)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{control.purpose ?? "Purpose pending"}</p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">Separation</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Data domains</h2>
          <ul className="mt-5 space-y-3">
            {dashboard.health.trust.dataDomains.map((domain) => (
              <li key={domain.id ?? domain.domain ?? domain.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="font-semibold text-white">{domain.label ?? formatLabel(domain.domain ?? domain.id)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{domain.purpose ?? domain.separationRule ?? "Purpose pending"}</p>
                {domain.contains?.length ? <p className="mt-2 text-xs text-slate-500">Contains: {domain.contains.join(", ")}</p> : null}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            GovCRM may reference public civic data, but it cannot modify public voting, sentiment, criticism, candidate records, official records, or source attribution.
          </div>
        </article>
      </section>
    </GovCrmPageShell>
  );
}
