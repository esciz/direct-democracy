import Link from "next/link";

import { ContactOfficialsPanel } from "@/components/domain/contact-officials-panel";
import { DraftLegislationCard } from "@/components/domain/draft-legislation-card";
import { IssueLifecycleMap } from "@/components/domain/issue-lifecycle-map";
import { PetitionSponsorshipForm } from "@/components/domain/petition-sponsorship-form";
import { PetitionSignForm } from "@/components/domain/petition-sign-form";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { slugifyIssueText } from "@/lib/issues/utils";
import type { ContactOfficialsPanelSummary, DraftLegislationSummary, PetitionDetail as PetitionDetailType } from "@/types/domain";

type PetitionDetailProps = {
  petition: PetitionDetailType;
  statusMessage?: string;
  continuityMessage?: string;
  draftLegislation?: DraftLegislationSummary | null;
  contactPanel?: ContactOfficialsPanelSummary | null;
  guestMode?: boolean;
};

export function PetitionDetail({
  petition,
  statusMessage,
  continuityMessage,
  draftLegislation,
  contactPanel,
  guestMode = false,
}: PetitionDetailProps) {
  const percent = Math.min(100, Math.round((petition.signatureCount / petition.signatureGoal) * 100));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="dd-panel rounded-[1.75rem] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/18 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              {petition.jurisdictionName}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
              {petition.status}
            </span>
          </div>
          <ShareActionMenu
            target={{
              entityType: "petition",
              entityId: petition.id,
              title: petition.title,
              href: `/petitions/${petition.id}`,
              summary: petition.summary,
              issueTag: petition.issueTags?.[0] ?? null,
            }}
            returnPath={`/petitions/${petition.id}`}
            guestMode={guestMode}
            iconOnly
          />
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50">{petition.title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">{petition.summary}</p>
        <div className="mt-6 h-3 rounded-full bg-white/[0.08]">
          <div className="h-3 rounded-full bg-[linear-gradient(90deg,#34d399,#22d3ee)]" style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm font-medium text-slate-400">
          <span>{petition.signatureCount.toLocaleString()} valid signatures</span>
          <span>{petition.signatureGoal.toLocaleString()} needed for co-sponsorship</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">Created by {petition.creatorName}</span>
          <span className="rounded-full border border-amber-300/18 bg-amber-500/10 px-3 py-1 text-amber-200">
            {petition.eligibleForCosponsorship ? "Eligible for co-sponsorship" : "Collecting signatures"}
          </span>
          {petition.issueTags?.map((tag) => (
            <Link
              key={`${petition.id}-${tag}`}
              href={`/issues/${slugifyIssueText(tag)}`}
              className="rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 py-1 text-cyan-200 transition hover:border-cyan-300/30 hover:text-white"
            >
              {tag}
            </Link>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold text-slate-50">Petition text</h2>
          <p className="text-sm leading-7 text-slate-300">{petition.body}</p>
        </div>

        <div className="mt-8">
          <IssueLifecycleMap lifecycle={petition.lifecycle} />
        </div>

        {draftLegislation ? (
          <div className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-200">Draft legislation</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-50">This petition is already moving into a formal draft</h2>
            <div className="mt-5">
              <DraftLegislationCard legislation={draftLegislation} />
            </div>
          </div>
        ) : null}
      </section>

      <div className="space-y-6">
        {continuityMessage ? (
          <section className="rounded-[1.75rem] border border-violet-300/16 bg-violet-500/10 p-5 text-sm text-violet-100 shadow-card">
            {continuityMessage}
          </section>
        ) : null}

        {statusMessage ? (
          <section className="rounded-[1.75rem] border border-cyan-300/16 bg-cyan-500/10 p-5 text-sm text-cyan-100 shadow-card">
            {statusMessage}
          </section>
        ) : null}

        <PetitionSignForm
          petitionId={petition.id}
          canSign={petition.canSign}
          hasSigned={petition.hasSigned}
          userIsVerified={petition.userIsVerified}
          jurisdictionMatches={petition.jurisdictionMatches}
          guestMode={guestMode}
        />

        <PetitionSponsorshipForm
          petitionId={petition.id}
          requests={petition.sponsorshipRequests}
          canStartDrafting={petition.canStartDrafting}
          isDrafting={petition.isDrafting}
          guestMode={guestMode}
        />

        {contactPanel ? <ContactOfficialsPanel panel={contactPanel} /> : null}

        <section className="dd-panel-muted rounded-[1.75rem] p-6">
          <p className="text-sm font-semibold text-slate-50">Recent valid signatures</p>
          <div className="mt-4 space-y-3">
            {petition.recentSignatures.length ? (
              petition.recentSignatures.map((signature) => (
                <div key={signature.id} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-sm font-semibold text-slate-100">{signature.signerName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {signature.jurisdictionName}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No signatures yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
