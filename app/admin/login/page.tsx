import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAdminAction } from "@/lib/admin/auth-actions";
import { getAdminAuthConfigurationIssues, getAdminSession } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

type AdminLoginSearchParams = {
  error?: string;
  loggedOut?: string;
  next?: string;
};

type AdminLoginPageProps = {
  searchParams?: Promise<AdminLoginSearchParams>;
};

function getErrorMessage(error: string | undefined) {
  if (error === "config") {
    return "Admin authentication is not configured on this environment.";
  }

  if (error === "credentials") {
    return "The email or password was not accepted.";
  }

  return null;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const session = await getAdminSession();
  const params: AdminLoginSearchParams = searchParams ? await searchParams : {};

  if (session) {
    redirect("/admin");
  }

  const configurationIssues = getAdminAuthConfigurationIssues();
  const errorMessage = getErrorMessage(params.error);
  const nextPath = params.next?.startsWith("/admin") && !params.next.startsWith("/admin/login") ? params.next : "/admin";

  return (
    <div className="mx-auto flex min-h-[72vh] w-full max-w-xl items-center py-10">
      <section className="w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Direct Democracy operations</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-50">Admin sign in</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Use the dedicated administrator credentials configured for this environment. Demo profile credentials do not grant admin access.
        </p>

        {params.loggedOut ? (
          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            You have been signed out.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm text-rose-100">{errorMessage}</div>
        ) : null}

        {configurationIssues.length > 0 ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            <p className="font-semibold">Environment setup required</p>
            <ul className="mt-2 list-disc pl-5">
              {configurationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <form action={loginAdminAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Admin email</span>
            <input
              required
              autoComplete="username"
              inputMode="email"
              name="email"
              type="email"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring-2"
              placeholder="admin@example.org"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Password</span>
            <input
              required
              autoComplete="current-password"
              minLength={16}
              name="password"
              type="password"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            disabled={configurationIssues.length > 0}
            className="dd-button-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sign in to operations
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5 text-sm text-slate-400">
          <Link href="/" className="font-semibold text-cyan-200 hover:text-cyan-100">
            Return to the public site
          </Link>
        </div>
      </section>
    </div>
  );
}
