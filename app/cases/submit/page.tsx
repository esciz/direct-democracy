import Link from "next/link";

import { IssuePickerField } from "@/components/domain/issue-picker-field";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { submitVerifiedCaseRequest } from "@/lib/cases/submission-actions";
import { getIssuePickerOptions } from "@/lib/server/issues";

type SubmitCasePageProps = {
  searchParams?: Promise<{
    submitted?: string;
    error?: string;
  }>;
};

export default async function SubmitCasePage({ searchParams }: SubmitCasePageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const issueOptions = await getIssuePickerOptions(user);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Submit a Case"
        title="Submit a verified case for review"
        description="Case submissions are structured and reviewed before public visibility. This is for verifiable public-interest cases, not freeform legal rumors."
        actions={
          <Link
            href="/take-action"
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to Take Action
          </Link>
        }
      />

      {params?.submitted === "1" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your case submission was received and routed into review before any public visibility.
        </section>
      ) : null}
      {params?.error ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.error === "verification" && "Voter verification is required before submitting a case."}
          {params.error === "title" && "Add a clear case title."}
          {params.error === "jurisdiction" && "Choose a valid jurisdiction."}
          {params.error === "court" && "Choose a valid court level."}
          {params.error === "source" && "A source or reference link is required."}
          {params.error === "summary" && "Add a short summary explaining the public-interest reason for submission."}
        </section>
      ) : null}

      {!user.isVerifiedVoter ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Verified-case submission is limited to verified voters so public case listings do not turn into open freeform claims.
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <form action={submitVerifiedCaseRequest} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Case title</span>
              <input
                type="text"
                name="caseTitle"
                placeholder="Example: Nevada Public Records Access v. Carson City"
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Case number</span>
              <input
                type="text"
                name="caseNumber"
                placeholder="Optional if available"
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Jurisdiction</span>
              <input
                type="text"
                name="jurisdiction"
                defaultValue={user.jurisdictionName}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Court level</span>
              <select
                name="courtLevel"
                defaultValue="State"
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              >
                <option value="Municipal">Municipal</option>
                <option value="County">County</option>
                <option value="State">State</option>
                <option value="Federal">Federal</option>
                <option value="Appellate">Appellate</option>
                <option value="Supreme Court">Supreme Court</option>
              </select>
            </label>
          </div>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">Source or reference link</span>
            <input
              type="url"
              name="sourceUrl"
              placeholder="https://"
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
            />
          </label>

          <IssuePickerField
            name="issueTag"
            label="Primary issue"
            options={issueOptions}
            placeholder="Select a shared issue"
            helpText="Issue-tagged case submissions can be grouped with the right topic if approved."
            allowCustom={false}
            inputClassName="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
          />

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">Why this case matters publicly</span>
            <textarea
              name="summary"
              rows={5}
              placeholder="Explain the public-interest reason this case should be reviewed for visibility on the platform."
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
            />
          </label>

          <FormSubmitButton
            idleLabel="Submit for review"
            pendingLabel="Submitting..."
            disabled={!user.isVerifiedVoter}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
        </form>
      </section>
    </div>
  );
}
