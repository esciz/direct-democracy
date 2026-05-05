import Link from "next/link";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import type { CaseSummary } from "@/types/domain";

function courtLabel(value: CaseSummary["courtLevel"]) {
  return value === "local" ? "Local court" : value === "state" ? "State court" : "Federal court";
}

export function CaseCard({ caseItem, guestMode = false }: { caseItem: CaseSummary; guestMode?: boolean }) {
  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            {courtLabel(caseItem.courtLevel)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
            {caseItem.stage}
          </span>
          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">
            {caseItem.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FavoriteToggleControl targetType="case" targetId={caseItem.id} />
          <ShareActionMenu
            target={{
              entityType: "case",
              entityId: caseItem.id,
              title: caseItem.title,
              href: `/cases/${caseItem.id}`,
              summary: caseItem.summary,
              issueTag: caseItem.issueTags?.[0] ?? null,
            }}
            returnPath={`/cases/${caseItem.id}`}
            guestMode={guestMode}
            iconOnly
          />
        </div>
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight text-ink">{caseItem.title}</h2>
      <p className="mt-2 text-sm text-slate-500">{caseItem.jurisdictionName}</p>
      <p className="mt-4 text-sm leading-7 text-slate-600">{caseItem.summary}</p>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
        {caseItem.issueTags.map((tag) => (
          <span key={tag} className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{caseItem.followCount} following</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{caseItem.supportCount} supporting</span>
      </div>
      <div className="mt-5">
        <Link
          href={`/cases/${caseItem.id}`}
          className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
        >
          View case
        </Link>
      </div>
    </article>
  );
}
