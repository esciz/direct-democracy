import { redirect } from "next/navigation";

import { PetitionCreateForm } from "@/components/domain/petition-create-form";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getOrganizationById } from "@/lib/organizations/store";
import { getIssuePickerOptions } from "@/lib/server/issues";

type CreatePetitionPageProps = {
  searchParams?: Promise<{
    error?: string;
    organizationId?: string;
  }>;
};

export default async function CreatePetitionPage({ searchParams }: CreatePetitionPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;

  if (!user.isVerifiedVoter) {
    redirect("/petitions?error=verification");
  }

  const organization = params?.organizationId ? await getOrganizationById(params.organizationId, user) : null;
  const issueOptions = await getIssuePickerOptions(user);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Create Petition"
        title="Launch a jurisdiction petition"
        description={
          organization?.canManage
            ? `Publish an organization petition for ${organization.name}. Signature eligibility and co-sponsorship are tracked automatically.`
            : "Verified users can create petitions scoped to their current jurisdiction. Signature eligibility and co-sponsorship are tracked automatically."
        }
      />
      <PetitionCreateForm
        jurisdictionName={user.jurisdictionName}
        error={params?.error}
        organization={organization?.canManage ? organization : null}
        issueOptions={issueOptions}
      />
    </div>
  );
}
