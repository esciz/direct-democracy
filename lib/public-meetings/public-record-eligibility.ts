import type { PublicMeetingItemRecord } from "./types";

/** The context-review threshold also governs compact public topic publication. */
export function getPublicMeetingItems(items: PublicMeetingItemRecord[]) {
  return items.filter((item) => item.source_method !== "manual_fixture" && item.parser_status !== "needs_review" && item.confidence_score >= 0.65 && Boolean(item.source_url));
}
