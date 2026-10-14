import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARSON_PUBLIC_CALENDAR, discoverCarsonPublicCalendar, parseCarsonPublicCalendar } from "../lib/public-meetings/carson-calendar";
import type { PublicMeetingSourceSeed } from "../lib/public-meetings/types";
async function main() {
const seed = (JSON.parse(readFileSync("data/seed/public-meeting-sources.json", "utf8")) as PublicMeetingSourceSeed[]).find(row => row.id === "carson-city-board-of-supervisors")!;
const item = (id: number, title: string, time = "4:00 PM") => `<div class="calendar_item"><span class="calendar_eventtime">${time}</span><a class="calendar_eventlink" href="/Home/Components/Calendar/Event/${id}/14?curm=9&amp;cury=2026">${title}</a></div>`;
const page = (date: string, items: string, next = "") => `<table><td class="calendar_day calendar_day_with_items" aria-label="Scheduled events, ${date}">${items}</td></table>${next ? `<a class="next" href="${next}">Next Month &gt;</a>` : ""}`;
const september = page("Wednesday, September 30, 2026", item(13032, "Planning Commission") + item(99, "Community Flu Event") + item(98, "School Board Concert") + item(97, "Cultural Commission ***CANCELED***"));
const parsed = parseCarsonPublicCalendar(september, seed);
assert.equal(parsed.length, 2);
assert.equal(parsed[0].meetingDate, "2026-09-30T23:00:00.000Z");
assert.equal(parsed[0].sourceUrl, "https://www.carsoncity.gov/Home/Components/Calendar/Event/13032/14");
assert.equal(parsed[0].agendaUrl, null);
assert.equal(parsed[0].sourceDocumentCount, 0);
assert.equal(parsed[1].meetingStatus, "cancelled");
const winter = parseCarsonPublicCalendar(page("December 3, 2026", item(13032, "Planning Commission") + item(77, "Board of Supervisors", "")), seed);
assert.equal(winter[0].meetingDate, "2026-12-04T00:00:00.000Z");
assert.equal(winter[0].id, parsed[0].id, "Native calendar identity survives rescheduling");
assert.equal(winter[1].meetingDate, "2026-12-03");
assert.equal(winter[1].meetingTimeKnown, false, "Do not invent attendance time");
assert.throws(() => parseCarsonPublicCalendar("<html>Sign in</html>", seed), /markup unavailable/);
assert.equal(parseCarsonPublicCalendar(page("September 31, 2026", item(1, "Planning Commission")), seed).length, 0);
let calls = 0;
const records = await discoverCarsonPublicCalendar(seed, async () => {
  calls++;
  return page("September 30, 2026", item(calls, "Planning Commission"), `${CARSON_PUBLIC_CALENDAR}/-curm-${9 + calls}/-cury-2026`);
}, new Date("2026-09-20T20:00:00Z"));
assert.equal(calls, 3, "Pagination is bounded");
assert.equal(records.length, 3, "Distinct occurrence IDs stay separate");
let warnings = 0;
const partial = await discoverCarsonPublicCalendar(seed, async url => {
  if (url !== CARSON_PUBLIC_CALENDAR) throw new Error("provider unavailable");
  return page("September 30, 2026", item(13032, "Planning Commission"), `${CARSON_PUBLIC_CALENDAR}/-curm-10/-cury-2026`);
}, new Date("2026-09-20T20:00:00Z"), () => warnings++);
assert.equal(partial.length, 1);
assert.equal(warnings, 1);
assert.equal((await discoverCarsonPublicCalendar(seed, async () => september, new Date("2026-10-01T20:00:00Z"))).length, 0, "Do not duplicate historical archive entries");
await assert.rejects(discoverCarsonPublicCalendar(seed, async () => "access check"), /unavailable/);
console.log("Carson public calendar tests passed");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
