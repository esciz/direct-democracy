import Link from "next/link";
import { redirect } from "next/navigation";

import { MfaEnrollmentForm } from "@/components/domain/mfa-enrollment-form";
import { getIdentityAccountById, startMfaEnrollment } from "@/lib/identity/accounts";
import { buildOtpAuthUri, createPseudoQrSvgDataUri, decryptMfaSecret, getMfaConfigurationStatus } from "@/lib/identity/mfa";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

export default async function MfaEnrollPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/auth");
  const account = getIdentityAccountById(user.id);
  if (!account) redirect("/auth");
  const status = getMfaConfigurationStatus();
  const isConfigured = status === "configured";
  let manualKey: string | null = null;
  let qrDataUri: string | null = null;
  let otpauthUri: string | null = null;

  if (isConfigured && account.mfaEnabled && !account.mfaEnrollmentRequired) {
    redirect("/account/security/mfa/challenge");
  }

  if (isConfigured) {
    const enrollment = startMfaEnrollment(user.id);
    if (enrollment.ok) {
      manualKey = decryptMfaSecret(enrollment.encryptedSecret);
      otpauthUri = buildOtpAuthUri({ email: account.email, secret: manualKey });
      qrDataUri = createPseudoQrSvgDataUri(otpauthUri);
    }
  }

  return (
    <main className="mx-auto max-w-2xl py-10">
      <section className="dd-panel rounded-[2rem] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Account security</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50">Admin MFA enrollment</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Admin accounts must enroll a time-based authenticator before full admin access. Submissions and recovery codes are held behind the local identity security boundary.
        </p>

        {!isConfigured ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            <p className="font-semibold">MFA encryption is not configured.</p>
            {process.env.NODE_ENV === "production" ? (
              <p className="mt-2">Ask an operator to configure the MFA encryption key before enrolling admin accounts.</p>
            ) : (
              <p className="mt-2">
                Run <code className="rounded bg-slate-950/60 px-2 py-1">npm run mfa:configure-local</code>, then restart the dev server and return here.
              </p>
            )}
          </div>
        ) : manualKey && qrDataUri && otpauthUri ? (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-[13rem_1fr]">
              <div className="rounded-2xl border border-white/10 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUri} alt="Authenticator setup visual" className="h-full w-full" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-sm font-semibold text-slate-100">Manual setup key</p>
                <code className="mt-3 block break-all rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-cyan-100">{manualKey}</code>
                <p className="mt-3 text-xs leading-5 text-slate-400">
                  Use the setup link or copy the manual key into an authenticator app, then enter the current six-digit code. The enrollment secret is encrypted at rest and reused only for the active enrollment window.
                </p>
                <a href={otpauthUri} className="mt-3 inline-flex text-sm font-semibold text-cyan-200">
                  Open authenticator setup link
                </a>
              </div>
            </div>
            <MfaEnrollmentForm />
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            MFA enrollment could not be started. Refresh this page or reset MFA from a trusted terminal.
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/account/security/change-password" className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200">
            Change password
          </Link>
          <Link href="/profile" className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-200">
            Back to profile
          </Link>
        </div>
      </section>
    </main>
  );
}
