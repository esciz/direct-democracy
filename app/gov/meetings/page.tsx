import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovMeetingsPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Meetings"
      description="Meeting records will track agendas, minutes, video, transcript status, summaries, and related public comments."
    >
      <GovModuleEmptyState
        title="No meeting records yet"
        description="Meeting intelligence will read stored records and documents. It should not fetch, scrape, or summarize live during normal page render."
      />
    </GovCrmPageShell>
  );
}
