import { notFound } from "next/navigation";

import { FUTURE_GOVERNANCE_ROLES } from "@/lib/governance/product-boundaries";

export const GOV_CRM_ROLE_PLAN = FUTURE_GOVERNANCE_ROLES.filter((role) =>
  ["government_admin", "government_staff", "platform_admin"].includes(role),
);

export function isGovCrmEnabled() {
  return process.env.GOV_CRM_ENABLED === "true";
}

export async function requireGovCrmAccess() {
  if (!isGovCrmEnabled()) {
    notFound();
  }

  return {
    accessMode: "environment_guard",
    plannedRoles: GOV_CRM_ROLE_PLAN,
  };
}
