import { redirect } from "next/navigation";

import { requireGovCrmAccess } from "@/lib/govcrm/access";

export const dynamic = "force-dynamic";

export default async function GovCrmHomePage() {
  await requireGovCrmAccess();
  redirect("/gov/dashboard");
}
