"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetAccountPassword, type AuthFormState } from "@/lib/auth/actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetAccountPassword, { status: "idle" } as AuthFormState);
  if (!token) return <div className="mt-6 space-y-4"><p className="text-sm text-amber-100">This reset link is invalid. Request a new link from the sign-in page.</p><Link href="/auth" className="font-semibold text-cyan-200">Back to sign in</Link></div>;
  return <form action={action} className="mt-6 space-y-4">
    <input type="hidden" name="token" value={token} />
    {state.message ? <p role="status" aria-live="polite" className={`rounded-2xl border p-4 text-sm ${state.status === "success" ? "border-emerald-300/25 text-emerald-100" : "border-rose-300/25 text-rose-100"}`}>{state.message}</p> : null}
    {state.status !== "success" ? <>
      <label className="block space-y-2 text-sm font-semibold text-slate-100"><span>New password</span><input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={256} className="dd-input min-h-12 w-full rounded-2xl px-4" aria-describedby={state.fieldErrors?.password ? "reset-password-error" : undefined} /></label>
      {state.fieldErrors?.password ? <p id="reset-password-error" className="text-sm text-rose-200">{state.fieldErrors.password}</p> : null}
      <label className="block space-y-2 text-sm font-semibold text-slate-100"><span>Confirm new password</span><input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={256} className="dd-input min-h-12 w-full rounded-2xl px-4" aria-describedby={state.fieldErrors?.confirmPassword ? "reset-confirm-error" : undefined} /></label>
      {state.fieldErrors?.confirmPassword ? <p id="reset-confirm-error" className="text-sm text-rose-200">{state.fieldErrors.confirmPassword}</p> : null}
      <button type="submit" disabled={pending} className="dd-button-primary min-h-12 w-full rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60">{pending ? "Resetting…" : "Reset password"}</button>
    </> : null}
    <Link href="/auth" className="inline-block text-sm font-semibold text-cyan-200">Back to sign in</Link>
  </form>;
}
