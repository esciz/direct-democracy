import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovSettingsPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Settings"
      description="Organization settings will eventually manage subscriptions, staff roles, routing rules, visibility defaults, exports, and audit controls."
    >
      <GovModuleEmptyState
        title="Settings pending"
        description="Government staff roles are documented for the future. Until those roles are added to auth, GovCRM access is controlled by GOV_CRM_ENABLED only."
      />
    </GovCrmPageShell>
  );
}
