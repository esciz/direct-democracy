import Link from "next/link";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import type { OrganizationSummary } from "@/types/domain";

type OrganizationCardProps = {
  organization: OrganizationSummary;
  compact?: boolean;
  guestMode?: boolean;
};

function getOrganizationTypeLabel(type: OrganizationSummary["organizationType"]) {
  return type === "campus_org" ? "Campus Org" : "Coalition";
}

export function OrganizationCard({ organization, compact = false, guestMode = false }: OrganizationCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            {getOrganizationTypeLabel(organization.organizationType)}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {organization.memberCount} member{organization.memberCount === 1 ? "" : "s"}
          </span>
          {organization.viewerMembershipState === "approved" ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Member
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <FavoriteToggleControl targetType="organization" targetId={organization.id} />
          <ShareActionMenu
            target={{
              entityType: "organization",
              entityId: organization.id,
              title: organization.name,
              href: `/organizations/${organization.id}`,
              summary: organization.description,
              issueTag: organization.issueTags[0] ?? null,
            }}
            returnPath={`/organizations/${organization.id}`}
            guestMode={guestMode}
            iconOnly
          />
        </div>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-ink">
        <Link href={`/organizations/${organization.id}`} className="transition hover:text-civic-700">
          {organization.name}
        </Link>
      </h3>
      <p className="mt-2 text-sm text-slate-500">{organization.jurisdictionName}</p>
      <p className={`mt-3 text-sm leading-6 text-slate-600 ${compact ? "line-clamp-3" : ""}`}>{organization.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {organization.issueTags.slice(0, compact ? 2 : 4).map((tag) => (
          <span key={tag} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/organizations/${organization.id}`} className="font-semibold text-civic-700 hover:text-civic-900">
          View organization
        </Link>
        {organization.canManage ? <span className="font-semibold text-slate-700">Admin access</span> : null}
      </div>
    </article>
  );
}
