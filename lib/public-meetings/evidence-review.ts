import type { PublicMeetingItemRecord } from "@/lib/public-meetings/types";

/** Cached topic extraction is not approval of any outcome or named action. */
export function cachedTopicNeedsEvidenceReview(item: Pick<PublicMeetingItemRecord, "parser_status" | "source_method" | "source_document_type">) {
  return item.parser_status === "source_excerpt"
    || item.parser_status === "needs_review" && item.source_method === "automated_archive"
      && Boolean(item.source_document_type);
}
