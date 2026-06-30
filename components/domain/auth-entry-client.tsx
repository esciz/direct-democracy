"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  type AuthFormState,
  registerDemoAccount,
  requestDemoPasswordReset,
  signInWithDemoCredentials,
  startGuestBrowsing,
} from "@/lib/auth/actions";

type AuthView = "sign-in" | "register" | "forgot";
type InfographicTopic = "money" | "awareness";

const initialState: AuthFormState = {
  status: "idle",
};

const infographicTopics: Record<
  InfographicTopic,
  {
    id: InfographicTopic;
    label: string;
    title: string;
    description: string;
    src: string;
    iframeTitle: string;
  }
> = {
  money: {
    id: "money",
    label: "Money in Politics",
    title: "Money in Politics",
    description: "See how outside spending, super PACs, and dark money shape political attention.",
    src: "/infographics/money-in-politics.html",
    iframeTitle: "Money in Politics animated infographic",
  },
  awareness: {
    id: "awareness",
    label: "The Awareness Gap",
    title: "The Awareness Gap",
    description: "See why voters face too much noise, too little local context, and rising verification costs.",
    src: "/infographics/awareness-gap.html",
    iframeTitle: "Awareness Gap animated infographic",
  },
};

function FieldError({ message, id }: { message?: string; id: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="text-sm font-medium text-red-200">
      {message}
    </p>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="dd-button-primary inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function FormMessage({ state }: { state: AuthFormState }) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
        state.status === "success"
          ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
          : "border-red-300/25 bg-red-500/10 text-red-100"
      }`}
    >
      {state.message}
    </div>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const [state, action] = useActionState(signInWithDemoCredentials, initialState);
  const emailErrorId = useId();
  const passwordErrorId = useId();

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="space-y-2">
        <label htmlFor="sign-in-email" className="text-sm font-semibold text-slate-100">
          Email
        </label>
        <input
          id="sign-in-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby={state.fieldErrors?.email ? emailErrorId : undefined}
          className="dd-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          placeholder="alicia.hart@directdemocracy.local"
          required
        />
        <FieldError id={emailErrorId} message={state.fieldErrors?.email} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="sign-in-password" className="text-sm font-semibold text-slate-100">
            Password
          </label>
          <button type="button" onClick={onForgot} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
            Forgot password?
          </button>
        </div>
        <input
          id="sign-in-password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-describedby={state.fieldErrors?.password ? passwordErrorId : undefined}
          className="dd-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          placeholder="Your password"
          required
        />
        <FieldError id={passwordErrorId} message={state.fieldErrors?.password} />
      </div>

      <SubmitButton label="Sign in" pendingLabel="Signing in..." />
    </form>
  );
}

function RegisterForm() {
  const [state, action] = useActionState(registerDemoAccount, initialState);
  const nameErrorId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const confirmPasswordErrorId = useId();

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="space-y-2">
        <label htmlFor="register-name" className="text-sm font-semibold text-slate-100">
          Full name
        </label>
        <input
          id="register-name"
          name="fullName"
          autoComplete="name"
          aria-describedby={state.fieldErrors?.fullName ? nameErrorId : undefined}
          className="dd-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          placeholder="Your name"
          required
        />
        <FieldError id={nameErrorId} message={state.fieldErrors?.fullName} />
      </div>

      <div className="space-y-2">
        <label htmlFor="register-email" className="text-sm font-semibold text-slate-100">
          Email
        </label>
        <input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby={state.fieldErrors?.email ? emailErrorId : undefined}
          className="dd-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          placeholder="you@example.com"
          required
        />
        <FieldError id={emailErrorId} message={state.fieldErrors?.email} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="register-password" className="text-sm font-semibold text-slate-100">
            Password
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            aria-describedby={state.fieldErrors?.password ? passwordErrorId : undefined}
            className="dd-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
            placeholder="8+ characters"
            required
          />
          <FieldError id={passwordErrorId} message={state.fieldErrors?.password} />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-confirm-password" className="text-sm font-semibold text-slate-100">
            Confirm password
          </label>
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-describedby={state.fieldErrors?.confirmPassword ? confirmPasswordErrorId : undefined}
            className="dd-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
            placeholder="Repeat password"
            required
          />
          <FieldError id={confirmPasswordErrorId} message={state.fieldErrors?.confirmPassword} />
        </div>
      </div>

      <SubmitButton label="Create my civic dashboard" pendingLabel="Creating dashboard..." />
      <p className="text-xs leading-5 text-slate-500">
        This starts a verification-ready onboarding path. Voter verification may require guided review when official records are not indexed.
      </p>
    </form>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [state, action] = useActionState(requestDemoPasswordReset, initialState);
  const emailErrorId = useId();

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="space-y-2">
        <label htmlFor="reset-email" className="text-sm font-semibold text-slate-100">
          Email
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby={state.fieldErrors?.email ? emailErrorId : undefined}
          className="dd-input min-h-12 w-full rounded-2xl px-4 py-3 text-sm outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
          placeholder="you@example.com"
          required
        />
        <FieldError id={emailErrorId} message={state.fieldErrors?.email} />
      </div>

      <SubmitButton label="Send reset link" pendingLabel="Sending..." />
      <button type="button" onClick={onBack} className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
        Back to sign in
      </button>
    </form>
  );
}

export function AuthEntryClient({ demoEnabled = false }: { demoEnabled?: boolean }) {
  const [view, setView] = useState<AuthView>("register");

  return (
    <section className="dd-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">DIRECT DEMOCRACY</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Start with your civic dashboard</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
          Create an account to follow the issues, elections, officials, and actions that matter where you live.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-black/20 p-1" role="tablist" aria-label="Authentication options">
          {[
            { id: "register" as const, label: "Create account" },
            { id: "sign-in" as const, label: "Sign in" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={view === tab.id}
              onClick={() => setView(tab.id)}
              className={`rounded-full px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-cyan-300/40 ${
                view === tab.id ? "bg-[linear-gradient(135deg,#34d399,#22d3ee)] text-slate-950" : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {view === "sign-in" ? <SignInForm onForgot={() => setView("forgot")} /> : null}
          {view === "register" ? <RegisterForm /> : null}
          {view === "forgot" ? <ForgotPasswordForm onBack={() => setView("sign-in")} /> : null}
        </div>

        {demoEnabled ? (
          <div className="mt-6 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <form action={startGuestBrowsing} className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm leading-6 text-slate-400">
                Want to look around first? Browse the public demo in read-only mode.
              </p>
              <button
                type="submit"
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/25 hover:text-cyan-100"
              >
                Preview the app
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function WhyThisMattersInfographicTabs() {
  const [activeTopic, setActiveTopic] = useState<InfographicTopic>("money");
  const active = infographicTopics[activeTopic];

  return (
    <section className="dd-panel relative overflow-hidden rounded-[2.2rem] p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.13),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(52,211,153,0.12),transparent_32%)]" />
      <div className="relative">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">WHY THIS MATTERS</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Why Direct Democracy matters now</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
            Politics is noisy by design. Money amplifies some voices, misinformation spreads faster than context, and voters are left to piece together what matters locally. Direct Democracy organizes the signal: issues, people, votes, deadlines, and actions in one place.
          </p>
        </div>

        <div className="mt-7 grid gap-3 rounded-[1.6rem] border border-white/10 bg-black/20 p-2 sm:grid-cols-2" role="tablist" aria-label="Why this matters infographics">
          {(Object.keys(infographicTopics) as InfographicTopic[]).map((topicId) => {
            const topic = infographicTopics[topicId];
            const isActive = activeTopic === topicId;

            return (
              <button
                key={topic.id}
                id={`why-tab-${topic.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`why-panel-${topic.id}`}
                onClick={() => setActiveTopic(topic.id)}
                className={`rounded-[1.25rem] p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-300/40 ${
                  isActive
                    ? "border border-emerald-300/25 bg-emerald-400/10 text-slate-50 shadow-[0_20px_45px_-30px_rgba(52,211,153,0.95)]"
                    : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span className="block text-sm font-semibold">{topic.label}</span>
                <span className="mt-2 block text-xs leading-5 text-slate-400">{topic.description}</span>
              </button>
            );
          })}
        </div>

        <div
          id={`why-panel-${active.id}`}
          role="tabpanel"
          aria-labelledby={`why-tab-${active.id}`}
          className="mt-5"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Selected explainer</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-50">{active.title}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{active.description}</p>
            </div>
            <a
              href={active.src}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/30 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              Open full screen
            </a>
          </div>

          <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#020817] shadow-[0_28px_80px_-48px_rgba(34,211,238,0.65)]">
            <iframe
              key={active.src}
              src={active.src}
              title={active.iframeTitle}
              className="block min-h-[72vh] w-full border-0 md:min-h-[760px] lg:min-h-[880px] xl:min-h-[920px]"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
