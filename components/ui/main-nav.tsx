import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/ui/brand-logo";
import { DevRoleSwitcher } from "@/components/ui/dev-role-switcher";
import { NavLinks } from "@/components/ui/nav-links";
import { NotificationMenu } from "@/components/ui/notification-menu";
import { getRoleLabel } from "@/lib/auth/roles";
import { getAllSeedUsers, isGuestUser } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/server/auth-session";

function NotificationMenuFallback() {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
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

function MobileDevTools({
  currentUserId,
  users,
}: {
  currentUserId: string | null;
  users: ReturnType<typeof getAllSeedUsers>;
}) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white/85 p-3 md:hidden">
      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        Demo Controls
      </summary>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Early tester controls. Switch between seeded profiles to preview verification, jurisdiction, and voting states.
      </p>
      <div className="mt-3">
        <DevRoleSwitcher currentUserId={currentUserId} users={users} />
      </div>
    </details>
  );
}

export async function MainNav() {
  const currentUser = await getCurrentUser();
  const users = getAllSeedUsers();
  const guestMode = isGuestUser(currentUser);

  if (guestMode && currentUser) {
    return (
      <header className="sticky top-0 z-20 mb-6 pt-1 sm:mb-8 sm:pt-3">
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-white/80 bg-white/92 px-4 py-4 shadow-card backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-5 lg:py-5">
          <div className="flex items-center justify-between gap-5">
            <Link href="/" className="flex items-center">
              <Logo size="sm" />
            </Link>
            <Link
              href="/voting"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 md:hidden"
            >
              Vote Now
            </Link>
          </div>

          <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <NavLinks />
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Guest Browse · Read only
                </span>
                <Link
                  href="/get-started?step=account"
                  className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Get Started
                </Link>
                <Link
                  href="/get-started?step=account"
                  className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
                >
                  Verify to Participate
                </Link>
              </div>
              <p className="text-xs text-slate-500">Browsing is open. Voting, messaging, commenting, and creation require a verified account.</p>
              <MobileDevTools currentUserId={currentUser.id} users={users} />
              <div className="hidden md:block">
                <DevRoleSwitcher currentUserId={currentUser.id} users={users} />
              </div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 mb-6 pt-1 sm:mb-8 sm:pt-3">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-white/80 bg-white/92 px-4 py-4 shadow-card backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-5 lg:py-5">
        <div className="flex items-center justify-between gap-5">
          <Link href="/" className="flex items-center">
            <Logo size="sm" />
          </Link>
          <Link
            href="/voting"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a,#0f766e)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_-18px_rgba(15,23,42,0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-20px_rgba(15,23,42,0.76)] md:hidden"
          >
            Vote Now
          </Link>
        </div>

        <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <NavLinks />

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/messages"
                aria-label="Messages"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
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
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                {currentUser.name}
              </span>
              <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
                Current role: {getRoleLabel(currentUser.role)}
              </span>
            </div>
            <MobileDevTools currentUserId={currentUser.id} users={users} />
            <div className="hidden md:block">
              <DevRoleSwitcher currentUserId={currentUser.id} users={users} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
