import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { ActionLabel, ThumbsUpIcon } from "@/components/ui/action-icons";
import { supportCase, toggleCaseFollow } from "@/lib/cases/actions";
import type { AuthUser, CaseDetail } from "@/types/domain";

type CaseSupportPanelProps = {
  caseItem: CaseDetail;
  user: AuthUser;
  returnPath: string;
};

export function CaseSupportPanel({ caseItem, user, returnPath }: CaseSupportPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Public support and community input</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Follow or support this case</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        This is not a legal filing. It helps show public interest, surface community impact, and prepare themes for future legal-partner review.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <form action={toggleCaseFollow}>
          <input type="hidden" name="caseId" value={caseItem.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <FormSubmitButton
            idleLabel={caseItem.viewerIsFollowing ? "Following case" : "Follow case"}
            pendingLabel="Saving..."
            className={
              caseItem.viewerIsFollowing
                ? "rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                : "rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
            }
          />
        </form>
      </div>

      <form action={supportCase} className="mt-6 space-y-4 rounded-3xl bg-slate-50 p-5">
        <input type="hidden" name="caseId" value={caseItem.id} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <div>
          <p className="text-sm font-semibold text-ink">Add a short support statement</p>
          <p className="mt-2 text-sm text-slate-600">
            Keep it focused on community impact. This platform does not provide legal advice or represent you in court.
          </p>
        </div>
        <textarea
          name="statement"
          rows={4}
          maxLength={280}
          defaultValue=""
          placeholder="Example: This case matters because public meeting access affects whether ordinary residents can follow city decisions."
          className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
        />
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" name="isPublic" defaultChecked className="h-4 w-4 rounded border-slate-300" />
          Show this statement publicly on the case page
        </label>
        <FormSubmitButton
          idleLabel={
            <ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>
              {caseItem.viewerSupports ? "Update support statement" : "Support this case"}
            </ActionLabel>
          }
          pendingLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
          disabled={!user.isVerifiedVoter}
          className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
        {!user.isVerifiedVoter ? (
          <p className="text-sm text-orange-700">Verified voter status is required before adding public case support.</p>
        ) : null}
      </form>
    </section>
  );
}
