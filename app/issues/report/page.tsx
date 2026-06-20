import Link from "next/link";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { PageIntro } from "@/components/ui/page-intro";
import { submitIssueReviewRequest } from "@/lib/issues/submission-actions";
import { getCurrentUser } from "@/lib/server/auth-session";

const ISSUE_CATEGORIES = [
  "Government Accountability",
  "Criminal Justice",
  "Education",
  "Elections",
  "Environment",
  "Housing",
  "Infrastructure",
  "Public Safety",
  "Transportation",
  "Taxes and Spending",
  "Other",
];

type IssueReportPageProps = {
  searchParams?: Promise<{
    submitted?: string;
    error?: string;
  }>;
};

export default async function IssueReportPage({ searchParams }: IssueReportPageProps) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams ? searchParams : Promise.resolve(undefined)]);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Issues"
        title="Report an issue"
        description="Submit a civic concern, complaint, investigation lead, or policy topic for review. Issues can later link to court records, meetings, votes, officials, news, spending, projects, and communities."
        actions={
          <Link href="/issues" className="dd-button-secondary rounded-full px-4 py-3 text-sm font-semibold">
            Browse issues
          </Link>
        }
      />

      {params?.submitted === "1" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your issue was submitted for review. Supporting materials stay review-gated until redaction and verification.
        </section>
      ) : null}
      {params?.error ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.error === "verification" && "Voter verification is required before reporting an issue."}
          {params.error === "title" && "Add a clear issue title."}
          {params.error === "category" && "Choose an issue category."}
          {params.error === "community" && "Add the affected community or jurisdiction."}
        </section>
      ) : null}
      {!user.isVerifiedVoter ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Issue reporting is limited to verified voters in this prototype so submissions can be reviewed responsibly.
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <form action={submitIssueReviewRequest} className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Step 1</p>
            <label className="mt-3 block space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">What issue would you like reviewed?</span>
              <input
                name="title"
                placeholder="Example: Potential wrongful conviction of John Doe"
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Category</span>
              <select name="category" className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500">
                {ISSUE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Community / jurisdiction</span>
              <input
                name="community"
                defaultValue={user.jurisdictionName}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Step 2</p>
            <label className="mt-3 block space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Supporting materials</span>
              <textarea
                name="evidenceUrls"
                rows={4}
                placeholder="Paste one public source URL per line: PDFs, court documents, news articles, meeting records, letters, or other evidence."
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Step 3</p>
            <label className="mt-3 block space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Optional explanation</span>
              <textarea
                name="description"
                rows={5}
                placeholder="Explain what happened, who is affected, and what you want reviewers to examine. Do not include SSNs, home addresses, phone numbers, names of minors, or confidential details."
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              />
            </label>
          </div>

          <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-cyan-950">
            Step 4 happens after submission: the review system drafts a summary, extracts possible officials, agencies, jurisdictions, court case numbers, related meetings, legislation, and public records, then waits for human review before public use.
          </section>

          <FormSubmitButton
            idleLabel="Submit issue for review"
            pendingLabel="Submitting..."
            disabled={!user.isVerifiedVoter}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
        </form>
      </section>
    </div>
  );
}
