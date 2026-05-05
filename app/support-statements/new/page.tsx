import Link from "next/link";

import { PageIntro } from "@/components/ui/page-intro";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { getCurrentUser } from "@/lib/server/auth-session";
import { createSupportStatementSubmission } from "@/lib/support-statements/actions";

type SupportStatementPageProps = {
  searchParams?: Promise<{
    saved?: string;
    error?: string;
    targetType?: string;
    targetName?: string;
  }>;
};

export default async function NewSupportStatementPage({ searchParams }: SupportStatementPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Statement of Support"
        title="Write a statement of support"
        description="Add a concise public support statement tied to an issue, petition, case, legislation item, or event. This stays lightweight here and can be linked into deeper public workflows later."
        actions={
          <Link
            href="/take-action"
            className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to Take Action
          </Link>
        }
      />

      {params?.saved === "1" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your support statement was saved.
        </section>
      ) : null}
      {params?.error ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.error === "verification" && "Voter verification is required before submitting a support statement."}
          {params.error === "target" && "Choose a valid target and give it a clear label."}
          {params.error === "statement" && "Support statements should be between 20 and 400 characters."}
        </section>
      ) : null}

      {!user.isVerifiedVoter ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Voter verification is required before submitting public support statements.
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <form action={createSupportStatementSubmission} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Supporting</span>
              <select
                name="targetType"
                defaultValue={params?.targetType ?? "issue"}
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              >
                <option value="issue">Issue</option>
                <option value="legislation">Legislation</option>
                <option value="petition">Petition</option>
                <option value="case">Verified case</option>
                <option value="event">Event</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-semibold text-ink">Target name</span>
              <input
                type="text"
                name="targetName"
                defaultValue={params?.targetName ?? ""}
                placeholder="Example: Nevada campaign finance transparency petition"
                className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">Your statement</span>
            <textarea
              name="statement"
              rows={5}
              maxLength={400}
              placeholder="Explain why this matters in a concise, public-facing way."
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
            />
          </label>

          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-semibold text-ink">Source or reference link</span>
            <input
              type="url"
              name="sourceUrl"
              placeholder="Optional supporting link"
              className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-civic-500"
            />
          </label>

          <label className="flex items-center gap-3 text-sm text-slate-700">
            <input type="checkbox" name="isPublic" defaultChecked className="h-4 w-4 rounded border-slate-300" />
            Allow this statement to appear publicly where appropriate
          </label>

          <FormSubmitButton
            idleLabel="Save statement"
            pendingLabel="Saving..."
            disabled={!user.isVerifiedVoter}
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          />
        </form>
      </section>
    </div>
  );
}
