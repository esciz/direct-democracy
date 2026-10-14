import type { CivicEvent } from "@/lib/events/types";
import type { IssueHubRecord } from "@/lib/issues/civic-hub";
import { valuesStronglyMatchIssueText } from "@/lib/issues/utils";

type IssueMeeting = Pick<CivicEvent, "id" | "aliasIds" | "meetingRecordId" | "isOfficialMeeting" | "relatedIssueLabels" | "title" | "description" | "startsAt">;
type MeetingEvidence = Pick<IssueHubRecord, "publicRelationshipEvidenceVersion" | "relatedMeetingIds">;

export function getIssueLinkedMeetings<T extends IssueMeeting>(events: T[], issueText: string, evidence: MeetingEvidence | null): T[] {
  const validatedLinks = evidence?.publicRelationshipEvidenceVersion === 1
    ? new Set(evidence.relatedMeetingIds.filter(Boolean))
    : null;
  return events.filter((event) => event.isOfficialMeeting)
    .filter((event) => validatedLinks
      // Minutes establish a link even when the meeting has a generic title.
      // Versioned evidence also prevents broad title matches adding unrelated
      // meetings that the public issue generator did not approve.
      ? [event.id, event.meetingRecordId, ...(event.aliasIds ?? [])].some((id) => Boolean(id && validatedLinks.has(id)))
      : valuesStronglyMatchIssueText(issueText, ...event.relatedIssueLabels, event.title, event.description))
    .sort((left, right) => (Date.parse(right.startsAt ?? "") || 0) - (Date.parse(left.startsAt ?? "") || 0));
}
