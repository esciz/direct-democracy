import Link from "next/link";

import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovDocumentsPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Document intake"
      description="Government workflow document processing for uploaded forms, meeting records, public comments, and service request paperwork."
    >
      <div className="flex flex-wrap gap-2">
        <Link href="/gov/documents/upload" className="dd-button-primary rounded-full px-4 py-2.5 text-sm font-semibold">
          Upload
        </Link>
        <Link href="/gov/documents/review" className="dd-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold">
          Review queue
        </Link>
      </div>
      <GovModuleEmptyState
        title="No GovCRM documents uploaded"
        description="Uploaded documents, extraction status, confidence scores, unmatched records, and low-confidence OCR/handwriting items will appear here after real workflow data exists."
      />
    </GovCrmPageShell>
  );
}
