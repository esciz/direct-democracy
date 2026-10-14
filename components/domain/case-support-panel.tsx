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
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Take action</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Follow this case or add your perspective</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Following keeps the record easy to find. Public support is optional and is not a legal filing.
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

      <details className="group mt-5 rounded-2xl bg-slate-50">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-sm font-semibold text-ink">
            {caseItem.viewerSupports ? "Edit my support statement" : "Add a public support statement"}
          </span>
          <span className="text-xs font-semibold text-civic-700 group-open:hidden">Open</span>
          <span className="hidden text-xs font-semibold text-civic-700 group-open:inline">Close</span>
        </summary>
        <form action={supportCase} className="space-y-4 border-t border-slate-200 p-4 sm:p-5">
          <input type="hidden" name="caseId" value={caseItem.id} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <p className="text-sm text-slate-600">
            Keep it focused on community impact. This platform does not provide legal advice or represent you in court.
          </p>
          <textarea
            name="statement"
            rows={4}
            maxLength={280}
            defaultValue=""
            placeholder="Why does this case matter to your community?"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" name="isPublic" defaultChecked className="h-4 w-4 rounded border-slate-300" />
            Show this statement publicly
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
      </details>
    </section>
  );
}
