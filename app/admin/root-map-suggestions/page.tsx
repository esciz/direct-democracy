import Link from "next/link";

import { reviewRootMapSuggestionAction } from "@/app/admin/root-map-suggestions/actions";
import { PageIntro } from "@/components/ui/page-intro";
import { requireAdminPage } from "@/lib/admin/permissions";
import { listRootMapSuggestions, type RootMapSuggestionStatus } from "@/lib/root-map/suggestions";

type AdminRootMapSuggestionsPageProps = {
  searchParams?: Promise<{ review?: string; status?: string }>;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

function normalizeStatus(value: string | undefined): RootMapSuggestionStatus | undefined {
  return value === "pending" || value === "approved" || value === "rejected" ? value : undefined;
}

export default async function AdminRootMapSuggestionsPage({ searchParams }: AdminRootMapSuggestionsPageProps) {
  await requireAdminPage("review.view");
  const params = searchParams ? await searchParams : undefined;
  const activeStatus = normalizeStatus(params?.status);
  const [records, allRecords] = await Promise.all([
    listRootMapSuggestions(activeStatus),
    activeStatus ? listRootMapSuggestions() : Promise.resolve(null),
  ]);
  const summaryRecords = allRecords ?? records;
  const counts = {
    pending: summaryRecords.filter((record) => record.status === "pending").length,
    approved: summaryRecords.filter((record) => record.status === "approved").length,
    rejected: summaryRecords.filter((record) => record.status === "rejected").length,
  };

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin review"
        title="Root-map suggestions"
        description="Review proposed issues, relationships, corrections, and supporting sources. Nothing appears on the public map until an administrator approves it."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/root-striker-lab" className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">Open map</Link>
            <Link href="/admin/operations" className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">Operations</Link>
          </div>
        }
      />

      {params?.review === "updated" ? (
        <section className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Suggestion review saved and the approved map layer refreshed.</section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {(["pending", "approved", "rejected"] as const).map((status) => (
          <Link key={status} href={`/admin/root-map-suggestions?status=${status}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/30">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{status}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-50">{counts[status]}</p>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        {records.length ? records.map((record) => (
          <article key={record.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-cyan-200">{record.type.replaceAll("_", " ")}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">{record.status}</span>
              <span className="text-slate-500">{formatDate(record.submittedAt)} · {record.submittedByName}</span>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div>
                <h2 className="text-xl font-semibold text-slate-50">{record.title}</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{record.explanation}</p>
                {record.fromNodeId ? <p className="mt-3 text-xs text-slate-400">From: <span className="font-mono text-cyan-200">{record.fromNodeId}</span>{record.toNodeId ? <> → <span className="font-mono text-cyan-200">{record.toNodeId}</span></> : null}</p> : null}
                {record.proposedRelationship ? <p className="mt-2 text-sm text-amber-100">Proposed relationship: {record.proposedRelationship}</p> : null}
                {record.sourceUrls.length ? (
                  <div className="mt-4 space-y-1">
                    {record.sourceUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block break-all text-xs text-cyan-200 hover:text-cyan-100">{url}</a>)}
                  </div>
                ) : <p className="mt-4 text-xs text-amber-200">No supporting sources supplied.</p>}
              </div>
              <form action={reviewRootMapSuggestionAction} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <input type="hidden" name="suggestionId" value={record.id} />
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Decision</span>
                  <select name="status" defaultValue={record.status === "pending" ? "approved" : record.status} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                    <option value="approved">Approve for map</option>
                    <option value="rejected">Reject</option>
                  </select>
                </label>
                <label className="mt-3 grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Reviewer notes</span>
                  <textarea name="reviewerNotes" defaultValue={record.reviewerNotes ?? ""} rows={5} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                </label>
                <button className="mt-3 rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Save decision</button>
              </form>
            </div>
          </article>
        )) : (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">No root-map suggestions match this filter.</div>
        )}
      </section>
    </div>
  );
}
