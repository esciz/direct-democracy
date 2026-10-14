import Link from "next/link";

import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getGovTenantBySlug, GOV_TENANT_TYPE_LABELS, tenantHref } from "@/lib/govcrm/tenants";

export const dynamic = "force-dynamic";

type GovTenantSettingsPageProps = {
  searchParams?: Promise<{
    tenant?: string;
  }>;
};

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function PillList({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span key={value} className="rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
          {formatLabel(value)}
        </span>
      ))}
    </div>
  );
}

export default async function GovTenantSettingsPage({ searchParams }: GovTenantSettingsPageProps) {
  await requireGovCrmAccess();
  const params = searchParams ? await searchParams : undefined;
  const tenant = getGovTenantBySlug(params?.tenant);

  return (
    <GovCrmPageShell
      title="Tenant configuration"
      description={`${tenant.name} configuration. This is a universal GovCRM tenant profile, not a separate product fork.`}
    >
      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-md border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Tenant type</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{GOV_TENANT_TYPE_LABELS[tenant.type]}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{tenant.profile.summary}</p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Fixture label</dt>
              <dd className="mt-1 text-amber-100">{tenant.demoLabel.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Jurisdiction</dt>
              <dd className="mt-1 text-slate-200">{tenant.jurisdiction}</dd>
            </div>
          </dl>
          <Link href={tenantHref("/gov/dashboard", tenant)} className="mt-5 inline-flex min-h-10 items-center rounded-md border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15">
            Back to tenant dashboard
          </Link>
        </article>

        <article className="rounded-md border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Enabled modules</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Universal modules plus actor profile modules</h2>
          <div className="mt-4">
            <PillList values={tenant.modules} />
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-md border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Capabilities</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Workflow capabilities enabled</h2>
          <div className="mt-4">
            <PillList values={tenant.capabilities} />
          </div>
        </article>

        <article className="rounded-md border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Workflows</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Primary workflow types</h2>
          <div className="mt-4">
            <PillList values={tenant.profile.primaryWorkflows} />
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-md border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Departments</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Configured demo departments</h2>
          <ul className="mt-4 divide-y divide-slate-800">
            {tenant.departments.map((department) => (
              <li key={department.id} className="py-3">
                <p className="font-semibold text-white">{department.name}</p>
                <p className="mt-1 text-xs text-amber-100">{department.demoOnly ? "DEMO DEV ONLY" : null}</p>
                <div className="mt-2">
                  <PillList values={department.workflowTypes} />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-md border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Roles</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Staff roles</h2>
          <ul className="mt-4 divide-y divide-slate-800">
            {tenant.staffRoles.map((role) => (
              <li key={role.id} className="py-3">
                <p className="font-semibold text-white">{role.label}</p>
                <p className="mt-1 text-xs text-amber-100">{role.demoOnly ? "DEMO DEV ONLY" : null}</p>
                <div className="mt-2">
                  <PillList values={role.capabilities} />
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-md border border-amber-400/20 bg-amber-400/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Separation rules</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-50">
          {tenant.profile.separationRules.map((rule) => (
            <li key={rule}>- {rule}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-6 text-amber-50">{tenant.profile.publicCivicRecordPolicy}</p>
      </section>
    </GovCrmPageShell>
  );
}
