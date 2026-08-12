import type { Metadata } from "next";
import Link from "next/link";

import { submitPerspectiveSuggestion } from "./actions";
import { ChallengeMyViewExplorer } from "./challenge-my-view-explorer";
import { canSuggestPerspective, listPerspectiveSuggestions, perspectiveSuggestionToTopic } from "@/lib/perspectives/suggestions";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

export const metadata: Metadata = {
  title: "Challenge My View | Direct Democracy",
  description: "Explore the strongest challenge to a political position, its evidence, values, tradeoffs, and possible common ground.",
};

type ChallengeMyViewPageProps = {
  searchParams?: Promise<{ contribution?: string; reason?: string }>;
};

function ContributionForm({ contributorLabel }: { contributorLabel: string }) {
  const fieldClass = "dd-input mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none focus:border-cyan-300/30";
  return (
    <form action={submitPerspectiveSuggestion} className="mt-5 grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-200">Issue area<input name="category" required minLength={3} maxLength={60} className={fieldClass} placeholder="Example: Education and race" /></label>
        <label className="text-sm font-semibold text-slate-200">Statement to examine<input name="statement" required minLength={12} maxLength={220} className={fieldClass} placeholder="Phrase a policy claim without insulting a group" /></label>
      </div>
      <label className="text-sm font-semibold text-slate-200">Why this disagreement is worth exploring<textarea name="context" required minLength={30} maxLength={900} rows={3} className={fieldClass} placeholder="Name the real policy tension, competing values, and relevant setting." /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-200">Strongest case supporting it<textarea name="caseFor" required minLength={40} maxLength={1200} rows={5} className={fieldClass} placeholder="Write the version a thoughtful supporter would recognize as fair." /></label>
        <label className="text-sm font-semibold text-slate-200">Strongest challenge to it<textarea name="caseAgainst" required minLength={40} maxLength={1200} rows={5} className={fieldClass} placeholder="Write the version a thoughtful critic would recognize as fair." /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-200">Shared ground<textarea name="sharedGround" required rows={4} className={fieldClass} placeholder={"One idea per line\nA shared outcome both sides value"} /></label>
        <label className="text-sm font-semibold text-slate-200">Evidence to test<textarea name="evidenceToTest" required rows={4} className={fieldClass} placeholder={"One question per line\nWhat evidence could change the discussion?"} /></label>
        <label className="text-sm font-semibold text-slate-200">Who feels the impact<textarea name="affectedPeople" required rows={4} className={fieldClass} placeholder={"One group per line\nDescribe people without stereotyping them"} /></label>
        <label className="text-sm font-semibold text-slate-200">Possible policy paths<textarea name="policyPaths" required rows={4} className={fieldClass} placeholder={"One option per line\nInclude more than the two extremes"} /></label>
      </div>
      <label className="text-sm font-semibold text-slate-200">Credible sources<textarea name="sourceUrls" required rows={3} className={fieldClass} placeholder={"One public URL per line\nPrimary sources and strong research are preferred"} /></label>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 p-4">
        <p className="max-w-2xl text-xs leading-5 text-slate-400">Submitting as <strong className="text-slate-200">{contributorLabel}</strong>. Trusted status is visible to reviewers, but it never bypasses sourcing, harm, or fairness review.</p>
        <button className="dd-button-primary rounded-full px-5 py-3 text-sm font-bold">Send for admin review</button>
      </div>
    </form>
  );
}

export default async function ChallengeMyViewPage({ searchParams }: ChallengeMyViewPageProps) {
  const [approvedSuggestions, currentUser, params] = await Promise.all([
    listPerspectiveSuggestions("approved"),
    getCurrentSessionUser(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const canSuggest = canSuggestPerspective(currentUser);
  const communityTopics = approvedSuggestions.map(perspectiveSuggestionToTopic);

  return (
    <>
      <ChallengeMyViewExplorer communityTopics={communityTopics} />
      <section id="contribute" className="dd-panel mb-10 scroll-mt-24 rounded-[1.75rem] p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Community contribution</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">Suggest a view worth challenging</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Verified citizens and trusted citizens can propose a carefully framed statement, both strong arguments, evidence questions, and policy paths. Every submission remains private until an administrator approves it.</p>
        </div>

        {params?.contribution === "submitted" ? <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Your suggestion is in the admin review queue. It is not public yet.</div> : null}
        {params?.contribution === "error" ? <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">The suggestion needs complete, balanced arguments, all four lenses, and at least one valid source URL.</div> : null}

        {canSuggest && currentUser ? (
          <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 open:bg-white/[0.045]">
            <summary className="cursor-pointer list-none text-sm font-semibold text-cyan-100">Open contribution form <span aria-hidden="true">＋</span></summary>
            <ContributionForm contributorLabel={`${currentUser.name} · ${currentUser.role === "trustedCitizen" ? "Trusted citizen" : "Verified citizen"}`} />
          </details>
        ) : currentUser ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">Contribution opens after citizen verification or elevation to trusted citizen. You can still explore every approved perspective.</div>
        ) : (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-sm text-slate-300">Sign in with a verified citizen or trusted-citizen profile to contribute.</p>
            <Link href="/auth?next=%2Fchallenge-my-view%23contribute" className="dd-button-secondary rounded-full px-4 py-2 text-sm font-semibold">Sign in to contribute</Link>
          </div>
        )}
      </section>
    </>
  );
}
