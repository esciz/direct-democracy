import Link from "next/link";
import { redirect } from "next/navigation";

import { submitPrivateBetaFeedbackAction } from "@/app/feedback/actions";
import { PageIntro } from "@/components/ui/page-intro";
import { PRIVATE_BETA_FEEDBACK_CATEGORIES, PRIVATE_BETA_FEEDBACK_SEVERITIES } from "@/lib/private-beta/feedback";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

type FeedbackPageProps = {
  searchParams?: Promise<{ feedback?: string; pageUrl?: string }>;
};

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const [user, params] = await Promise.all([getCurrentSessionUser(), searchParams ? searchParams : Promise.resolve(undefined)]);
  if (!user) {
    redirect("/auth?next=%2Ffeedback");
  }

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Private Beta"
        title="Send feedback"
        description="Tell us what broke, what felt confusing, or what data looked stale while testing Direct Democracy. Submissions go to the private admin review queue and are not published."
        meta={
          <>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
              Private review
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
              Signed in as {user.name}
            </span>
          </>
        }
      />

      {params?.feedback === "submitted" ? (
        <section className="rounded-[1.75rem] border border-emerald-300/20 bg-emerald-500/10 p-5 text-sm leading-6 text-emerald-100">
          Thanks. Your feedback was saved to the private beta review queue.
        </section>
      ) : null}
      {params?.feedback === "invalid" ? (
        <section className="rounded-[1.75rem] border border-amber-300/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
          Add a short summary and at least a sentence of detail so we can understand what happened.
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-card sm:p-6">
        <form action={submitPrivateBetaFeedbackAction} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">What kind of feedback?</span>
              <select name="category" defaultValue="bug" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
                {PRIVATE_BETA_FEEDBACK_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Severity</span>
              <select name="severity" defaultValue="medium" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none">
                {PRIVATE_BETA_FEEDBACK_SEVERITIES.map((severity) => (
                  <option key={severity.value} value={severity.value}>
                    {severity.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Page or URL</span>
            <input
              name="pageUrl"
              defaultValue={params?.pageUrl ?? ""}
              placeholder="/voting or https://directyourdemocracy.com/..."
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Short summary</span>
            <input
              name="summary"
              required
              minLength={6}
              maxLength={160}
              placeholder="Example: Voting page sent me back to auth"
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">What happened?</span>
            <textarea
              name="details"
              required
              minLength={10}
              rows={6}
              placeholder="Tell us what you clicked, what you expected, and what you saw."
              className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Expected behavior</span>
              <textarea name="expectedBehavior" rows={4} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500" />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Actual behavior</span>
              <textarea name="actualBehavior" rows={4} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500" />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <label className="flex gap-3 text-sm leading-6 text-slate-300">
              <input name="contactOk" type="checkbox" className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950" />
              <span>You can contact me about this report if you need more detail.</span>
            </label>
            <input
              name="contactEmail"
              type="email"
              placeholder="Optional email for follow-up"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
              Send feedback
            </button>
            <Link href="/profile" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100">
              Back to profile
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
