import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { togglePublicCitizenVisibility } from "@/lib/profile/actions";

type PublicVisibilityToggleProps = {
  isPublic: boolean;
};

export function PublicVisibilityToggle({ isPublic }: PublicVisibilityToggleProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Public citizen visibility</p>
      <h2 className="mt-2 text-xl font-semibold text-ink">{isPublic ? "Your citizen profile is public" : "Your citizen profile is private"}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Public citizens can appear in My Community discovery and show a lightweight public opinion summary. Anonymous is
        still the default.
      </p>
      <form action={togglePublicCitizenVisibility} className="mt-5">
        <input type="hidden" name="nextVisible" value={isPublic ? "false" : "true"} />
        <FormSubmitButton
          idleLabel={isPublic ? "Make profile private" : "Make profile public"}
          pendingLabel="Updating..."
          className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
      </form>
    </section>
  );
}
