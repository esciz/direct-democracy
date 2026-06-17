import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovCommentsPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Public comments"
      description="Comment workflows will support review, meeting linkage, issue categorization, and auditable handling without suppressing public criticism."
    >
      <GovModuleEmptyState
        title="No public comments routed"
        description="Imported or submitted comments will appear here after real organization workflows exist. Moderation and review actions must remain auditable."
      />
    </GovCrmPageShell>
  );
}
