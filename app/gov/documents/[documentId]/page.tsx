import { notFound } from "next/navigation";

import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

type GovDocumentDetailPageProps = {
  params: Promise<{ documentId: string }>;
};

export const dynamic = "force-dynamic";

export default async function GovDocumentDetailPage({ params }: GovDocumentDetailPageProps) {
  await requireGovCrmAccess();
  const { documentId } = await params;
  if (!documentId) notFound();

  return (
    <GovCrmPageShell
      title="Document detail"
      description="Detailed GovCRM extraction review will show source links, original files, extracted fields, confidence scores, and review actions."
    >
      <GovModuleEmptyState
        title="Document record not loaded"
        description="This placeholder route is ready for real GovCRM document records. It does not create or display fake uploaded documents."
      />
    </GovCrmPageShell>
  );
}
