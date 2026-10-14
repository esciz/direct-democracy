import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { requestPetitionSponsorship, startPetitionDrafting } from "@/lib/petitions/actions";
import type { SponsorshipRequestSummary } from "@/types/domain";

type PetitionSponsorshipFormProps = {
  petitionId: string;
  requests: SponsorshipRequestSummary[];
  canStartDrafting?: boolean;
  isDrafting?: boolean;
  guestMode?: boolean;
};

export function PetitionSponsorshipForm({
  petitionId,
  requests,
  canStartDrafting = false,
  isDrafting = false,
  guestMode = false,
}: PetitionSponsorshipFormProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Public sponsorship</p>
      <h2 className="mt-2 text-xl font-semibold text-ink">Request sponsorship</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        This creates a public post asking relevant officials to sponsor the petition. No private workflow is used in MVP.
      </p>
      {guestMode ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
          Guest Browse is read-only. Verify to request sponsorship or help move this petition into drafting.
        </div>
      ) : (
        <form action={requestPetitionSponsorship} className="mt-5">
          <input type="hidden" name="petitionId" value={petitionId} />
          <FormSubmitButton
            idleLabel="Request sponsorship"
            pendingLabel="Posting request..."
            className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
        </form>
      )}
      {!guestMode && isDrafting ? (
        <p className="mt-4 text-sm font-medium text-violet-700">Drafting has started for this petition.</p>
      ) : !guestMode && canStartDrafting ? (
        <form action={startPetitionDrafting} className="mt-4">
          <input type="hidden" name="petitionId" value={petitionId} />
          <FormSubmitButton
            idleLabel="Start drafting"
            pendingLabel="Starting..."
            className="rounded-full border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </form>
      ) : null}
      <div className="mt-5 space-y-3">
        {requests.length ? (
          requests.map((request) => (
            <div key={request.id} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">{request.requesterName}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                {request.targetedOfficialNames.length ? request.targetedOfficialNames.join(" · ") : "Public request"}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No sponsorship requests have been posted yet.</p>
        )}
      </div>
    </section>
  );
}
