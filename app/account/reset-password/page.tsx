import { ResetPasswordForm } from "@/components/domain/reset-password-form";

export const metadata = { title: "Reset password | Direct Democracy", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return <main className="mx-auto max-w-lg py-10"><section className="dd-panel rounded-[2rem] p-6 sm:p-8"><h1 className="text-2xl font-semibold text-slate-50">Reset your password</h1><p className="mt-3 text-sm leading-6 text-slate-300">Choose a new password. Resetting your password signs out your existing sessions.</p><ResetPasswordForm token={/^[A-Za-z0-9_-]{43}$/.test(token) ? token : ""} /></section></main>;
}
