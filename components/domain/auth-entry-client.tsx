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

const initialState: AuthFormState = {
  status: "idle",
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
        This starts a Nevada-focused onboarding path. Voter verification, residency review, local issues, events, elections, and civic actions are only available or locally relevant for Nevada residents right now.
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
          Create an account to follow the issues, elections, officials, and actions that matter where you live. During this beta, location-specific civic features are focused on Nevada.
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
