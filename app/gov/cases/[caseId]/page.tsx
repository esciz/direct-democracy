import Link from "next/link";
import { notFound } from "next/navigation";

import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import {
  getGovCase,
  GOV_CASE_PRIORITY_LABELS,
  GOV_CASE_SOURCE_LABELS,
  GOV_CASE_STATUS_LABELS,
  GOV_CASE_VISIBILITY_LABELS,
  isGovCaseOverdue,
  type GovCase,
} from "@/lib/govcrm/cases";

export const dynamic = "force-dynamic";

type GovCaseWorkbenchPageProps = {
  params: Promise<{
    caseId: string;
  }>;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function BoundaryBadge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "rose" | "cyan" | "emerald" | "amber" }) {
  const classes = {
    slate: "border-white/10 bg-white/5 text-slate-200",
    rose: "border-rose-300/20 bg-rose-400/10 text-rose-100",
    cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-100",
  };

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${classes[tone]}`}>{children}</span>;
}

function DetailCard({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SummaryGrid({ caseItem }: { caseItem: GovCase }) {
  const overdue = isGovCaseOverdue(caseItem);

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Status</p>
        <p className="mt-3 text-2xl font-semibold text-white">{GOV_CASE_STATUS_LABELS[caseItem.status]}</p>
        <p className="mt-2 text-sm text-slate-400">Internal workflow state only</p>
      </article>
      <article className="rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Priority</p>
        <p className="mt-3 text-2xl font-semibold text-white">{GOV_CASE_PRIORITY_LABELS[caseItem.priority]}</p>
        <p className="mt-2 text-sm text-slate-300">{overdue ? "Overdue" : `Due ${formatDateTime(caseItem.assignment.dueAt)}`}</p>
      </article>
      <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Source</p>
        <p className="mt-3 text-2xl font-semibold text-white">{GOV_CASE_SOURCE_LABELS[caseItem.source]}</p>
        <p className="mt-2 text-sm text-slate-400">No public status sync</p>
      </article>
      <article className="rounded-[1.25rem] border border-rose-300/20 bg-rose-400/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">Visibility</p>
        <p className="mt-3 text-2xl font-semibold text-white">{GOV_CASE_VISIBILITY_LABELS[caseItem.visibility]}</p>
        <p className="mt-2 text-sm text-slate-300">Publishing disabled</p>
      </article>
    </section>
  );
}

export default async function GovCaseWorkbenchPage({ params }: GovCaseWorkbenchPageProps) {
  await requireGovCrmAccess();

  const { caseId } = await params;
  const caseItem = getGovCase(caseId);
  if (!caseItem) notFound();

  return (
    <GovCrmPageShell
      title={caseItem.title}
      description={`${caseItem.publicTrackingCode} · ${caseItem.governmentEntityName} · internal GovCRM workbench for routing, notes, response drafting, and read-only public civic context.`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/gov/cases" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100">
          Back to cases
        </Link>
        <BoundaryBadge tone="rose">Internal/private</BoundaryBadge>
        <BoundaryBadge tone="amber">No publishing</BoundaryBadge>
        <BoundaryBadge tone="amber">No email sending</BoundaryBadge>
        <BoundaryBadge tone="amber">No status syncing</BoundaryBadge>
      </div>

      <SummaryGrid caseItem={caseItem} />

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <DetailCard title="Case summary" eyebrow="Internal/private">
          <div className="space-y-4 text-sm leading-6 text-slate-300">
            <p>{caseItem.summary}</p>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Intake summary</p>
              <p className="mt-2">{caseItem.intakeSummary}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Created</p>
                <p className="mt-1">{formatDateTime(caseItem.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Last activity</p>
                <p className="mt-1">{formatDateTime(caseItem.lastActivityAt)}</p>
              </div>
            </div>
          </div>
        </DetailCard>

        <DetailCard title="Resident/public-submitter info" eyebrow="Private submitter context">
          <dl className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Display name</dt>
              <dd className="mt-1">{caseItem.submitter.displayName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Contact</dt>
              <dd className="mt-1">{caseItem.submitter.contactLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Residency signal</dt>
              <dd className="mt-1">{formatLabel(caseItem.submitter.residencySignal)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Preferred contact</dt>
              <dd className="mt-1">{formatLabel(caseItem.submitter.preferredContactMethod)}</dd>
            </div>
          </dl>
          <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">
            This panel is internal GovCRM tenant data. It is not public profile data and is not joined into public civic records.
          </div>
        </DetailCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DetailCard title="Department routing" eyebrow="Internal/private">
          <dl className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Department</dt>
              <dd className="mt-1">{caseItem.assignment.department}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Team</dt>
              <dd className="mt-1">{caseItem.assignment.team}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Assignee</dt>
              <dd className="mt-1">{caseItem.assignment.assigneeName ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Due</dt>
              <dd className="mt-1">{formatDateTime(caseItem.assignment.dueAt)}</dd>
            </div>
          </dl>
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-4 text-sm text-slate-400">
            Routing controls are display-only. Assignment writes are not enabled yet.
          </div>
        </DetailCard>

        <DetailCard title="Public/official response area" eyebrow="Official response draft">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <BoundaryBadge tone="emerald">Official response</BoundaryBadge>
              <BoundaryBadge tone="amber">{formatLabel(caseItem.officialResponseStatus)}</BoundaryBadge>
            </div>
            <div className="min-h-32 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-300">
              {caseItem.officialResponseDraft || "No official response draft has been started."}
            </div>
            <p className="text-sm leading-6 text-slate-400">
              Publishing, email delivery, and public status synchronization are disabled. This area is a staff drafting surface only.
            </p>
          </div>
        </DetailCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DetailCard title="Internal notes" eyebrow="Internal/private">
          <ul className="space-y-3">
            {caseItem.notes.length ? (
              caseItem.notes.map((note) => (
                <li key={note.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-white">{note.authorName}</p>
                    <BoundaryBadge tone="rose">Internal/private</BoundaryBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{note.body}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatDateTime(note.createdAt)}</p>
                </li>
              ))
            ) : (
              <li className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No internal notes.</li>
            )}
          </ul>
        </DetailCard>

        <DetailCard title="Messages" eyebrow="Resident-visible and draft-only">
          <ul className="space-y-3">
            {caseItem.messages.length ? (
              caseItem.messages.map((message) => (
                <li key={message.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-white">{message.authorName}</p>
                    <BoundaryBadge tone={message.visibility === "resident_visible" ? "cyan" : "rose"}>{formatLabel(message.visibility)}</BoundaryBadge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{message.body}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDateTime(message.createdAt)} · Delivery: {formatLabel(message.deliveryStatus)}
                  </p>
                </li>
              ))
            ) : (
              <li className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No resident messages.</li>
            )}
          </ul>
        </DetailCard>
      </section>

      <DetailCard title="Linked public Direct Democracy records" eyebrow="Read-only public civic record">
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-100">
          These links provide public context only. GovCRM cannot revise public sentiment, votes, issues, meetings, petitions, officials, candidates, source attribution, or public case records.
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {caseItem.linkedPublicRecords.map((record) => (
            <li key={record.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex flex-wrap gap-2">
                <BoundaryBadge tone="cyan">Read-only public civic record</BoundaryBadge>
                <BoundaryBadge>{formatLabel(record.recordType)}</BoundaryBadge>
              </div>
              <Link href={record.href} className="mt-3 block font-semibold text-white transition hover:text-cyan-100">
                {record.label}
              </Link>
              <p className="mt-2 text-sm leading-6 text-slate-400">{record.sourceNote}</p>
            </li>
          ))}
        </ul>
      </DetailCard>

      <DetailCard title="Audit trail" eyebrow="Internal/private">
        <ul className="space-y-3">
          {caseItem.auditTrail.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-white">{formatLabel(entry.action)}</p>
                <p className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{entry.details}</p>
              <p className="mt-2 text-xs text-slate-500">
                {entry.actorName} · {formatLabel(entry.actorType)}
              </p>
            </li>
          ))}
        </ul>
      </DetailCard>
    </GovCrmPageShell>
  );
}
