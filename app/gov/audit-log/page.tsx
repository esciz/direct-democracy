import Link from "next/link";

import { GovCrmPageShell } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getGovCases } from "@/lib/govcrm/cases";

export const dynamic = "force-dynamic";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function GovAuditLogPage() {
  await requireGovCrmAccess();

  const entries = getGovCases()
    .flatMap((caseItem) =>
      caseItem.auditTrail.map((entry) => ({
        ...entry,
        caseTitle: caseItem.title,
        caseHref: `/gov/cases/${caseItem.id}`,
        trackingCode: caseItem.publicTrackingCode,
      })),
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return (
    <GovCrmPageShell
      title="Audit log"
      description="Read-only internal audit timeline for GovCRM fixture workflows. Future write actions must append durable audit entries before they can ship."
    >
      <section className="rounded-md border border-slate-800 bg-slate-950">
        <div className="grid grid-cols-12 gap-3 border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span className="col-span-3">Time</span>
          <span className="col-span-2">Actor</span>
          <span className="col-span-2">Action</span>
          <span className="col-span-5">Record</span>
        </div>
        <ul className="divide-y divide-slate-800">
          {entries.map((entry) => (
            <li key={entry.id} className="grid grid-cols-12 gap-3 px-4 py-3 text-sm">
              <span className="col-span-12 text-slate-400 md:col-span-3">{formatDateTime(entry.createdAt)}</span>
              <span className="col-span-6 text-slate-300 md:col-span-2">{entry.actorName}</span>
              <span className="col-span-6 text-cyan-100 md:col-span-2">{formatLabel(entry.action)}</span>
              <span className="col-span-12 md:col-span-5">
                <Link href={entry.caseHref} className="font-semibold text-white hover:text-cyan-100">
                  {entry.trackingCode}
                </Link>
                <span className="block text-slate-400">{entry.caseTitle}</span>
                <span className="mt-1 block text-xs text-slate-500">{entry.details}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </GovCrmPageShell>
  );
}
