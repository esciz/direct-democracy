"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { GOV_TENANT_TYPE_LABELS, type GovTenant } from "@/lib/govcrm/tenants";

function getActiveTenant(tenants: GovTenant[], tenantSlug: string | null) {
  return tenants.find((tenantItem) => tenantItem.slug === tenantSlug || tenantItem.id === tenantSlug) ?? tenants[0];
}

export function GovTenantSwitcher({ tenants, activeTenant }: { tenants: GovTenant[]; activeTenant: GovTenant }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <label className="flex min-w-64 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      Tenant workspace
      <select
        value={activeTenant.slug}
        onChange={(event) => {
          const nextParams = new URLSearchParams(searchParams.toString());
          nextParams.set("tenant", event.target.value);
          router.push(`/gov/dashboard?${nextParams.toString()}`);
        }}
        className="min-h-10 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-cyan-300/50"
      >
        {tenants.map((tenantItem) => (
          <option key={tenantItem.id} value={tenantItem.slug}>
            {tenantItem.shortName} · {GOV_TENANT_TYPE_LABELS[tenantItem.type]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function GovTenantShellHeader({ tenants }: { tenants: GovTenant[] }) {
  const searchParams = useSearchParams();
  const activeTenant = getActiveTenant(tenants, searchParams.get("tenant"));

  return (
    <>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
            Private government workspace
          </span>
          <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
            Role: Gov staff preview
          </span>
          <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
            Type: {GOV_TENANT_TYPE_LABELS[activeTenant.type]}
          </span>
          <span className="rounded-md border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
            Env: gated demo
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-white">{activeTenant.name}</p>
        <p className="mt-1 text-xs text-slate-500">{activeTenant.demoLabel.replaceAll("_", " ")} · {activeTenant.jurisdiction}</p>
      </div>
      <div className="flex flex-col gap-2 lg:items-end">
        <GovTenantSwitcher tenants={tenants} activeTenant={activeTenant} />
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1">GOV_CRM_ENABLED</span>
          <span className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1">No public writes</span>
          <span className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1">Audit required</span>
        </div>
      </div>
    </>
  );
}

export function GovTenantSidebarLabel({ tenants }: { tenants: GovTenant[] }) {
  const searchParams = useSearchParams();
  const activeTenant = getActiveTenant(tenants, searchParams.get("tenant"));

  return (
    <p className="mt-2 text-xs leading-5 text-slate-500">
      {activeTenant.shortName} · {GOV_TENANT_TYPE_LABELS[activeTenant.type]}
    </p>
  );
}
