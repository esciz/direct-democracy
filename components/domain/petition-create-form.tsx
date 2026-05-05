import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { IssuePickerField } from "@/components/domain/issue-picker-field";
import { createPetition } from "@/lib/petitions/actions";

type PetitionCreateFormProps = {
  jurisdictionName: string;
  error?: string;
  organization?: {
    id: string;
    name: string;
  } | null;
  issueOptions?: string[];
};

export function PetitionCreateForm({ jurisdictionName, error, organization, issueOptions = [] }: PetitionCreateFormProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
          Verified users only
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
          {jurisdictionName}
        </span>
        {organization ? (
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            Coalition · {organization.name}
          </span>
        ) : null}
      </div>

      <form action={createPetition} className="mt-6 space-y-4">
        {organization ? <input type="hidden" name="organizationId" value={organization.id} /> : null}
        <div>
          <label htmlFor="title" className="text-sm font-semibold text-ink">
            Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Request a district-level change"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          {error === "title" ? <p className="mt-2 text-sm text-orange-700">Use at least 8 characters for the title.</p> : null}
        </div>

        <div>
          <label htmlFor="summary" className="text-sm font-semibold text-ink">
            Summary
          </label>
          <textarea
            id="summary"
            name="summary"
            rows={3}
            placeholder="Add a concise summary residents can scan quickly."
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          {error === "summary" ? (
            <p className="mt-2 text-sm text-orange-700">Use at least 20 characters for the summary.</p>
          ) : null}
        </div>

        <IssuePickerField
          name="issueTag"
          label="Primary issue"
          options={issueOptions}
          placeholder="Select a shared issue"
          helpText="Petitions tagged to an issue can be discovered from that issue page and use the shared canonical issue list."
          allowCustom={false}
        />

        <div>
          <label htmlFor="body" className="text-sm font-semibold text-ink">
            Petition body
          </label>
          <textarea
            id="body"
            name="body"
            rows={8}
            placeholder="Explain the problem, requested action, and why it matters."
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
          />
          {error === "body" ? <p className="mt-2 text-sm text-orange-700">Use at least 40 characters for the body.</p> : null}
          {error === "organization" ? (
            <p className="mt-2 text-sm text-orange-700">Only coalition admins can publish petitions on behalf of an organization.</p>
          ) : null}
        </div>

        <FormSubmitButton
          idleLabel="Publish petition"
          pendingLabel="Publishing..."
          className="rounded-full bg-civic-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        />
      </form>
    </section>
  );
}
