"use client";

import { useActionState } from "react";
import Link from "next/link";

import { confirmMfaEnrollmentAction, type MfaActionState } from "@/app/account/security/mfa/actions";

const initialState: MfaActionState = { status: "idle" };

export function MfaEnrollmentForm() {
  const [state, action, pending] = useActionState(confirmMfaEnrollmentAction, initialState);

  return (
    <div className="mt-6 space-y-5">
      {state.message ? (
        <div className={`rounded-2xl border p-4 text-sm ${state.status === "success" ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : "border-rose-300/20 bg-rose-500/10 text-rose-100"}`}>
          {state.message}
        </div>
      ) : null}

      {state.status === "success" && state.recoveryCodes?.length ? (
        <section className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-100">Recovery codes</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">Save these securely now. Each code works once, and they will not be shown again.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {state.recoveryCodes.map((code) => (
              <code key={code} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100">
                {code}
              </code>
            ))}
          </div>
          <Link href="/admin" className="mt-5 inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">
            Continue to Admin Dashboard
          </Link>
        </section>
      ) : (
        <form action={action} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-100">
            Six-digit code
            <input name="code" inputMode="numeric" pattern="[0-9\\s-]*" autoComplete="one-time-code" required className="dd-input mt-2 min-h-12 w-full rounded-2xl px-4 py-3 text-sm" />
          </label>
          <button disabled={pending} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {pending ? "Confirming..." : "Confirm and enable MFA"}
          </button>
        </form>
      )}
    </div>
  );
}
