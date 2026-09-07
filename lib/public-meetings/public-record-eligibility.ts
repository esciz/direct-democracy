import { routineReportingExclusion } from "@/lib/public-meetings/reporting-policy";
import type { PublicMeetingItemRecord } from "./types";

/** The context-review threshold also governs compact public topic publication. */
export function getPublicMeetingItems(items: PublicMeetingItemRecord[]) {
  return items.filter((item) => !routineReportingExclusion(item) && item.source_method !== "manual_fixture" && item.parser_status !== "needs_review" && item.confidence_score >= 0.65 && Boolean(item.source_url));
}
