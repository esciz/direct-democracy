import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovSubmissionsPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Submissions"
      description="Staff-facing queue for service requests, filings, public comments, uploaded PDFs, and resident requests."
    >
      <GovModuleEmptyState
        title="No resident submissions"
        description="Real submissions will appear here with status, priority, tracking code, extracted fields, documents, and staff tasks. No fake submissions are seeded."
      />
    </GovCrmPageShell>
  );
}
