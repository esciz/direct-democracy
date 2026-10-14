import Link from "next/link";

import { formatDateUtc } from "@/lib/dates";
import type { ApprovedOfficialGovernmentEnrichment, IncumbentOfficialMatch } from "@/lib/incumbents/official-bio-enrichment";

export function OfficialGovernmentSourceCard({
  enrichment,
  incumbentMatch,
  emptyTitle = "Official government source pending review",
}: {
  enrichment: ApprovedOfficialGovernmentEnrichment | null;
  incumbentMatch?: IncumbentOfficialMatch | null;
  emptyTitle?: string;
}) {
  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Official government source</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{enrichment?.shortBio ? "Official biography" : emptyTitle}</h2>
          {incumbentMatch ? (
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Current office: {incumbentMatch.officialOffice} · {incumbentMatch.officialJurisdiction}.
            </p>
          ) : null}
        </div>
        {incumbentMatch ? (
          <Link href={`/officials/${incumbentMatch.officialId}`} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            Open official profile
          </Link>
        ) : null}
      </div>

      {enrichment ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {enrichment.shortBio ? (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Official biography</p>
              <p className="mt-3 text-sm leading-7 text-slate-200">{enrichment.shortBio}</p>
            </div>
          ) : null}
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current office information</p>
            <p className="mt-3 text-sm font-semibold text-slate-100">{enrichment.officeTitle ?? incumbentMatch?.officialOffice ?? "Office title pending review"}</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">{enrichment.jurisdiction ?? incumbentMatch?.officialJurisdiction ?? "Jurisdiction pending review"}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Office responsibilities</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{enrichment.officeResponsibilities ?? "Office responsibilities pending source review."}</p>
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Public office contact</p>
            {enrichment.publicContactEmail ? <p className="mt-3 text-sm font-semibold text-slate-100">{enrichment.publicContactEmail}</p> : null}
            {enrichment.publicContactPhone ? <p className="mt-2 text-sm font-semibold text-slate-100">{enrichment.publicContactPhone}</p> : null}
            {!enrichment.publicContactEmail && !enrichment.publicContactPhone ? <p className="mt-3 text-sm leading-6 text-slate-400">Public office contact pending review.</p> : null}
          </div>
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Source attribution</p>
            <Link href={enrichment.sourceUrl} className="mt-3 block break-all text-sm font-semibold text-cyan-100 hover:text-cyan-50">
              {enrichment.sourceName}
            </Link>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {enrichment.lastEnrichedAt ? `Last checked ${formatDateUtc(enrichment.lastEnrichedAt, { month: "short", day: "numeric", year: "numeric" })}` : "Last checked pending"} · {enrichment.reviewStatus.toLowerCase()}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm leading-6 text-slate-400">
          Official government biography and office-page enrichment are not approved yet.
        </div>
      )}
    </section>
  );
}
