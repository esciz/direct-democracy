import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/ui/brand-logo";
import { NavLinks } from "@/components/ui/nav-links";
import { NotificationMenu } from "@/components/ui/notification-menu";
import { signOutCurrentUser } from "@/lib/auth/actions";
import { getRoleLabel } from "@/lib/auth/roles";
import { isGuestUser } from "@/lib/auth/session";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

function NotificationMenuFallback() {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300">
      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
        <path
          d="M10 3.5a4 4 0 0 0-4 4V9.4c0 .6-.2 1.18-.58 1.65L4 12.8h12l-1.42-1.75A2.62 2.62 0 0 1 14 9.4V7.5a4 4 0 0 0-4-4Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8.25 14.5a1.75 1.75 0 0 0 3.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Notifications</span>
    </span>
  );
}

export async function MainNav() {
  const currentSessionUser = await getCurrentSessionUser();

  if (!currentSessionUser) {
    return (
      <header className="sticky top-0 z-20 mb-6 pt-1 sm:mb-8 sm:pt-3">
        <div className="dd-panel flex flex-col gap-4 rounded-[1.75rem] px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-5 lg:py-5">
          <div className="flex items-center justify-between gap-5">
            <Link href="/" className="flex items-center">
              <Logo size="sm" darkSurface />
            </Link>
            <Link
              href="/voting"
              className="dd-button-primary inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 md:hidden"
            >
              Vote Now
            </Link>
          </div>

          <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <NavLinks />
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                  Logged out · Public landing
                </span>
                <Link
                  href="/auth"
                  className="dd-button-primary inline-flex rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth"
                  className="dd-button-secondary inline-flex rounded-full px-4 py-3 text-sm font-semibold transition hover:border-cyan-300/30 hover:text-white"
                >
                  Create account
                </Link>
              </div>
              <p className="text-xs text-slate-400">Create an account to vote, message officials, save items, and build your civic dashboard.</p>
            </div>
          </div>
        </div>
      </header>
    );
  }

  const currentUser = currentSessionUser;

  if (isGuestUser(currentUser)) {
    return (
      <header className="sticky top-0 z-20 mb-6 pt-1 sm:mb-8 sm:pt-3">
        <div className="dd-panel flex flex-col gap-4 rounded-[1.75rem] px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-5 lg:py-5">
          <div className="flex items-center justify-between gap-5">
            <Link href="/" className="flex items-center">
              <Logo size="sm" darkSurface />
            </Link>
            <Link
              href="/voting"
              className="dd-button-primary inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 md:hidden"
            >
              Vote Now
            </Link>
          </div>

          <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <NavLinks />
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-300/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                  Guest Browse · Read only
                </span>
                <Link
                  href="/auth"
                  className="dd-button-primary inline-flex rounded-full px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth"
                  className="dd-button-secondary inline-flex rounded-full px-4 py-3 text-sm font-semibold transition hover:border-cyan-300/30 hover:text-white"
                >
                  Create account
                </Link>
              </div>
              <p className="text-xs text-slate-400">Browsing is open. Voting, messaging, commenting, and creation require a verified account.</p>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 mb-6 pt-1 sm:mb-8 sm:pt-3">
      <div className="dd-panel flex flex-col gap-4 rounded-[1.75rem] px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-5 lg:py-5">
        <div className="flex items-center justify-between gap-5">
          <Link href="/" className="flex items-center">
            <Logo size="sm" darkSurface />
          </Link>
          <Link
            href="/voting"
            className="dd-button-primary inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 md:hidden"
          >
            Vote Now
          </Link>
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <NavLinks />

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/private-beta"
                className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-400/15"
              >
                Beta Hub
              </Link>
              <Link
                href="/messages"
                aria-label="Messages"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-emerald-300/30 hover:text-emerald-200"
              >
                <span className="relative inline-flex h-5 w-5 items-center justify-center">
                  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                    <path
                      d="M3.75 5.75h12.5c.69 0 1.25.56 1.25 1.25v6c0 .69-.56 1.25-1.25 1.25H3.75A1.25 1.25 0 0 1 2.5 13V7c0-.69.56-1.25 1.25-1.25Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m3 6.5 6.2 4.65a1.4 1.4 0 0 0 1.6 0L17 6.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="sr-only">Messages</span>
              </Link>
              <Suspense fallback={<NotificationMenuFallback />}>
                <NotificationMenu userId={currentUser.id} />
              </Suspense>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                {currentUser.name}
              </span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                Current role: {getRoleLabel(currentUser.role)}
              </span>
              <form action={signOutCurrentUser}>
                <button
                  type="submit"
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-300/30 hover:text-rose-100"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
