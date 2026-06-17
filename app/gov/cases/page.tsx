import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovCasesPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Constituent cases"
      description="Casework will track requests by organization, issue, district, status, priority, assignment, and public visibility."
    >
      <GovModuleEmptyState
        title="No constituent cases yet"
        description="Future cases will be linked to stored civic graph records where available. Case categorization must not overwrite public issues, actions, districts, or sentiment."
      />
    </GovCrmPageShell>
  );
}
