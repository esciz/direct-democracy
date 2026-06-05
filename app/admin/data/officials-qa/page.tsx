import Link from "next/link";
import { redirect } from "next/navigation";

import { PageIntro } from "@/components/ui/page-intro";
import {
  OFFICIALS_QA_FLAG_LABELS,
  OFFICIALS_QA_GROUPS,
  getOfficialsQaRows,
  summarizeOfficialsQa,
  type OfficialQaFlagKey,
} from "@/lib/civic-data/officials-qa";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

type OfficialsQaPageProps = {
  searchParams?: Promise<{
    group?: string;
    missing?: OfficialQaFlagKey;
    sourceWarnings?: string;
    duplicates?: string;
  }>;
};

const missingFilters: OfficialQaFlagKey[] = [
  "missing_photo",
  "missing_email",
  "missing_phone",
  "missing_website",
  "missing_district",
  "missing_term_start",
  "missing_term_end",
];

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(value) : "Missing";
}

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  return searchParams.toString();
}

export default async function OfficialsQaPage({ searchParams }: OfficialsQaPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : {};

  if (user.role !== "admin") {
    redirect("/profile");
  }

  const filters = {
    group: params.group && OFFICIALS_QA_GROUPS.includes(params.group) ? params.group : undefined,
    missing: params.missing && missingFilters.includes(params.missing) ? params.missing : undefined,
    sourceWarnings: params.sourceWarnings === "1",
    duplicates: params.duplicates === "1",
  };
  const rows = await getOfficialsQaRows(filters);
  const summary = summarizeOfficialsQa(rows);
  const exportHref = `/admin/data/officials-qa/export?${buildQuery({
    group: filters.group,
    missing: filters.missing,
    sourceWarnings: filters.sourceWarnings ? "1" : undefined,
    duplicates: filters.duplicates ? "1" : undefined,
  })}`;
  const groupedRows = OFFICIALS_QA_GROUPS.map((group) => ({
    group,
    rows: rows.filter((row) => row.group === group),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Officials QA"
        description="Review imported Nevada officials for completeness, duplicate risks, source warnings, and display readiness."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={exportHref} className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Export CSV
            </Link>
            <Link href="/admin/data" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Dashboard
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Clean Records</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{summary.cleanRecords}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Records With Warnings</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{summary.warningRecords}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Displayed Records</p>
          <p className="mt-3 text-3xl font-semibold text-slate-50">{summary.totalRecords}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto_auto]" action="/admin/data/officials-qa">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Jurisdiction Group</span>
            <select name="group" defaultValue={filters.group ?? ""} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100">
              <option value="">All groups</option>
              {OFFICIALS_QA_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Missing Fields</span>
            <select name="missing" defaultValue={filters.missing ?? ""} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100">
              <option value="">Any completeness state</option>
              {missingFilters.map((flag) => (
                <option key={flag} value={flag}>
                  {OFFICIALS_QA_FLAG_LABELS[flag]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">
            <input type="checkbox" name="sourceWarnings" value="1" defaultChecked={filters.sourceWarnings} />
            Source warnings
          </label>
          <label className="flex items-center gap-2 self-end rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200">
            <input type="checkbox" name="duplicates" value="1" defaultChecked={filters.duplicates} />
            Duplicates
          </label>
          <button type="submit" className="dd-button-primary self-end rounded-full px-4 py-2.5 text-sm font-semibold">
            Apply
          </button>
        </form>
      </section>

      {summary.missingFieldCounts.length > 0 || summary.sourceProblems.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-semibold text-slate-50">Most Common Missing Fields</h2>
            <div className="mt-4 space-y-2">
              {summary.missingFieldCounts.slice(0, 6).map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-semibold text-slate-50">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="font-semibold text-slate-50">Source-Specific Problems</h2>
            <div className="mt-4 space-y-2">
              {summary.sourceProblems.length > 0 ? (
                summary.sourceProblems.map((problem) => (
                  <details key={problem.sourceName} className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-semibold text-slate-100">
                      {problem.sourceName} · {problem.count}
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-amber-100">{problem.message}</pre>
                  </details>
                ))
              ) : (
                <p className="text-sm text-slate-400">No source warnings in the current filter.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        {groupedRows.map(({ group, rows: groupRows }) => (
          <div key={group} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <h2 className="font-semibold text-slate-50">{group}</h2>
              <span className="text-sm text-slate-400">{groupRows.length} officials</span>
            </div>
            <div className="divide-y divide-white/10">
              {groupRows.map((row) => (
                <article key={row.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1.1fr_1.2fr_1fr]">
                  <div>
                    <div className="flex items-start gap-3">
                      {row.photoUrl ? (
                        <img src={row.photoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-300">
                          {row.fullName
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-slate-50">{row.fullName}</h3>
                        <p className="mt-1 text-sm text-slate-300">{row.officeTitle}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.partyText ?? "No party recorded"}</p>
                      </div>
                    </div>
                  </div>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Jurisdiction</dt>
                      <dd className="text-slate-200">{row.jurisdictionName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">District</dt>
                      <dd className="text-slate-200">{row.districtName ?? "Missing"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Term Start</dt>
                      <dd className="text-slate-200">{formatDate(row.termStart)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Term End</dt>
                      <dd className="text-slate-200">{formatDate(row.termEnd)}</dd>
                    </div>
                  </dl>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {row.websiteUrl ? (
                        <a href={row.websiteUrl} target="_blank" rel="noreferrer" className="dd-button-secondary rounded-full px-3 py-2 text-xs font-semibold">
                          Website
                        </a>
                      ) : null}
                      {row.email ? <span className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">{row.email}</span> : null}
                      {row.phone ? <span className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">{row.phone}</span> : null}
                    </div>
                    <p className="text-xs leading-5 text-slate-400">
                      Source:{" "}
                      {row.sourceUrl ? (
                        <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-200">
                          {row.sourceName}
                        </a>
                      ) : (
                        row.sourceName ?? "Missing source"
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {row.flags.length > 0 ? (
                        row.flags.map((flag) => (
                          <span key={flag} className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                            {OFFICIALS_QA_FLAG_LABELS[flag]}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">
                          Clean
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

