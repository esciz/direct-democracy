import Link from "next/link";

import { getOrganizationTypeLabel, getPublicOrganizationCategoryLabel } from "@/lib/organizations/presentation";
import type { PublicOrganizationDetail } from "@/lib/organizations/store";

export function PublicOrganizationCard({ organization }: { organization: PublicOrganizationDetail }) {
  const partyProfile = organization.partyProfile;
  const registryLabel = partyProfile
    ? organization.websiteHealth?.ok
      ? "Party source checked"
      : "Party source registered"
    : organization.registry.irsMatched
      ? "IRS cross-check attached"
      : organization.websiteHealth?.ok
        ? "Official site checked"
        : "Source routes registered";
  const typeLabel = partyProfile ? "Political party organization" : getOrganizationTypeLabel(organization.organizationType);

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-cyan-500/12 px-3 py-1 text-cyan-100">
              {getPublicOrganizationCategoryLabel(organization.category)}
            </span>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-slate-300">
              {organization.scope}
            </span>
            {partyProfile ? (
              <span className="rounded-full bg-amber-500/12 px-3 py-1 text-amber-100">
                {partyProfile.relationship === "directory_listing_no_affiliation"
                  ? "Directory listing, not affiliated"
                  : `${partyProfile.party} network`}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">
            <Link href={`/organizations/${organization.id}`} className="hover:text-cyan-100">
              {organization.name}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {typeLabel} · {organization.headquarters}
          </p>
        </div>
        <span className="text-xs font-semibold text-emerald-200">{registryLabel}</span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{organization.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {organization.issueTags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-slate-200">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href={`/organizations/${organization.id}`} className="text-cyan-100 hover:text-white">
          View source profile
        </Link>
        <Link href={organization.affiliationUrl} className="text-slate-300 hover:text-white">
          {partyProfile ? "Party source or involvement" : "Membership or involvement"}
        </Link>
      </div>
    </article>
  );
}
