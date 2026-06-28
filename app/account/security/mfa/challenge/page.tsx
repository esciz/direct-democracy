import Link from "next/link";
import { redirect } from "next/navigation";

import { MfaChallengeForm } from "@/components/domain/mfa-challenge-form";
import { getIdentityAccountById } from "@/lib/identity/accounts";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

export default async function MfaChallengePage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/auth");
  const account = getIdentityAccountById(user.id);
  if (!account) redirect("/auth");
  if (account.mfaEnrollmentRequired || !account.mfaEnabled) redirect("/account/security/mfa/enroll");

  return (
    <main className="mx-auto max-w-2xl py-10">
      <section className="dd-panel rounded-[2rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Account security</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">Confirm MFA</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Enter a six-digit authenticator code or one unused recovery code. Password-only sessions cannot access admin pages or admin APIs.
        </p>
        <MfaChallengeForm />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/profile" className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200">
            Back to profile
          </Link>
        </div>
      </section>
    </main>
  );
}
