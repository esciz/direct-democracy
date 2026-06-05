import { redirect } from "next/navigation";

import { AuthEntryClient, WhyThisMattersInfographicTabs } from "@/components/domain/auth-entry-client";
import { Logo } from "@/components/ui/brand-logo";
import { isGuestUser } from "@/lib/auth/session";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

export default async function AuthPage() {
  const currentUser = await getCurrentSessionUser();

  if (currentUser && !isGuestUser(currentUser)) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)] lg:items-start">
        <section className="dd-panel relative overflow-hidden rounded-[2.2rem] p-6 sm:p-8 lg:sticky lg:top-32">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_30%)]" />
          <div className="relative">
            <Logo size="md" darkSurface />
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">CIVIC CLARITY FOR REAL LIFE</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
              Know what&apos;s happening, who&apos;s responsible, and what you can do next.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
              Direct Democracy turns local issues, elections, officials, and public action into one clear civic dashboard — so you can follow what matters without sorting through noise.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Track", "Follow issues, officials, candidates, and civic actions in one place."],
                ["Compare", "See positions, records, and community priorities side by side."],
                ["Act", "Vote, message, sign, attend, or share when there’s a real next step."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="font-semibold text-slate-50">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              Prototype demo. Not a government voting system.
            </p>
          </div>
        </section>

        <AuthEntryClient />
      </div>

      <WhyThisMattersInfographicTabs />
    </div>
  );
}
