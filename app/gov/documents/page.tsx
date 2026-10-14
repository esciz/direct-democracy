import Link from "next/link";

import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getGovCrmOperationsDashboard } from "@/lib/govcrm/operations-dashboard";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number | undefined) {
  return numberFormatter.format(value ?? 0);
}

function formatLabel(value: string | undefined) {
  return value?.replaceAll("_", " ") ?? "Pending";
}

export default async function GovDocumentsPage() {
  await requireGovCrmAccess();
  const dashboard = await getGovCrmOperationsDashboard();

  return (
    <GovCrmPageShell
      title="Document acquisition"
      description="Read-only evidence operations for discovered public records, retrieval status, cache coverage, extraction quality, and OCR readiness."
    >
      <div className="flex flex-wrap gap-2">
        <Link href="/gov/documents/upload" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
          Upload
        </Link>
        <Link href="/gov/documents/review" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
          Review queue
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Discovered", dashboard.summary.documents, "All known source documents"],
          ["Remote queued", dashboard.summary.queued, "Needs retrieval/cache work"],
          ["Cached locally", dashboard.summary.localCached, "Available for extraction"],
          ["Text extracted", dashboard.summary.extracted, "Native text or processed output"],
        ].map(([label, value, detail]) => (
          <article key={label} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatNumber(Number(value))}</p>
            <p className="mt-2 text-sm text-slate-400">{detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Queue</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Documents needing acquisition</h2>
          </div>
          <p className="text-sm text-slate-400">No successful retrieval is faked.</p>
        </div>
        <ul className="mt-5 space-y-3">
          {dashboard.queues.retrieval.length ? (
            dashboard.queues.retrieval.map((record) => (
              <li key={record.id ?? record.documentId} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{formatLabel(record.documentType)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {record.jurisdiction ?? "Jurisdiction pending"} · {record.sourceHost ?? "Host pending"} · {formatLabel(record.retrievalStatus)}
                    </p>
                  </div>
                  <span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
                    {formatLabel(record.recommendedNextAction)}
                  </span>
                </div>
                <p className="mt-3 break-all text-xs leading-5 text-slate-400">{record.sourceUrl ?? "Source URL pending"}</p>
              </li>
            ))
          ) : (
            <li className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No retrieval queue generated.</li>
          )}
        </ul>
      </section>
    </GovCrmPageShell>
  );
}
