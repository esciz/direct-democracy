import { GovCrmPageShell, GovModuleEmptyState } from "@/app/gov/_components";
import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovFormsPage() {
  await requireGovCrmAccess();

  return (
    <GovCrmPageShell
      title="Form templates"
      description="Form-fill and PDF-generation architecture for enrolled GovCRM clients, staff review, and authorized submission handoff."
    >
      <GovModuleEmptyState
        title="No form templates configured"
        description="Future FormTemplate, FormField, FormSubmission, PdfGenerationProvider, and ExternalSubmissionProvider records will be configured per enrolled client. External government submission automation remains disabled until authorized integrations exist."
      />
    </GovCrmPageShell>
  );
}
