"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export const GOV_CRM_NAV_ITEMS = [
  { href: "/gov/dashboard", label: "Dashboard" },
  { href: "/gov/cases", label: "Cases" },
  { href: "/gov/submissions", label: "Submissions" },
  { href: "/gov/comments", label: "Comments" },
  { href: "/gov/documents", label: "Documents" },
  { href: "/gov/meetings", label: "Meetings" },
  { href: "/gov/reports", label: "Reports" },
  { href: "/gov/settings", label: "Settings" },
  { href: "/gov/audit-log", label: "Audit Log" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GovCrmSidebarNav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get("tenant");

  return (
    <nav className={`flex gap-1 ${orientation === "horizontal" ? "flex-row" : "flex-col"}`} aria-label="GovCRM navigation">
      {GOV_CRM_NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={tenantSlug ? `${item.href}?tenant=${tenantSlug}` : item.href}
            className={`flex min-h-10 shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
              active
                ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-50"
                : "border border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900 hover:text-white"
            }`}
          >
            <span>{item.label}</span>
            {active ? <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
