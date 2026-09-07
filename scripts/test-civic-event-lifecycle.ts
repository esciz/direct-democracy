import assert from "node:assert/strict";
import { civicEventDay, civicEventMatchesSearch, formatCivicEventDate, getEventLifecycleStatus, getEventMinutesStatus, readableMeetingSummary } from "../lib/events/lifecycle";
import type { CivicEvent } from "../lib/events/types";
import { officialBodyCalendarUrl, officialMeetingSourceUrl } from "../lib/events/source-links";

const now = new Date("2026-09-07T02:00:00Z"); // Still September 6 in Nevada.
assert.equal(civicEventDay(now), "2026-09-06");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-09-06" }, now), "upcoming");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-09-06T15:00:00Z" }, now), "upcoming");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-09-06T15:00:00Z", endsAt: "2026-09-06T17:00:00Z" }, now), "completed");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-09-06" }, new Date("2026-09-07T07:00:00Z")), "completed");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-11-01" }, new Date("2026-11-02T07:59:59Z")), "upcoming");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-11-01" }, new Date("2026-11-02T08:00:00Z")), "completed");
assert.equal(getEventLifecycleStatus({ startsAt: null }, now), "undated");
assert.equal(getEventLifecycleStatus({ startsAt: "invalid" }, now), "undated");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-02-30" }, now), "undated");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-10-01", title: "CANCELLED_-_Planning_Commission.pdf" }, now), "cancelled");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-01-01", title: "Postponed tax commission meeting" }, now), "postponed");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-10-01", sourceStatus: "cancelled", title: "Tax commission meeting" }, now), "cancelled");
assert.equal(getEventLifecycleStatus({ startsAt: "2026-10-01", sourceStatus: "rescheduled", title: "Cancelled original date; new meeting" }, now), "upcoming");
assert.match(formatCivicEventDate("2026-09-07T02:00:00Z"), /Sep 6, 2026/);
assert.match(formatCivicEventDate("2026-09-07T02:00:00Z"), /PDT/);
assert.match(formatCivicEventDate("2026-09-06"), /Time not published/);
assert.match(formatCivicEventDate("2026-09-10T00:30:00.000Z"), /Sep 9, 2026, 5:30 PM PDT/);

const ccbCalendar = "https://ccb.nv.gov/public-meetings/";
const oldCcbAgenda = "https://ccb.nv.gov/wp-content/uploads/2026/03/Subcommittee-Meeting-on-Taxation-Agenda-03.24.2026.pdf";
const currentCcbAgenda = "https://ccb.nv.gov/wp-content/uploads/2026/08/09.04.2026-Subcommittee-Meeting-on-Taxation-Agenda_FINAL.pdf";
assert.equal(officialBodyCalendarUrl({ meetingIndexUrl: ccbCalendar, sourceUrl: ccbCalendar, website: ccbCalendar }, { meeting_index_url: oldCcbAgenda }), ccbCalendar);
assert.equal(officialBodyCalendarUrl(null, { meeting_index_url: oldCcbAgenda }), null);
assert.equal(officialBodyCalendarUrl(null, { meeting_index_url: "https://carson.org/MediaPlayer.php?view_id=2&clip_id=2389" }), null);
assert.equal(officialMeetingSourceUrl({ source_urls: [currentCcbAgenda], agenda_url: currentCcbAgenda, minutes_url: null, packet_url: null, video_url: null }), currentCcbAgenda);
assert.equal(officialBodyCalendarUrl({ meetingIndexUrl: "https://www.carsoncityschools.com/families-and-students/calendars", sourceUrl: null, website: null }, { meeting_index_url: oldCcbAgenda }), "https://www.carsoncityschools.com/families-and-students/calendars");

const record = { sourceProvider: "public_meeting_import", status: "completed", minutesUrl: null, isOfficialMeeting: true } as const;
assert.equal(getEventMinutesStatus(record).label, "Minutes not linked yet");
assert.match(getEventMinutesStatus(record).description, /does not mean the body took no action/);
assert.match(getEventMinutesStatus({ ...record, minutesUrl: "https://example.gov/minutes.pdf" }).description, /does not confirm approval/);
assert.equal(getEventMinutesStatus({ ...record, status: "cancelled" }).label, "Schedule changed");
assert.equal(getEventMinutesStatus({ ...record, sourceProvider: "public_meeting_source_registry" }).label, "Minutes archive");
assert.equal(getEventMinutesStatus({ ...record, parentOrganizationEvent: true }).label, "Parent organization updates");
assert.equal(readableMeetingSummary('{ "meetingId": 12, "dateTime": "2026-09-01" }'), null);
assert.equal(readableMeetingSummary("<html>official calendar</html>"), null);
assert.equal(readableMeetingSummary("The commission reviewed public comments."), "The commission reviewed public comments.");

const searchable = {
  title: "Cannabis Advisory Commission subcommittee", description: "Public meeting", hostName: "Nevada", hostType: "state", jurisdiction: "Nevada",
  meetingSummary: null, summary: null, keyActions: [], relatedEntityLabels: [], relatedIssueLabels: [], relatedOfficialIds: [], relatedCandidateIds: [], relatedOrganizationIds: [], relatedIssueIds: [],
} as unknown as CivicEvent;
assert.equal(civicEventMatchesSearch(searchable, "cannabis subcommittee"), true);
assert.equal(civicEventMatchesSearch(searchable, "subcommittee cannabis"), true);
assert.equal(civicEventMatchesSearch(searchable, "school board"), false);
console.log("Civic event lifecycle checks passed: Nevada day boundaries, DST, automatic archive, changed schedules, missing minutes, and committee search.");
