import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attachDiligentDocuments, discoverNevadaPriorityMeetings, parseDiligentListing, parseEurekaDocuments, parseLegistarCalendar, parseNsheMeetings, parseOnBaseMeetings, parsePrimeGovMeetings, parsePriorityGranicus, parsePrioritySchoolCalendar, priorityMeetingTime, reconcilePriorityMeetingIdentities, removeMisclassifiedSchoolPortalDocuments } from "../lib/public-meetings/nevada-priority-sources";
import type { PublicMeetingRecord, PublicMeetingSourceSeed } from "../lib/public-meetings/types";
const seeds = JSON.parse(readFileSync("data/seed/public-meeting-sources.json", "utf8")) as PublicMeetingSourceSeed[];
const seed = (id: string) => seeds.find((s) => s.id === id)!;
const school = seed("washoe-county-school-district"); const url = school.meetingIndexUrl!;
assert.deepEqual(priorityMeetingTime("2026-09-08", "2:00 PM"), { meetingDate: "2026-09-08T21:00:00.000Z", meetingTimeKnown: true });
assert.equal(priorityMeetingTime("2026-12-08", "2:00 PM").meetingDate, "2026-12-08T22:00:00.000Z");
assert.equal(priorityMeetingTime("2026-12-08", "TBD").meetingTimeKnown, false);
const calendars = parsePrioritySchoolCalendar(`<a data-occur-id="1_2026-09-08T21:00:00Z_2026-09-09T01:00:00Z">Regular Meeting of the Board of Trustees</a><div class="fsLocation">425 E. Ninth Street</div><a data-occur-id="2_2026-09-08T23:00:00Z_2026-09-09T01:00:00Z">Group Insurance Committee Meeting</a><a data-occur-id="3_2026-09-08T23:00:00Z_2026-09-09T01:00:00Z">Volleyball</a>`, school, url);
assert.equal(calendars.length, 2); assert.notEqual(calendars[0].publicBodyName, calendars[1].publicBodyName); assert.equal(calendars[0].location, "425 E. Ninth Street");
const listings = parseDiligentListing(`<button onclick="Portal.MeetingInformationPage.events.meetingClick(this, 1493,0,0);return false;"><span class="meeting-list-item-button-date">Sep 08 2026</span><span class="meeting-list-item-button-name">Board of Trustees Regular Meeting</span></button>`, "https://washoeschools.community.diligentoneplatform.com");
assert.equal(listings[0].date, "2026-09-08"); assert.equal(listings[0].id, "1493");
const doc = { Id: 4, MeetingId: 1493, DocumentType: 4, Format: "pdf", Type: 1, Name: "Board meeting" };
attachDiligentDocuments(calendars[0], { Documents: [doc, { ...doc, Id: 8, DocumentType: 8 }, { ...doc, Id: 10, DocumentType: 10, Type: 2 }, { ...doc, Id: 12, DocumentType: 12, Type: 2 }, { ...doc, Id: 99, MeetingId: 999 }] }, 1493, "https://washoeschools.community.diligentoneplatform.com");
assert.match(calendars[0].agendaUrl!, /\/document\/4\//); assert.match(calendars[0].minutesUrl!, /\/document\/10\//);
attachDiligentDocuments(calendars[0], { Documents: [
  { ...doc, Id: 55, DocumentType: 55, Type: 2, Format: "docx" },
  { ...doc, Id: 9, DocumentType: 9, Type: 2, Format: "docx" },
  { ...doc, Id: 1, DocumentType: 1, Format: "docx" },
  doc, { ...doc, Id: 53, DocumentType: 53, Type: 2 },
  { ...doc, Id: 56, DocumentType: 56, Type: 2, Format: "docx" },
  { ...doc, Id: 555, DocumentType: 55, Type: 2, Format: "docx", PublicReleaseDelayDateString: "2999-01-01" },
] }, 1493, "https://washoeschools.community.diligentoneplatform.com");
assert.match(calendars[0].agendaUrl!, /\/document\/1$/); assert.match(calendars[0].minutesUrl!, /\/document\/55$/);
const legistar = parseLegistarCalendar(`<tr><td>Health Board</td><td>9/24/2026</td><td><a href="View.ashx?M=IC&amp;ID=44">Calendar</a></td><td>1:00 PM</td><td>Building A</td><td><a class="meeting_NotViewable">Meeting details</a></td></tr>`, seed("washoe-county-commission"), "https://washoe-nv.legistar.com/Calendar.aspx");
assert.equal(legistar.length, 1); assert.equal(legistar[0].agendaUrl, null); assert.equal(legistar[0].meetingDate, "2026-09-24T20:00:00.000Z");
const onbase = parseOnBaseMeetings(`<tr data-meeting-id="12"><td>CANCELLED Planning Commission Meeting</td><td>Planning Commission</td><td>9/17/2026 6:00:00 PM</td><td><a href="/Documents/DownloadFile/Commission_12_Agenda_9_17_2026.pdf"> </a><a href="/Documents/DownloadFile/Commission_12_Agenda_Packet_9_17_2026.pdf">Agenda Packet</a><a href="/Documents/DownloadFile/Commission_12_Summary_9_17_2026.pdf">Summary</a></td></tr>`, seed("sparks-city-council"), "https://agendas.cityofsparks.us/OnBaseAgendaOnline/");
assert.equal(onbase[0].meetingStatus, "cancelled"); assert.equal(onbase[0].meetingDate, "2026-09-18T01:00:00.000Z"); assert.equal(onbase[0].minutesUrl, null); assert.match(onbase[0].agendaUrl!, /Documents\/ViewAgenda\?meetingId=12&type=HTML&doctype=1/); assert.ok(onbase[0].sourceUrls.some((u) => /DownloadFileBytes\/Commission_12_Agenda_9/.test(u))); assert.match(onbase[0].packetUrl!, /_Agenda_Packet_/);
const prime = parsePrimeGovMeetings([{ id: 22, title: "Reno City Council Meeting", date: "Sep 09, 2026", time: "10:00 AM", documentList: [{ id: 3, templateId: 123, templateName: "Agenda", meetingId: 22, compileOutputType: 1, publishStatus: 1 }, { id: 4, templateId: 124, templateName: "Minutes", meetingId: 22, compileOutputType: 1, publishStatus: 0 }] }], seed("reno-city-council"), "https://reno.primegov.com/public/portal");
assert.match(prime[0].agendaUrl!, /meetingTemplateId=123/); assert.equal(prime[0].minutesUrl, null);
const nshe = parseNsheMeetings(`<div class="title-block"><h3>Investment Committee Meeting</h3><div class="meeting-date">September 29, 2026</div><div class="meeting-location">System Administration</div></div><div id="archive-2026"><table><tr><td>February 26</td><td>Security Committee</td><td><a href="/agenda.pdf">Agenda</a></td><td><a href="/minutes.pdf">Minutes</a></td></tr></table></div>`, seed("nshe-board-of-regents"), "https://nshe.nevada.edu/regents/archive/");
assert.equal(nshe.length, 2); assert.equal(nshe[0].meetingTimeKnown, false); assert.equal(nshe[1].meetingDate, "2026-02-26"); assert.match(nshe[1].minutesUrl!, /minutes.pdf/);
const eureka = parseEurekaDocuments(`<a href="/media/a/9-1-26-dggid-agenda.pdf">9 1 26 DGGID Agenda</a><a href="/media/b/9-1-26-bocc-agenda-and-backup.pdf">9 1 26 BOCC Agenda</a><a href="/media/c/11-21-23-approved-bocc-minutes-on-04-16-24-agenda.pdf">Old minutes approved in 2024</a><a href="/media/d/jan-6-2026-liquor-board-minutes.pdf">January liquor board</a><a href="/media/e/rtc-1-6-25-meeting-minutes.pdf">RTC minutes</a>`, seed("eureka-county-commission"), "https://www.eurekacountynv.gov/");
assert.equal(eureka.length, 4); assert.equal(eureka[2].publicBodyName, "Eureka County Liquor Board"); assert.equal(eureka[3].publicBodyName, "Eureka County Regional Transportation Commission"); assert.notEqual(eureka[0].publicBodyName, eureka[1].publicBodyName);
const granicus = parsePriorityGranicus(`<tr><td>Elko TV District</td><td>Sep&nbsp;10,&nbsp;2026 - 06:00 PM</td><td><a href="//elkocounty.granicus.com/AgendaViewer.php?view_id=5&event_id=10">Agenda</a></td></tr>`, seed("elko-county-commission"), "https://elkocounty.granicus.com/ViewPublisher.php?view_id=5");
assert.equal(granicus[0].meetingDate, "2026-09-11T01:00:00.000Z");
const old = { id: "meeting-washoe-county-school-district-old", source_urls: ["https://washoeschools.community.diligentoneplatform.com/Portal/MeetingInformation.aspx?Org=Cal&Id=1493"], agenda_url: listings[0].url, minutes_url: listings[0].url, packet_url: listings[0].url } as PublicMeetingRecord;
const current = { ...calendars[0], sourceUrls: [listings[0].url] }; reconcilePriorityMeetingIdentities([current], [old]); assert.ok(current.aliasMeetingIds?.includes(old.id));
assert.equal(removeMisclassifiedSchoolPortalDocuments(old).minutes_url, null); assert.deepEqual(removeMisclassifiedSchoolPortalDocuments(old).source_urls, old.source_urls);
console.log("Priority Nevada source adapters: dates, committees, published-document ownership, cancellation, aliases and false-minutes regression passed.");

async function verifyHistoricalFollowup() {
  const requests: string[] = [];
  const rows = await discoverNevadaPriorityMeetings(seed("clark-county-school-district"), async (url) => {
    requests.push(url);
    if (url.includes("ccsd.net")) return "<h1>Public board calendar</h1>";
    if (url.includes("MeetingInformation.aspx")) return `<button onclick="Portal.MeetingInformationPage.events.meetingClick(this, 7,0,0);return false;"><span class="meeting-list-item-button-date">Jan 09 2025</span><span class="meeting-list-item-button-name">Regular Board Meeting</span></button>`;
    if (url.endsWith("meetingData")) return JSON.stringify({ Id: 7, Name: "Regular Board Meeting - Jan 09 2025", Time: "5:00 PM" });
    return JSON.stringify({ Documents: [{ ...doc, Id: 700, MeetingId: 7, DocumentType: 10, Type: 2 }] });
  }, new Date("2026-09-06T12:00:00Z"));
  assert.equal(rows.length, 1); assert.match(rows[0].minutesUrl!, /document\/700/);
  assert.equal(requests.filter((u) => /meetingDocuments$/.test(u)).length, 1);
  console.log("Older archived school minutes remain eligible for rotating follow-up.");
}
void verifyHistoricalFollowup();

async function verifyUniqueSchoolCalendarAlias() {
  const listing = (id: number, title: string) => `<button onclick="Portal.MeetingInformationPage.events.meetingClick(this, ${id},0,0);return false;"><span class="meeting-list-item-button-date">Sep 02 2026</span><span class="meeting-list-item-button-name">${title}</span></button>`;
  const rows = await discoverNevadaPriorityMeetings(seed("clark-county-school-district"), async (url) => {
    if (url.includes("ccsd.net")) return `<a data-occur-id="23908695_2026-09-02T23:00:00Z_2026-09-03T02:00:00Z">Board Work Session</a>`;
    if (url.includes("MeetingInformation.aspx")) return listing(1706, "AMENDED Board Work Session") + listing(1696, "Board Work Session");
    const id = +(url.match(/meetings\/(\d+)/)?.[1] ?? 0);
    if (url.endsWith("meetingData")) return JSON.stringify({ Id: id, Name: `${id === 1706 ? "AMENDED " : ""}Board Work Session - Sep 02 2026`, Time: "4:00 PM" });
    return JSON.stringify({ Documents: [] });
  }, new Date("2026-09-06T12:00:00Z"));
  assert.equal(rows.filter((row) => row.aliasMeetingIds?.length).length, 1, "A district calendar occurrence must have only one portal alias owner");
  assert.ok(rows.find((row) => row.id.endsWith("1706"))?.aliasMeetingIds?.length);
}
void verifyUniqueSchoolCalendarAlias();
