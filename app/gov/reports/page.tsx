import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovReportsPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Reports"
      description="Transparency reports will summarize real workflow activity, response times, district activity, issue categories, and published official responses."
    >
      <GovModuleEmptyState
        title="No reports generated"
        description="Reports will be built from stored GovCRM workflow records and public civic graph references. They cannot revise public voting data or public sentiment."
      />
    </GovCrmPageShell>
  );
}
