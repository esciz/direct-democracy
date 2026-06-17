import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovDocumentUploadPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Upload documents"
      description="Future GovCRM upload surface for PDFs, scanned forms, images, saved HTML, and manifests."
    >
      <GovModuleEmptyState
        title="Upload workflow pending"
        description="For now, place files in data/imports/documents, data/imports/meeting-documents, or another manual import folder and run npm run civic:import-documents."
      />
    </GovCrmPageShell>
  );
}
