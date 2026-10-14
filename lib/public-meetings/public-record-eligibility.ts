import { routineReportingExclusion } from "@/lib/public-meetings/reporting-policy";
import type { PublicMeetingItemRecord } from "./types";

/** The context-review threshold also governs compact public topic publication. */
export function getPublicMeetingItems(items: PublicMeetingItemRecord[]) {
  return items.filter((item) => !routineReportingExclusion(item) && item.source_method !== "manual_fixture" && item.parser_status !== "needs_review" && item.confidence_score >= 0.65 && Boolean(item.source_url));
}

/** Prefer concrete proposals in small Home summaries without deleting routine records. */
export function prioritizePublicMeetingTopics(items: PublicMeetingItemRecord[]) {
  const routine = (item: PublicMeetingItemRecord) => /^(?:public comment|board reports?|staff reports?|superintendent.s report|association reports?|informational items|approval of consent agenda|call to order|roll call)\b/i.test(item.title.replace(/^(?:\d+|[IVX]+|[A-Z])[.)]\s*/i, ""));
  return getPublicMeetingItems(items).sort((a, b) => Number(routine(a)) - Number(routine(b)));
}
