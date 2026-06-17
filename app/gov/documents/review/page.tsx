import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovDocumentReviewPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Document review"
      description="GovCRM review queue for extraction status, fields, confidence scores, unmatched documents, and low-confidence OCR results."
    >
      <GovModuleEmptyState
        title="No document review items"
        description="Real uploaded workflow records will show extracted fields with approve, edit, and reject states. No fake review items are displayed."
      />
    </GovCrmPageShell>
  );
}
