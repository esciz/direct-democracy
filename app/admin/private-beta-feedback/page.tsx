import Link from "next/link";

import { updatePrivateBetaFeedbackAction } from "@/app/admin/private-beta-feedback/actions";
import { PageIntro } from "@/components/ui/page-intro";
import { PRIVATE_BETA_FEEDBACK_STATUSES, getPrivateBetaFeedbackSummary, listPrivateBetaFeedback } from "@/lib/private-beta/feedback";

type AdminPrivateBetaFeedbackPageProps = {
  searchParams?: Promise<{ feedback?: string; status?: string }>;
};

function toneForSeverity(severity: string) {
  if (severity === "blocking") return "border-rose-300/20 bg-rose-500/10 text-rose-200";
  if (severity === "high") return "border-amber-300/20 bg-amber-500/10 text-amber-200";
  if (severity === "medium") return "border-cyan-300/20 bg-cyan-500/10 text-cyan-200";
  return "border-white/10 bg-white/5 text-slate-300";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

export default async function AdminPrivateBetaFeedbackPage({ searchParams }: AdminPrivateBetaFeedbackPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const summary = getPrivateBetaFeedbackSummary();
  const records = listPrivateBetaFeedback();
  const visibleRecords = params?.status && params.status !== "all" ? records.filter((record) => record.status === params.status) : records;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Admin"
        title="Private beta feedback"
        description="Review tester reports from the private-link beta. These records stay in the private local queue and should not be published without review."
        meta={
          <>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
              {summary.open} open
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
              {summary.needsFollowUp} follow-up
            </span>
            <span className="rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-200">
              {summary.containsPersonalData} personal-data flags
            </span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/private-beta" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100">
              Launch control
            </Link>
            <Link href="/admin/operations" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/30 hover:text-cyan-100">
              Operations
            </Link>
          </div>
        }
      />

      {params?.feedback === "updated" ? (
        <section className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Feedback review status updated.
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-5">
        {PRIVATE_BETA_FEEDBACK_STATUSES.map((status) => (
          <Link
            key={status.value}
            href={`/admin/private-beta-feedback?status=${status.value}`}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/30"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{status.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">{summary.byStatus[status.value]}</p>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        {visibleRecords.length ? (
          visibleRecords.map((record) => (
            <article key={record.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${toneForSeverity(record.severity)}`}>
                  {record.severity}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                  {record.category.replaceAll("_", " ")}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                  {record.status.replaceAll("_", " ")}
                </span>
                {record.containsPersonalData ? (
                  <span className="rounded-full border border-rose-300/20 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-200">
                    personal data
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{formatDate(record.submittedAt)} · {record.submittedByName}</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-50">{record.summary}</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{record.details}</p>
                  {record.pageUrl ? <p className="mt-3 text-sm text-cyan-200">Page: {record.pageUrl}</p> : null}
                  {record.expectedBehavior ? <p className="mt-3 text-sm text-slate-400"><span className="font-semibold text-slate-200">Expected:</span> {record.expectedBehavior}</p> : null}
                  {record.actualBehavior ? <p className="mt-2 text-sm text-slate-400"><span className="font-semibold text-slate-200">Actual:</span> {record.actualBehavior}</p> : null}
                  {record.contactOk ? <p className="mt-3 text-sm text-amber-100">Follow-up allowed{record.contactEmail ? `: ${record.contactEmail}` : ""}</p> : null}
                </div>
                <form action={updatePrivateBetaFeedbackAction} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <input type="hidden" name="feedbackId" value={record.id} />
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Review status</span>
                    <select name="status" defaultValue={record.status} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100">
                      {PRIVATE_BETA_FEEDBACK_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-3 grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Reviewer notes</span>
                    <textarea name="reviewerNotes" defaultValue={record.reviewerNotes ?? ""} rows={4} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100" />
                  </label>
                  <label className="mt-3 grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Public resolved note</span>
                    <textarea
                      name="publicReleaseNote"
                      defaultValue={record.publicReleaseNote ?? ""}
                      rows={3}
                      placeholder="Optional safe summary shown to testers after resolving."
                      className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                    />
                  </label>
                  <p className="mt-2 text-xs leading-5 text-slate-500">Only resolved items with this field filled appear in tester-facing updates.</p>
                  <button className="mt-3 rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Save review</button>
                </form>
              </div>
            </article>
          ))
        ) : (
          <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
            No private beta feedback records match this filter yet.
          </section>
        )}
      </section>
    </div>
  );
}
