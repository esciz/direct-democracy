import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { reviewResidentStoryIntake } from "@/lib/cases/resident-intake-actions";
import {
  RESIDENT_QUESTION_PUBLIC_STATUSES,
  RESIDENT_QUESTION_RECIPIENT_TYPES,
  RESIDENT_QUESTION_ROUTING_STATUSES,
  residentQuestionPublicStatusLabel,
  residentQuestionRoutingStatusLabel,
  residentSubmissionTypeLabel,
} from "@/lib/cases/resident-intake";
import { getResidentStoryPublicRuntime, getResidentStoryReviewQueue } from "@/lib/cases/resident-intake-store";

export const dynamic = "force-dynamic";

type AdminResidentIntakePageProps = {
  searchParams?: Promise<{
    review?: string;
    error?: string;
  }>;
};

function badgeClass(kind: "pending" | "private" | "public" | "danger" | "neutral") {
  if (kind === "pending") return "border-amber-300/20 bg-amber-300/10 text-amber-100";
  if (kind === "private") return "border-sky-300/20 bg-sky-300/10 text-sky-100";
  if (kind === "public") return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  if (kind === "danger") return "border-rose-300/20 bg-rose-300/10 text-rose-100";
  return "border-white/10 bg-white/5 text-slate-300";
}

function reviewKind(status: string) {
  if (status === "pending_review") return "pending";
  if (status === "reviewed_private") return "private";
  if (status.includes("approved")) return "public";
  if (status === "rejected") return "danger";
  return "neutral";
}

function routingKind(status: string) {
  if (status === "pending" || status === "needs_source") return "pending";
  if (status === "ready_to_send" || status === "sent_externally") return "private";
  if (status === "answered" || status === "closed") return "public";
  return "neutral";
}

function formatDate(value: string | null) {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export default async function AdminResidentIntakePage({ searchParams }: AdminResidentIntakePageProps) {
  const [params, queue, publicRuntime] = await Promise.all([
    searchParams ? searchParams : Promise.resolve(undefined),
    getResidentStoryReviewQueue(),
    getResidentStoryPublicRuntime(),
  ]);
  const pending = queue.records.filter((record) => record.review.status === "pending_review");
  const pendingRouting = queue.records.filter((record) => record.routing.status === "pending" || record.routing.status === "needs_source");
  const readyToSend = queue.records.filter((record) => record.routing.status === "ready_to_send");
  const answered = queue.records.filter((record) => record.routing.status === "answered" || record.routing.publicStatus === "answer_published");
  const sensitive = queue.records.filter(
    (record) => record.safety.containsPersonalData || record.safety.involvesMinor || record.safety.involvesLegalMatter || record.safety.containsAllegation,
  );

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Resident intake"
        title="Resident story review queue"
        description="Review resident-submitted stories without turning private, unverified claims into public civic truth. Publish only redacted summaries after moderation."
        actions={
          <>
            <Link href="/cases/submit" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
              Submission form
            </Link>
            <Link href="/admin/cases" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
              Public case review
            </Link>
          </>
        }
      />

      {params?.review === "saved" ? (
        <section className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Review saved and public runtime regenerated.</section>
      ) : null}
      {params?.review === "routing-saved" ? (
        <section className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Routing workflow saved. Nothing was emailed or published automatically.</section>
      ) : null}
      {params?.error ? (
        <section className="rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">Review could not be saved: {params.error}</section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Private queue</p>
          <p className="mt-3 text-3xl font-semibold text-white">{queue.records.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">Pending review</p>
          <p className="mt-3 text-3xl font-semibold text-white">{pending.length}</p>
        </div>
        <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-100">Sensitive flags</p>
          <p className="mt-3 text-3xl font-semibold text-white">{sensitive.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Public summaries</p>
          <p className="mt-3 text-3xl font-semibold text-white">{publicRuntime.totals.reviewedPublicSummaries}</p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">Needs routing work</p>
          <p className="mt-3 text-3xl font-semibold text-white">{pendingRouting.length}</p>
        </div>
        <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">Ready to send</p>
          <p className="mt-3 text-3xl font-semibold text-white">{readyToSend.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Answered or closed</p>
          <p className="mt-3 text-3xl font-semibold text-white">{answered.length}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5 text-sm leading-6 text-cyan-50">
        Raw resident stories stay in the private queue. Public pages may only receive a reviewed summary, review timestamp, submission category, non-sensitive location/time context, and source status.
      </section>

      <section className="space-y-4">
        {queue.records.length ? null : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm leading-6 text-slate-300">
            No resident story submissions are waiting for review.
          </div>
        )}
        {queue.records.map((record) => (
          <article key={record.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClass(reviewKind(record.review.status))}`}>
                {record.review.status.replace(/_/g, " ")}
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {residentSubmissionTypeLabel(record.submissionType)}
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {record.publicationPreference.replace(/_/g, " ")}
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                {record.verificationStatus.replace(/_/g, " ")}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badgeClass(routingKind(record.routing.status))}`}>
                Routing: {residentQuestionRoutingStatusLabel(record.routing.status)}
              </span>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                Public: {residentQuestionPublicStatusLabel(record.routing.publicStatus)}
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Location:</span> {record.location ?? "Not provided"}
              </p>
              <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Approximate date:</span> {record.approximateDate ?? "Not provided"}
              </p>
              <p className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300">
                <span className="font-semibold text-slate-100">Submitted:</span> {formatDate(record.createdAt)}
              </p>
            </div>

            <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
              <summary className="cursor-pointer font-semibold text-slate-100">Private raw story</summary>
              <p className="mt-2 whitespace-pre-wrap leading-6">{record.story}</p>
            </details>

            <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4 text-sm leading-6 text-cyan-50">
              <div className="grid gap-3 md:grid-cols-3">
                <p>
                  <span className="font-semibold">Target:</span> {record.routing.targetType.replace(/_/g, " ")}
                  {record.routing.targetId ? ` (${record.routing.targetId})` : ""}
                </p>
                <p>
                  <span className="font-semibold">Topic:</span> {record.routing.topic ?? "Reviewer should classify"}
                </p>
                <p>
                  <span className="font-semibold">Community:</span> {record.routing.community ?? record.location ?? "Not provided"}
                </p>
              </div>
              <p className="mt-2">
                <span className="font-semibold">Suggested recipient:</span> {record.routing.suggestedRecipientName ?? "Not yet routed"}{" "}
                <span className="text-cyan-100/70">({record.routing.suggestedRecipientType.replace(/_/g, " ")})</span>
              </p>
              <p className="mt-2 text-cyan-100/80">{record.routing.routingReason}</p>
              {record.routing.answerSummary ? <p className="mt-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-emerald-50">Answer summary: {record.routing.answerSummary}</p> : null}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-4">
              {[
                ["Personal data", record.safety.containsPersonalData],
                ["Allegation", record.safety.containsAllegation],
                ["Minor", record.safety.involvesMinor],
                ["Legal matter", record.safety.involvesLegalMatter],
              ].map(([label, active]) => (
                <span
                  key={String(label)}
                  className={`rounded-xl border p-3 text-xs font-semibold ${active ? "border-rose-300/20 bg-rose-300/10 text-rose-100" : "border-white/10 bg-black/15 text-slate-400"}`}
                >
                  {label}: {active ? "yes" : "no"}
                </span>
              ))}
            </div>

            {record.peopleOrEntitiesInvolved.length || record.links.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300">
                  <p className="font-semibold text-slate-100">People/entities</p>
                  <p className="mt-2">{record.peopleOrEntitiesInvolved.join(", ") || "None provided"}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-slate-300">
                  <p className="font-semibold text-slate-100">Source links</p>
                  <div className="mt-2 space-y-1">
                    {record.links.length ? record.links.map((link) => (
                      <Link key={link} href={link} target="_blank" rel="noreferrer" className="block text-cyan-200 hover:text-cyan-100">
                        {link}
                      </Link>
                    )) : "None provided"}
                  </div>
                </div>
              </div>
            ) : null}

            <form action={reviewResidentStoryIntake} className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4">
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="decision" value="update_routing" />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-cyan-50">
                  Workflow status
                  <select
                    name="routingStatus"
                    defaultValue={record.routing.status}
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal text-slate-100 outline-none"
                  >
                    {RESIDENT_QUESTION_ROUTING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {residentQuestionRoutingStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-cyan-50">
                  Public-safe status
                  <select
                    name="routingPublicStatus"
                    defaultValue={record.routing.publicStatus}
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal text-slate-100 outline-none"
                  >
                    {RESIDENT_QUESTION_PUBLIC_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {residentQuestionPublicStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-semibold text-cyan-50">
                  Recipient/body
                  <input
                    name="routingRecipientName"
                    defaultValue={record.routing.suggestedRecipientName ?? ""}
                    placeholder="Carson City Board of Supervisors"
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-cyan-50">
                  Recipient type
                  <select
                    name="routingRecipientType"
                    defaultValue={record.routing.suggestedRecipientType}
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal text-slate-100 outline-none"
                  >
                    {RESIDENT_QUESTION_RECIPIENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-cyan-50">
                  Recipient/source URL
                  <input
                    name="routingRecipientSourceUrl"
                    defaultValue={record.routing.suggestedRecipientSourceUrl ?? ""}
                    placeholder="Official contact or agenda source URL"
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-cyan-50">
                  Routing note
                  <textarea
                    name="routingReviewerNotes"
                    rows={3}
                    defaultValue={record.routing.reviewerNotes ?? ""}
                    placeholder="Internal routing note. Not public."
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal leading-6 text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-cyan-50">
                  Reviewed answer summary
                  <textarea
                    name="routingAnswerSummary"
                    rows={3}
                    defaultValue={record.routing.answerSummary ?? ""}
                    placeholder="Only after a reviewed answer exists. Do not paste private contact details."
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal leading-6 text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </label>
              </div>
              <button className="mt-4 rounded-full border border-cyan-300/25 bg-cyan-300/15 px-4 py-2 text-xs font-semibold text-cyan-50">
                Save routing workflow
              </button>
            </form>

            <form action={reviewResidentStoryIntake} className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <input type="hidden" name="id" value={record.id} />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Public title, only if publishing
                  <input
                    name="publicTitle"
                    placeholder="Reviewed resident concern about..."
                    className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-normal text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  Reviewer note
                  <input
                    name="reviewerNotes"
                    placeholder="Internal note. Not public."
                    className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-normal text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </label>
              </div>
              <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-200">
                Public summary, only if publishing
                <textarea
                  name="publicSummary"
                  rows={3}
                  placeholder="Redacted, plain-language summary. Do not include private names, contact details, or unverified allegations as fact."
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-normal leading-6 text-slate-100 outline-none placeholder:text-slate-500"
                />
              </label>
              <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-200">
                Rejection reason, only if rejecting
                <input
                  name="rejectionReason"
                  placeholder="Required for a useful rejection."
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-normal text-slate-100 outline-none placeholder:text-slate-500"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button name="decision" value="keep_private" className="rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-semibold text-sky-100">
                  Mark reviewed private
                </button>
                <button name="decision" value="approve_public" className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-semibold text-emerald-100">
                  Publish reviewed summary
                </button>
                <button name="decision" value="approve_anonymous" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-100">
                  Publish anonymous summary
                </button>
                <button name="decision" value="reject" className="rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-xs font-semibold text-rose-100">
                  Reject
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
