import Link from "next/link";
import type { ReactNode } from "react";

import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import {
  filterGovCases,
  getGovCaseFilterOptions,
  getGovCases,
  GOV_CASE_PRIORITY_LABELS,
  GOV_CASE_SOURCE_LABELS,
  GOV_CASE_STATUS_LABELS,
  GOV_CASE_VISIBILITY_LABELS,
  isGovCaseOverdue,
  type GovCase,
  type GovCaseFilters,
  type GovCasePriority,
  type GovCaseSource,
  type GovCaseStatus,
} from "@/lib/govcrm/cases";

export const dynamic = "force-dynamic";

type GovCasesPageProps = {
  searchParams?: Promise<{
    status?: string;
    priority?: string;
    department?: string;
    assignee?: string;
    source?: string;
    overdue?: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function asGovCaseFilters(params: Awaited<NonNullable<GovCasesPageProps["searchParams"]>> | undefined): GovCaseFilters {
  return {
    status: params?.status && params.status in GOV_CASE_STATUS_LABELS ? (params.status as GovCaseStatus) : undefined,
    priority: params?.priority && params.priority in GOV_CASE_PRIORITY_LABELS ? (params.priority as GovCasePriority) : undefined,
    department: params?.department || undefined,
    assignee: params?.assignee || undefined,
    source: params?.source && params.source in GOV_CASE_SOURCE_LABELS ? (params.source as GovCaseSource) : undefined,
    overdue: params?.overdue === "true" ? "true" : undefined,
  };
}

function CaseStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
    </article>
  );
}

function SelectField({ label, name, defaultValue, children }: { label: string; name: string; defaultValue?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-200">
      {label}
      <select name={name} defaultValue={defaultValue ?? ""} className="min-h-11 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/50">
        <option value="">Any</option>
        {children}
      </select>
    </label>
  );
}

function CaseInboxCard({ caseItem }: { caseItem: GovCase }) {
  const overdue = isGovCaseOverdue(caseItem);

  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/30 hover:bg-white/[0.06]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-100">
              Internal/private
            </span>
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">
              {GOV_CASE_STATUS_LABELS[caseItem.status]}
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
              {GOV_CASE_PRIORITY_LABELS[caseItem.priority]}
            </span>
            {overdue ? (
              <span className="rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-100">
                Overdue
              </span>
            ) : null}
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-white">
            <Link href={`/gov/cases/${caseItem.id}`} className="hover:text-cyan-100">
              {caseItem.title}
            </Link>
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{caseItem.summary}</p>
        </div>
        <Link href={`/gov/cases/${caseItem.id}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/15">
          Open workbench
        </Link>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Department</p>
          <p className="mt-1">{caseItem.assignment.department}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Assignee</p>
          <p className="mt-1">{caseItem.assignment.assigneeName ?? "Unassigned"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Source</p>
          <p className="mt-1">{GOV_CASE_SOURCE_LABELS[caseItem.source]}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Due</p>
          <p className="mt-1">{formatDate(caseItem.assignment.dueAt)}</p>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-xs leading-5 text-slate-400">
        Visibility: {GOV_CASE_VISIBILITY_LABELS[caseItem.visibility]}. Publishing, email sending, and public status syncing are disabled.
      </div>
    </article>
  );
}

export default async function GovCasesPage({ searchParams }: GovCasesPageProps) {
  await requireGovCrmAccess();

  const [cases, params] = await Promise.all([Promise.resolve(getGovCases()), searchParams ?? Promise.resolve(undefined)]);
  const filters = asGovCaseFilters(params);
  const filteredCases = filterGovCases(cases, filters);
  const filterOptions = getGovCaseFilterOptions(cases);
  const overdueCount = cases.filter((caseItem) => isGovCaseOverdue(caseItem)).length;
  const unassignedCount = cases.filter((caseItem) => !caseItem.assignment.assigneeName).length;

  return (
    <GovCrmPageShell
      title="Constituent cases"
      description="Internal GovCRM case inbox for routing, assignment, notes, official response drafting, and read-only public Direct Democracy context."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CaseStat label="Internal cases" value={formatNumber(cases.length)} detail="Fixture-backed GovCRM tenant data" />
        <CaseStat label="Filtered" value={formatNumber(filteredCases.length)} detail="Matching current inbox filters" />
        <CaseStat label="Overdue" value={formatNumber(overdueCount)} detail="Open cases past due date" />
        <CaseStat label="Unassigned" value={formatNumber(unassignedCount)} detail="Needs routing owner" />
      </section>

      <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">Internal/private</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Case inbox filters</h2>
          </div>
          <Link href="/gov/cases" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
            Clear filters
          </Link>
        </div>
        <form className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <SelectField label="Status" name="status" defaultValue={filters.status}>
            {filterOptions.statuses.map((status) => (
              <option key={status} value={status}>
                {GOV_CASE_STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Priority" name="priority" defaultValue={filters.priority}>
            {filterOptions.priorities.map((priority) => (
              <option key={priority} value={priority}>
                {GOV_CASE_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Department" name="department" defaultValue={filters.department}>
            {filterOptions.departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </SelectField>
          <SelectField label="Assignee" name="assignee" defaultValue={filters.assignee}>
            <option value="unassigned">Unassigned</option>
            {filterOptions.assignees.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </SelectField>
          <SelectField label="Source" name="source" defaultValue={filters.source}>
            {filterOptions.sources.map((source) => (
              <option key={source} value={source}>
                {GOV_CASE_SOURCE_LABELS[source]}
              </option>
            ))}
          </SelectField>
          <div className="flex flex-col justify-end gap-3">
            <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-200">
              <input type="checkbox" name="overdue" value="true" defaultChecked={filters.overdue === "true"} className="h-4 w-4 accent-cyan-300" />
              Overdue only
            </label>
            <button type="submit" className="min-h-11 rounded-full bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200">
              Apply
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {filteredCases.length ? (
          filteredCases.map((caseItem) => <CaseInboxCard key={caseItem.id} caseItem={caseItem} />)
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
            No internal cases match these filters.
          </div>
        )}
      </section>
    </GovCrmPageShell>
  );
}
