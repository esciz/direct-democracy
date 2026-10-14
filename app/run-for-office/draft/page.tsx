import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getLatestCandidateDraftForUser, getRunForOfficeOpportunities } from "@/lib/candidates/drafts";

export default async function RunForOfficeDraftRedirectPage() {
  const currentUser = await getCurrentUser();

  if (currentUser.role !== "trustedCitizen") {
    redirect("/run-for-office");
  }

  const [draft, opportunities] = await Promise.all([
    getLatestCandidateDraftForUser(currentUser.id),
    getRunForOfficeOpportunities(currentUser),
  ]);

  if (draft) {
    redirect(`/run-for-office/races/${draft.electionId}`);
  }

  if (opportunities[0]) {
    redirect(`/run-for-office/races/${opportunities[0].electionId}`);
  }

  redirect("/run-for-office/races");
}
