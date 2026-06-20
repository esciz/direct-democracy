import Link from "next/link";

import { beginGuidedOnboarding, finishGuidedOnboarding, startDemoOnboarding, submitCommunityAndIssuesSetup, submitVoterVerification, switchDevUser } from "@/lib/auth/actions";
import { DEV_ONLY_AUTH_ENABLED, PUBLIC_SESSION_VALUE } from "@/lib/auth/constants";
import { getCurrentSessionUser } from "@/lib/server/auth-session";
import { buildOnboardingTrustSummary, getOnboardingCommunities, getOnboardingDraft, getCanonicalOnboardingIssues, buildRoleMatchSummary, getMatchedPublicProfileForIdentity } from "@/lib/server/onboarding";

const trustLayers = [
  {
    label: "Layer 1",
    title: "Basic account verification",
    description: "Email, phone, CAPTCHA, rate limiting, and session risk checks stop low-effort fraud before identity matching starts.",
  },
  {
    label: "Layer 2",
    title: "Voter record verification",
    description: "Legal name, DOB, address, and jurisdiction are matched against voter registration data for standard civic participation.",
  },
  {
    label: "Layer 3",
    title: "Enhanced identity verification",
    description: "Only ambiguous, high-risk, or elevated-trust cases move to stronger identity checks such as ID plus selfie/liveness.",
  },
  {
    label: "Layer 4",
    title: "Manual review",
    description: "Edge cases, disputes, and unresolved claims escalate to review only when automation is not confident enough.",
  },
] as const;

const onboardingSteps = [
  {
    step: "1",
    title: "Create your account",
    description: "Start with the basics so your civic account has a secure foundation.",
  },
  {
    step: "2",
    title: "Tell us where you live",
    description: "Add your location so the right community, issues, and elections show up first.",
  },
  {
    step: "3",
    title: "Verify your voter record",
    description: "Confirm your identity so civic participation is tied to a real person in a real jurisdiction.",
  },
  {
    step: "4",
    title: "Pick your issues and summary style",
    description: "Choose what matters most so the app can start with relevant summaries instead of civic overload.",
  },
  {
    step: "5",
    title: "Start participating",
    description: "Use voting cards, petitions, meetings, and official messaging when the right verification level is available.",
  },
] as const;

const devStates = [
  { value: PUBLIC_SESSION_VALUE, label: "Logged out / public landing", description: "Test the true public entry experience." },
  { value: "user_citizen_casey_rivera", label: "New unverified user", description: "Test the onboarding state before verification." },
  { value: "user_citizen_alicia_hart", label: "Verified citizen", description: "Test a normal verified citizen path." },
  { value: "user_trusted_citizen_nora_patel", label: "Trusted citizen", description: "Test trusted features and guided outreach." },
  { value: "user_candidate_sofia_bennett", label: "Candidate", description: "Test public-figure participation and profile flows." },
  { value: "user_official_elena_ramirez", label: "Official", description: "Test in-office messaging and accountability flows." },
] as const;

type GetStartedPageProps = {
  searchParams?: Promise<{
    internal?: string;
    step?: string;
    claimProfile?: string;
  }>;
};

export default async function GetStartedPage({ searchParams }: GetStartedPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const showInternalTesting = DEV_ONLY_AUTH_ENABLED && params?.internal === "1";
  const currentUser = await getCurrentSessionUser();
  const draft = await getOnboardingDraft();
  const matchedProfile = await getMatchedPublicProfileForIdentity(draft);
  const roleMatch = buildRoleMatchSummary(matchedProfile);
  const trustSummary = buildOnboardingTrustSummary(draft);
  const step = params?.step ?? "account";
  const claimProfileId = params?.claimProfile ?? draft?.claimTargetProfileId ?? "";
  const communities = getOnboardingCommunities();
  const issueOptions = getCanonicalOnboardingIssues();

  return (
    <div className="space-y-8 py-8">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-civic-700">Get Started</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Set up your civic view in a few quick steps</h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            The goal is simple: learn where you are, what matters to you, and how much detail you want first. Verification still matters, but the experience should feel guided and useful, not intimidating.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {showInternalTesting ? (
            <form action={startDemoOnboarding}>
              <button
                type="submit"
                className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Start Demo Signup
              </button>
            </form>
          ) : (
            <Link
              href={`/get-started?step=account${claimProfileId ? `&claimProfile=${encodeURIComponent(claimProfileId)}` : ""}`}
              className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Start Guided Onboarding
            </Link>
          )}
          <Link
            href="/"
            className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
          >
            Back to Public Landing
          </Link>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Onboarding Flow</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">What the first-run experience should feel like</h2>
          <p className="mt-3 text-base leading-7 text-slate-600">
            The flow should answer a few helpful questions quickly: where you live, what matters most to you, and whether you want quick summaries first or deeper civic detail right away.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {onboardingSteps.map((step) => (
            <article key={step.step} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                  {step.step}
                </span>
                <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "account", label: "1. Account" },
            { key: "verify", label: "2. Verify identity" },
            { key: "verification-result", label: "3. Match result" },
            { key: "setup", label: "4. Community + issues" },
            { key: "role-match", label: "5. Role match" },
            { key: "finish", label: "6. Finish" },
          ].map((entry) => (
            <span
              key={entry.key}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${step === entry.key ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {entry.label}
            </span>
          ))}
        </div>

        {step === "account" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <form action={beginGuidedOnboarding} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <input type="hidden" name="claimProfileId" value={claimProfileId} />
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Screen 1</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Create your account</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Everyone begins with the same basic account. Public roles like candidate or official only attach later if your verified identity matches a public profile.
              </p>
              <div className="mt-5 grid gap-4">
                <input name="fullName" placeholder="Full name" defaultValue={draft?.accountName ?? ""} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
                <input name="email" type="email" placeholder="Email" defaultValue={draft?.accountEmail ?? ""} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
                <input name="phoneNumber" type="tel" placeholder="Phone number" defaultValue={draft?.phoneNumber ?? ""} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
                <input name="password" type="password" placeholder="Password" className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
                <button type="submit" className="w-fit rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                  Continue to Verification
                </button>
              </div>
            </form>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-ink">Why signup comes first</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                The platform needs a real account before it can place you in the right communities, verify identity, or personalize what shows up first.
              </p>
            </div>
          </div>
        ) : null}

        {step === "verify" ? (
          <form action={submitVoterVerification} className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <input type="hidden" name="claimProfileId" value={claimProfileId} />
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Screen 2</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Verify identity and voter record</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Verification makes civic actions legitimate. It also unlocks the right local context and supports secure candidate or official profile claiming later on.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input name="legalFirstName" placeholder="Legal first name" defaultValue={draft?.legalFirstName ?? ""} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
              <input name="legalLastName" placeholder="Legal last name" defaultValue={draft?.legalLastName ?? ""} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
              <input name="dateOfBirth" type="date" defaultValue={draft?.dateOfBirth ?? ""} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
              <input name="streetAddress" placeholder="Street address" defaultValue={draft?.streetAddress ?? ""} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500" />
              <select name="jurisdictionName" defaultValue={draft?.jurisdictionName ?? ""} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500 md:col-span-2">
                <option value="">Select jurisdiction</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.primaryJurisdictionName}>
                    {community.primaryJurisdictionName}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="mt-5 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Run Verification Match
            </button>
          </form>
        ) : null}

        {step === "verification-result" ? (
          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Screen 3</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Verification result</h3>
            <div className="mt-5 rounded-3xl bg-white p-5">
              <p className="text-lg font-semibold text-ink">
                {draft?.verificationStatus === "strongMatch"
                  ? "Verified match found"
                  : draft?.verificationStatus === "possibleMatch"
                    ? "Possible match found"
                    : "No voter match found"}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {draft?.verificationStatus === "strongMatch"
                  ? `We found a strong identity match for ${draft.matchedVoterRecordName}. You can continue with community setup and profile matching.`
                  : draft?.verificationStatus === "possibleMatch"
                    ? "Your information appears close to a voter record, but the confidence is not strong enough for automatic clearance. Standard onboarding can continue, but higher-risk actions may require enhanced verification or review."
                    : "We could not find a voter match from the information entered. You can continue onboarding as a citizen account, but voting and secure profile claiming remain locked until review succeeds."}
              </p>
            </div>
            <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Current trust tier</p>
              <p className="mt-2 text-lg font-semibold text-ink">{trustSummary.trustLabel}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{trustSummary.explanation}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {trustSummary.permissions.map((permission) => (
                  <span key={permission} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {permission}
                  </span>
                ))}
              </div>
              {trustSummary.nextStep ? <p className="mt-4 text-sm text-slate-500">Next step: {trustSummary.nextStep}</p> : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/get-started?step=setup${claimProfileId ? `&claimProfile=${encodeURIComponent(claimProfileId)}` : ""}`}
                className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Continue to Setup
              </Link>
              <Link
                href={`/get-started?step=verify${claimProfileId ? `&claimProfile=${encodeURIComponent(claimProfileId)}` : ""}`}
                className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Edit verification details
              </Link>
            </div>
          </div>
        ) : null}

        {step === "setup" ? (
          <form action={submitCommunityAndIssuesSetup} className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <input type="hidden" name="claimProfileId" value={claimProfileId} />
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Screen 4</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Choose your community and Top 3 issues</h3>
            <div className="mt-5 grid gap-4">
              <select name="selectedCommunityId" defaultValue={draft?.selectedCommunityId ?? ""} className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500">
                <option value="">Select a default community</option>
                {communities.map((community) => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
              {[0, 1, 2].map((index) => (
                <select
                  key={index}
                  name={`issue${index + 1}`}
                  defaultValue={draft?.topIssueTitles?.[index] ?? ""}
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                >
                  <option value="">Select an issue</option>
                  {issueOptions.map((issue) => (
                    <option key={issue} value={issue}>
                      {issue}
                    </option>
                  ))}
                </select>
              ))}
            </div>
            <button type="submit" className="mt-5 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Continue to Role Matching
            </button>
          </form>
        ) : null}

        {step === "role-match" ? (
          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Screen 5</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Role and public-profile matching</h3>
            {roleMatch ? (
              <div className="mt-5 rounded-3xl bg-white p-5">
                <p className="text-lg font-semibold text-ink">We found a public profile that may belong to you</p>
                <p className="mt-2 text-sm text-slate-500">
                  {roleMatch.roleLabel} · {roleMatch.jurisdictionName}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Candidate and official status are detected after identity verification. They are not chosen manually during signup, and claim continuation only clears when trust is strong enough for that higher-risk action.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/claim-profile/${roleMatch.profileId}`}
                    className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Continue to Claim Review
                  </Link>
                  <Link
                    href="/get-started?step=finish"
                    className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                  >
                    Finish as Citizen for now
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-3xl bg-white p-5 text-sm leading-7 text-slate-600">
                No candidate or official profile match was found from the verified identity data. You will continue as a citizen account unless a reviewed claim later becomes available.
              </div>
            )}
          </div>
        ) : null}

        {step === "finish" ? (
          <form action={finishGuidedOnboarding} className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <input type="hidden" name="claimProfileId" value={claimProfileId} />
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-civic-700">Screen 6</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Finish onboarding</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Your account now has a clearer civic starting point. If you matched to a public profile, you can continue that secure claim flow next. Otherwise you will enter the app as a citizen account.
            </p>
            <button type="submit" className="mt-5 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Enter the app
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-6 shadow-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Verification Trust Layer</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Why verification uses escalating trust instead of one hard wall</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
          Verification helps protect legitimacy without forcing every user through the highest-friction path. Most people should clear ordinary participation through strong voter matching, while higher-risk actions like profile claims or elevated roles can step up to stronger checks only when needed.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {trustLayers.map((layer) => (
            <article key={layer.label} className="rounded-[1.5rem] border border-civic-200 bg-white/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{layer.label}</p>
              <h3 className="mt-2 text-lg font-semibold text-ink">{layer.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{layer.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 rounded-[1.5rem] border border-civic-200 bg-white/80 p-5">
          <p className="text-sm font-semibold text-ink">Current onboarding trust state</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email</p>
              <p className="mt-2 text-sm font-semibold text-ink">{trustSummary.checks.emailStatus}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Phone</p>
              <p className="mt-2 text-sm font-semibold text-ink">{trustSummary.checks.phoneStatus}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Voter match</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {trustSummary.checks.voterMatchStatus} · {trustSummary.checks.voterMatchConfidence}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Escalation path</p>
              <p className="mt-2 text-sm font-semibold text-ink">
                {trustSummary.checks.enhancedIdentityStatus} / {trustSummary.checks.manualReviewStatus}
              </p>
            </div>
          </div>
        </div>
      </section>

      {showInternalTesting ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Dev Testing States</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Flip between realistic session states safely</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              These controls are dev-only. They let you test the public landing, new-user onboarding, and fully onboarded roles without manually breaking cookies or replacing seeded data.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {devStates.map((state) => (
              <form key={state.value} action={switchDevUser} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <input type="hidden" name="userId" value={state.value} />
                <input type="hidden" name="redirectTo" value={state.value === PUBLIC_SESSION_VALUE ? "/" : "/profile"} />
                <p className="text-base font-semibold text-ink">{state.label}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{state.description}</p>
                <button
                  type="submit"
                  className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                >
                  Use this state
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
