import Link from "next/link";

import { CampaignFinanceSummaryCard } from "@/components/domain/campaign-finance/campaign-finance-summary-card";
import type { OfficialSourceDocumentsCardData } from "@/lib/nv-sos/public";

function formatDate(value: string | null) {
  if (!value) return "Update pending";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function OfficialSourceDocumentsCard({ data }: { data: OfficialSourceDocumentsCardData }) {
  const hasOfficialRecords = data.candidateRecords.length || data.documents.length;

  return (
    <section className="dd-panel-muted rounded-[1.75rem] p-6 sm:p-8">
      <CampaignFinanceSummaryCard dashboard={data.campaignFinanceDashboard} />

      {hasOfficialRecords ? (
        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Official source documents</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-50">Candidate filing and detail records</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-300">
              Last successfully fetched {formatDate(data.campaignFinanceSummary.lastFetchedAt ?? data.lastFetchedAt)}
            </span>
          </div>

          {data.candidateRecords.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {data.candidateRecords.map((record) => (
                <article key={`${record.source_id}-${record.cached_path}`} className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{record.candidate_name ?? "Candidate detail"}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {record.office ?? "Office pending"} · {record.party ?? "Party pending"}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                      {Math.round(record.parse_confidence * 100)}%
                    </span>
                  </div>
                  <Link href={record.source_url} className="mt-3 inline-flex break-all text-xs font-semibold text-cyan-200 hover:text-cyan-100">
                    Open candidate source
                  </Link>
                </article>
              ))}
            </div>
          ) : null}

          {data.documents.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.documents.map((document) => (
                <Link key={`${document.source_id}-${document.source_url}`} href={document.source_url} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-100 hover:border-cyan-300/30">
                  {document.filing_report_type ?? document.source_type.replaceAll("_", " ")}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
