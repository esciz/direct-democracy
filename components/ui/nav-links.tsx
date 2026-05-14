"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type PrimaryNavItem = {
  href: string;
  label: string;
  matches: string[];
};

type MobileNavItem = PrimaryNavItem & {
  icon: "home" | "vote" | "explore" | "profile" | "messages";
};

export const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  {
    href: "/",
    label: "Home",
    matches: ["/", "/take-action", "/feed", "/community-pulse"],
  },
  {
    href: "/voting",
    label: "Vote",
    matches: ["/voting"],
  },
  {
    href: "/explore",
    label: "Explore",
    matches: [
      "/explore",
      "/communities",
      "/campuses",
      "/organizations",
      "/people",
      "/officials",
      "/candidates",
      "/elections",
      "/cases",
      "/petitions",
      "/schools",
      "/events",
      "/services",
      "/top-issues",
      "/issues",
      "/debates",
    ],
  },
  {
    href: "/profile",
    label: "Profile",
    matches: ["/profile"],
  },
];

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    href: "/",
    label: "Home",
    matches: ["/", "/take-action", "/feed", "/community-pulse"],
    icon: "home",
  },
  {
    href: "/vote",
    label: "Vote",
    matches: ["/vote", "/voting"],
    icon: "vote",
  },
  {
    href: "/explore",
    label: "Explore",
    matches: [
      "/explore",
      "/communities",
      "/campuses",
      "/organizations",
      "/people",
      "/officials",
      "/candidates",
      "/elections",
      "/cases",
      "/petitions",
      "/schools",
      "/events",
      "/services",
      "/top-issues",
      "/issues",
      "/debates",
    ],
    icon: "explore",
  },
  {
    href: "/profile",
    label: "Profile",
    matches: ["/profile"],
    icon: "profile",
  },
  {
    href: "/messages",
    label: "Messages",
    matches: ["/messages"],
    icon: "messages",
  },
];

function isNavItemActive(pathname: string, matches: string[]) {
  return matches.some((match) => pathname === match || pathname.startsWith(`${match}/`));
}

function MobileNavIcon({ icon }: { icon: MobileNavItem["icon"] }) {
  switch (icon) {
    case "home":
      return (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M3.5 8.5 10 3.5l6.5 5v7a1 1 0 0 1-1 1h-3.25v-4.25h-4.5v4.25H4.5a1 1 0 0 1-1-1v-7Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "vote":
      return (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="M4.25 5.25h11.5v9.5H4.25z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="m7 9.75 1.75 1.75L13 7.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "explore":
      return (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
          <circle cx="9" cy="9" r="4.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="m12.5 12.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "messages":
      return (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M3.75 5.75h12.5c.69 0 1.25.56 1.25 1.25v6c0 .69-.56 1.25-1.25 1.25H7l-3.25 2V7c0-.69.56-1.25 1.25-1.25Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="m4.5 6.75 4.9 3.68a1.1 1.1 0 0 0 1.2 0l4.9-3.68"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
          <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.75 16a5.25 5.25 0 0 1 10.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="hidden flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 md:flex">
      {PRIMARY_NAV_ITEMS.map((link) => {
        const isActive = isNavItemActive(pathname, link.matches);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-[linear-gradient(135deg,rgba(52,211,153,0.92),rgba(34,211,238,0.82))] text-slate-950 shadow-[0_14px_28px_-18px_rgba(45,212,191,0.75)]"
                : "text-slate-300 hover:bg-white/8 hover:text-white"
            }`}
          >
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav fixed inset-x-3 z-30 rounded-[1.4rem] border border-white/10 bg-[rgba(5,11,22,0.92)] p-1 shadow-[0_24px_50px_-26px_rgba(2,8,23,0.95)] backdrop-blur md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {MOBILE_NAV_ITEMS.map((link) => {
          const isActive = isNavItemActive(pathname, link.matches);

          return (
            <Link
              key={`mobile-${link.href}`}
              href={link.href}
              className={`rounded-[1.05rem] px-1.5 py-2 text-center text-[11px] font-semibold transition ${
                isActive
                  ? "bg-[linear-gradient(135deg,rgba(52,211,153,0.92),rgba(34,211,238,0.84))] text-slate-950 shadow-[0_14px_28px_-18px_rgba(45,212,191,0.7)]"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex flex-col items-center gap-1">
                <MobileNavIcon icon={link.icon} />
                <span>{link.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
