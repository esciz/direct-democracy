"use client";

import { useActionState } from "react";
import Link from "next/link";

import { confirmMfaChallengeAction, type MfaActionState } from "@/app/account/security/mfa/actions";

const initialState: MfaActionState = { status: "idle" };

export function MfaChallengeForm() {
  const [state, action, pending] = useActionState(confirmMfaChallengeAction, initialState);

  return (
    <div className="mt-6 space-y-5">
      {state.message ? (
        <div className={`rounded-2xl border p-4 text-sm ${state.status === "success" ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" : "border-rose-300/20 bg-rose-500/10 text-rose-100"}`}>
          {state.message}
        </div>
      ) : null}
      {state.status === "success" ? (
        <Link href="/admin" className="inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">
          Continue to Admin Dashboard
        </Link>
      ) : (
        <form action={action} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-100">
            Authenticator or recovery code
            <input name="code" autoComplete="one-time-code" required className="dd-input mt-2 min-h-12 w-full rounded-2xl px-4 py-3 text-sm" />
          </label>
          <button disabled={pending} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {pending ? "Confirming..." : "Confirm MFA"}
          </button>
        </form>
      )}
    </div>
  );
}
