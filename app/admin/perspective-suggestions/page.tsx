import Link from "next/link";

import { reviewPerspectiveSuggestionAction } from "@/app/admin/perspective-suggestions/actions";
import { PageIntro } from "@/components/ui/page-intro";
import { requireAdminPage } from "@/lib/admin/permissions";
import { listPerspectiveSuggestions, type PerspectiveSuggestionStatus } from "@/lib/perspectives/suggestions";

type AdminPerspectiveSuggestionsPageProps = {
  searchParams?: Promise<{ review?: string; status?: string }>;
};

function normalizeStatus(value: string | undefined): PerspectiveSuggestionStatus | undefined {
  return value === "pending" || value === "approved" || value === "rejected" ? value : undefined;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

export default async function AdminPerspectiveSuggestionsPage({ searchParams }: AdminPerspectiveSuggestionsPageProps) {
  await requireAdminPage("review.view");
  const params = searchParams ? await searchParams : undefined;
  const activeStatus = normalizeStatus(params?.status);
  const [records, allRecords] = await Promise.all([
    listPerspectiveSuggestions(activeStatus),
    activeStatus ? listPerspectiveSuggestions() : Promise.resolve(null),
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
        title="Perspective suggestions"
        description="Review the framing, steelman both sides, supporting sources, and potential harm. Approval is required even for trusted-citizen submissions."
        actions={<Link href="/challenge-my-view" className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">Open perspective lab</Link>}
      />

      {params?.review === "updated" ? <section className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Review saved. Approved perspectives are now available in the explorer.</section> : null}
      {params?.review === "error" ? <section className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">The review could not be saved.</section> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {(["pending", "approved", "rejected"] as const).map((status) => (
          <Link key={status} href={`/admin/perspective-suggestions?status=${status}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/30">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{status}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-50">{counts[status]}</p>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        {records.length ? records.map((record) => (
          <article key={record.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
              <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2.5 py-1 text-violet-200">{record.category}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">{record.status}</span>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-cyan-200">{record.submittedByRole.replaceAll("Citizen", " citizen")}</span>
              <span className="text-slate-500">{formatDate(record.submittedAt)} · {record.submittedByName}</span>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Statement</p><h2 className="mt-1 text-xl font-semibold text-slate-50">{record.statement}</h2></div>
                <p className="text-sm leading-6 text-slate-300">{record.context}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.05] p-4"><p className="text-xs font-semibold text-emerald-200">Case for</p><p className="mt-2 text-sm leading-6 text-slate-300">{record.caseFor}</p></div>
                  <div className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.05] p-4"><p className="text-xs font-semibold text-violet-200">Strongest challenge</p><p className="mt-2 text-sm leading-6 text-slate-300">{record.caseAgainst}</p></div>
                </div>
                {[
                  ["Shared ground", record.sharedGround],
                  ["Evidence to test", record.evidenceToTest],
                  ["Affected people", record.affectedPeople],
                  ["Policy paths", record.policyPaths],
                ].map(([label, items]) => (
                  <div key={label as string}><p className="text-xs font-semibold text-cyan-200">{label as string}</p><p className="mt-1 text-sm text-slate-400">{(items as string[]).join(" · ")}</p></div>
                ))}
                <div>{record.sourceUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block break-all text-xs text-cyan-200 hover:text-cyan-100">{url}</a>)}</div>
              </div>
              <form action={reviewPerspectiveSuggestionAction} className="h-fit rounded-2xl border border-white/10 bg-black/20 p-4">
                <input type="hidden" name="suggestionId" value={record.id} />
                <label className="grid gap-2"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Decision</span><select name="status" defaultValue={record.status === "pending" ? "approved" : record.status} className="dd-input rounded-xl px-3 py-2 text-sm"><option value="approved">Approve for explorer</option><option value="rejected">Reject</option></select></label>
                <label className="mt-3 grid gap-2"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Reviewer notes</span><textarea name="reviewerNotes" defaultValue={record.reviewerNotes ?? ""} rows={6} className="dd-input rounded-xl px-3 py-2 text-sm" placeholder="Check fair framing, credible sourcing, and whether the statement targets a policy rather than a group." /></label>
                <button className="dd-button-primary mt-3 rounded-full px-4 py-2 text-sm font-semibold">Save decision</button>
              </form>
            </div>
          </article>
        )) : <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">No perspective suggestions match this filter.</div>}
      </section>
    </div>
  );
}
