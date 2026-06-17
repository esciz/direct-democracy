import { GovCrmPageShell, GovPlaceholderGrid } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovDashboardPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="GovCRM dashboard"
      description="Private operational overview for government staff. The dashboard starts with empty states until real organization workflow data exists."
    >
      <GovPlaceholderGrid />
    </GovCrmPageShell>
  );
}
