import Link from "next/link";
import { redirect } from "next/navigation";

import { changeCurrentPasswordFromForm, signOutCurrentUser } from "@/lib/auth/actions";
import { getIdentityAccountById } from "@/lib/identity/accounts";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

export default async function ChangePasswordPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const user = await getCurrentSessionUser();
  if (!user) redirect("/auth");
  const account = getIdentityAccountById(user.id);

  return (
    <main className="mx-auto max-w-2xl py-10">
      <section className="dd-panel rounded-[2rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Account security</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">Change your temporary password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Owner-admin bootstrap passwords are temporary. Change it now before using admin tools.
          {account?.mfaEnrollmentRequired ? " MFA enrollment is marked required; provider enforcement still needs production configuration." : ""}
        </p>
        {query?.error ? (
          <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-100">
            The password could not be changed. Check your current password and use at least 12 characters.
          </p>
        ) : null}
        <form action={changeCurrentPasswordFromForm} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-100">
            Current temporary password
            <input name="currentPassword" type="password" autoComplete="current-password" required className="dd-input mt-2 min-h-12 w-full rounded-2xl px-4 py-3 text-sm" />
          </label>
          <label className="block text-sm font-semibold text-slate-100">
            New password
            <input name="nextPassword" type="password" autoComplete="new-password" required minLength={12} className="dd-input mt-2 min-h-12 w-full rounded-2xl px-4 py-3 text-sm" />
          </label>
          <label className="block text-sm font-semibold text-slate-100">
            Confirm new password
            <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} className="dd-input mt-2 min-h-12 w-full rounded-2xl px-4 py-3 text-sm" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950">Change password</button>
            <Link href="/admin/operations" className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200">
              Admin console
            </Link>
          </div>
        </form>
        <form action={signOutCurrentUser} className="mt-5">
          <button className="text-sm font-semibold text-slate-400 hover:text-slate-100">Sign out instead</button>
        </form>
      </section>
    </main>
  );
}
