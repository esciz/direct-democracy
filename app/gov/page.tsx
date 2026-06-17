import Link from "next/link";

import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovCrmHomePage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="GovCRM"
      description="A private government workflow layer for constituent cases, public comments, meetings, reports, and transparency operations."
    >
      <GovModuleEmptyState
        title="Government workspace pending setup"
        description="GovCRM is scaffolded as a separate product surface. It will connect to issues, districts, officials, meetings, and public sentiment by reference while preserving the public civic record."
      />
      <Link
        href="/gov/dashboard"
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-emerald-300 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
      >
        Open dashboard
      </Link>
    </GovCrmPageShell>
  );
}
