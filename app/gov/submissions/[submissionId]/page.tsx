import { notFound } from "next/navigation";

import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

type GovSubmissionDetailPageProps = {
  params: Promise<{ submissionId: string }>;
};

export const dynamic = "force-dynamic";

export default async function GovSubmissionDetailPage({ params }: GovSubmissionDetailPageProps) {
  await requireGovCrmAccess();
  const { submissionId } = await params;
  if (!submissionId) notFound();

  return (
    <GovCrmPageShell
      title="Submission detail"
      description="Detailed submission processing will show documents, extracted fields, staff tasks, routing, notes, and public tracking status."
    >
      <GovModuleEmptyState
        title="Submission record not found"
        description="This route is ready for real submission records. It does not create or display fake resident requests."
      />
    </GovCrmPageShell>
  );
}
