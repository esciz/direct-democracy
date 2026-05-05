import { redirect } from "next/navigation";

import { RunForOfficeOpportunityCard } from "@/components/domain/run-for-office-opportunity-card";
import { PageIntro } from "@/components/ui/page-intro";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getRunForOfficeOpportunities } from "@/lib/candidates/drafts";

export default async function RunForOfficeRacesPage() {
  const currentUser = await getCurrentUser();

  if (currentUser.role !== "trustedCitizen") {
    redirect("/run-for-office");
  }

  const opportunities = await getRunForOfficeOpportunities(currentUser);

  return (
    <div className="space-y-6 py-8">
      <PageIntro
        eyebrow="Available races"
        title="Explore races connected to your community"
        description="These are the races currently surfaced for your community context. Opening one lets you preview how your candidate profile would look before you publish anything."
        meta={
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {currentUser.jurisdictionName}
          </span>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {opportunities.map((opportunity) => (
          <RunForOfficeOpportunityCard key={opportunity.electionId} opportunity={opportunity} />
        ))}
      </div>
    </div>
  );
}
