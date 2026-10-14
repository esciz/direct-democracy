import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { signPetition } from "@/lib/petitions/actions";

type PetitionSignFormProps = {
  petitionId: string;
  canSign: boolean;
  hasSigned: boolean;
  userIsVerified: boolean;
  jurisdictionMatches: boolean;
  guestMode?: boolean;
};

export function PetitionSignForm({
  petitionId,
  canSign,
  hasSigned,
  userIsVerified,
  jurisdictionMatches,
  guestMode = false,
}: PetitionSignFormProps) {
  let helperText = "Verified residents in the petition jurisdiction can sign once.";

  if (guestMode) {
    helperText = "Guest Browse is read-only. Verify to sign petitions or take part in public civic actions.";
  } else if (!userIsVerified) {
    helperText = "Only verified users can create and sign petitions.";
  } else if (!jurisdictionMatches) {
    helperText = "Your current user must belong to this petition's jurisdiction to sign.";
  } else if (hasSigned) {
    helperText = "You have already signed this petition.";
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Primary action</p>
      <h2 className="mt-2 text-xl font-semibold text-ink">Sign this petition</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helperText}</p>

      {guestMode ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
          Browse is open in guest mode. Create an account and verify to sign this petition.
        </div>
      ) : (
        <form action={signPetition} className="mt-5">
          <input type="hidden" name="petitionId" value={petitionId} />
          <FormSubmitButton
            idleLabel={hasSigned ? "Already signed" : "Sign petition"}
            pendingLabel="Signing..."
            disabled={!canSign}
            className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300"
          />
        </form>
      )}
    </section>
  );
}
