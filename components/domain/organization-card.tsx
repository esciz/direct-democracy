import Link from "next/link";

import { CivicAvatar } from "@/components/domain/civic-avatar";
import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { getOrganizationScopeLabel, getOrganizationTypeLabel } from "@/lib/organizations/presentation";
import type { OrganizationSummary } from "@/types/domain";

type OrganizationCardProps = {
  organization: OrganizationSummary;
  compact?: boolean;
  guestMode?: boolean;
};

export function OrganizationCard({ organization, compact = false, guestMode = false }: OrganizationCardProps) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <CivicAvatar
            name={organization.name}
            entityType="organization"
            size="md"
            verified={organization.viewerMembershipState === "approved" || organization.canManage}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cyan-500/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
                {getOrganizationTypeLabel(organization.organizationType)}
              </span>
              <span className="rounded-full bg-white/6 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                {getOrganizationScopeLabel(organization)}
              </span>
              <span className="rounded-full bg-white/6 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                {organization.memberCount} member{organization.memberCount === 1 ? "" : "s"}
              </span>
              {organization.viewerMembershipState === "approved" ? (
                <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Member
                </span>
              ) : null}
            </div>
            <h3 className="mt-3 truncate text-lg font-semibold text-slate-50">
              <Link href={`/organizations/${organization.id}`} className="transition hover:text-cyan-100">
                {organization.name}
              </Link>
            </h3>
            <p className="mt-2 text-sm text-slate-400">{organization.jurisdictionName}</p>
          </div>
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
      <p className={`mt-3 text-sm leading-6 text-slate-300 ${compact ? "line-clamp-3" : ""}`}>{organization.description}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Votes</p>
          <p className="mt-2 text-lg font-semibold text-white">{organization.activeVoteCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Debates</p>
          <p className="mt-2 text-lg font-semibold text-white">{organization.activeDebateCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Endorsements</p>
          <p className="mt-2 text-lg font-semibold text-white">{organization.endorsementCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Statements</p>
          <p className="mt-2 text-lg font-semibold text-white">{organization.statementCount ?? organization.announcementCount}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {organization.issueTags.slice(0, compact ? 2 : 4).map((tag) => (
          <span key={tag} className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-200">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/organizations/${organization.id}`} className="font-semibold text-cyan-100 hover:text-white">
          View organization
        </Link>
        {organization.canManage ? <span className="font-semibold text-slate-300">Admin access</span> : null}
      </div>
    </article>
  );
}
