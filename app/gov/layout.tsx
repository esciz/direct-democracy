import Link from "next/link";
import type { ReactNode } from "react";

import { GovCrmSidebarNav } from "@/app/gov/_gov-shell-nav";
import { GovTenantShellHeader, GovTenantSidebarLabel } from "@/app/gov/_tenant-switcher";
import { requireGovCrmAccess } from "@/lib/govcrm/access";
import { getGovTenants } from "@/lib/govcrm/tenants";

export const dynamic = "force-dynamic";

export default async function GovCrmLayout({ children }: { children: ReactNode }) {
  await requireGovCrmAccess();
  const tenants = getGovTenants();

  return (
    <div className="min-h-screen bg-[#0a0f18] text-slate-100">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body { background: #0a0f18 !important; }
            .app-shell { max-width: none !important; padding: 0 !important; }
            .app-shell > header { display: none !important; }
            .app-shell > main { min-height: 100vh; }
            .app-shell > main ~ * { display: none !important; }
          `,
        }}
      />
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-[#090d14] lg:flex lg:flex-col">
          <div className="border-b border-slate-800 px-5 py-5">
            <Link href="/gov/dashboard" className="block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">GovCRM</p>
              <h1 className="mt-2 text-lg font-semibold tracking-tight text-white">Government Operations</h1>
            </Link>
            <GovTenantSidebarLabel tenants={tenants} />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <GovCrmSidebarNav />
          </div>
          <div className="border-t border-slate-800 p-4 text-xs leading-5 text-slate-500">
            References public civic records only. Public data remains source-attributed and protected.
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0a0f18]/95 backdrop-blur">
            <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <GovTenantShellHeader tenants={tenants} />
            </div>
            <div className="border-t border-slate-800 px-4 py-2 lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <GovCrmSidebarNav orientation="horizontal" />
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 bg-[#0c121d]">{children}</main>
        </div>
      </div>
    </div>
  );
}
