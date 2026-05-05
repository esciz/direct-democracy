import Link from "next/link";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { removeCandidateEndorsement, saveCandidateEndorsement } from "@/lib/candidates/endorsement-actions";
import type { AuthUser, CandidateCampaignSummary } from "@/types/domain";

type CandidateEndorsementsPanelProps = {
  campaign: CandidateCampaignSummary;
  viewer: AuthUser;
  returnPath: string;
};

function canViewerEndorse(viewer: AuthUser) {
  return viewer.isVerifiedVoter && (viewer.role === "citizen" || viewer.role === "trustedCitizen");
}

export function CandidateEndorsementsPanel({ campaign, viewer, returnPath }: CandidateEndorsementsPanelProps) {
  const canEndorse = canViewerEndorse(viewer);
  const hasDirectEndorsement = Boolean(campaign.viewerEndorsement);
  const hasOtherEndorsementInElection = Boolean(
    campaign.viewerElectionEndorsementCampaignId && campaign.viewerElectionEndorsementCampaignId !== campaign.id,
  );

  return (
    <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Citizen endorsements</p>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {campaign.endorsementCount ?? 0} total
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">User-generated support for this specific campaign. This is not platform approval.</p>

      {campaign.visibleEndorsers?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {campaign.visibleEndorsers.map((endorser) => (
            <Link
              key={endorser.userId}
              href={`/citizens/${endorser.userId}`}
              className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700"
            >
              {endorser.userName}
            </Link>
          ))}
        </div>
      ) : null}

      {canEndorse ? (
        <div className="mt-4 space-y-3">
          <form action={saveCandidateEndorsement} className="space-y-3">
            <input type="hidden" name="candidateCampaignId" value={campaign.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="isPublic"
                defaultChecked={campaign.viewerEndorsement?.isPublic ?? true}
                className="h-4 w-4 rounded border-slate-300 text-civic-600 focus:ring-civic-500"
              />
              Show this endorsement on my public citizen profile
            </label>
            <FormSubmitButton
              idleLabel={
                hasDirectEndorsement
                  ? "Update endorsement"
                  : hasOtherEndorsementInElection
                    ? "Change endorsement to this campaign"
                    : "Endorse this campaign"
              }
              pendingLabel="Saving..."
              className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            />
          </form>

          {hasDirectEndorsement ? (
            <form action={removeCandidateEndorsement}>
              <input type="hidden" name="electionId" value={campaign.electionId} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <FormSubmitButton
                idleLabel="Remove endorsement"
                pendingLabel="Removing..."
                className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </form>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Verified citizens and trusted citizens can endorse candidates in a specific election.
        </p>
      )}
    </section>
  );
}
