import type { CommunitySummary } from "@/types/domain";

export const LOCAL_SCOPE_LABEL = "Local · City + County";

export function getCommunityScopeLabel(scope: CommunitySummary["scope"]) {
  if (scope === "local") return LOCAL_SCOPE_LABEL;
  if (scope === "state") return "State";
  return "National";
}
