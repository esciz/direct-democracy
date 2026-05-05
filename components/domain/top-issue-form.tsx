import { submitTopIssue } from "@/lib/community/actions";
import { IssuePickerField } from "@/components/domain/issue-picker-field";
import { FormSubmitButton } from "@/components/ui/form-submit-button";

type TopIssueFormProps = {
  jurisdictionName: string;
  selectedScope: "local" | "state" | "national";
  issueOptions: string[];
  returnPath?: string;
};

export function TopIssueForm({ jurisdictionName, selectedScope, issueOptions, returnPath = "/my-community" }: TopIssueFormProps) {
  const scopeLabel =
    selectedScope === "local" ? jurisdictionName : selectedScope === "state" ? "Nevada" : "United States";

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Top issue today</p>
      <h3 className="mt-2 text-xl font-semibold text-ink">What matters most in your community right now?</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Choose one shared public-interest issue for {scopeLabel}. This is a lightweight daily input, not a full public post.
      </p>
      <form action={submitTopIssue} className="mt-5 space-y-3">
        <input type="hidden" name="scope" value={selectedScope} />
        <input type="hidden" name="returnPath" value={returnPath} />
        <IssuePickerField
          name="issueText"
          label="Issue"
          options={issueOptions}
          placeholder="Select a shared issue"
          helpText="Top issues use the shared issue taxonomy so people, organizations, and content can connect to the same topic hub."
          allowCustom={false}
          required
          inputClassName="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
        />
        <FormSubmitButton
          idleLabel="Submit issue"
          pendingLabel="Submitting..."
          className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
      </form>
    </section>
  );
}
