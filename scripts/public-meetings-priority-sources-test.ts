import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attachDiligentDocuments, discoverNevadaPriorityMeetings, isNevadaPrioritySource, parseDiligentListing, parseEurekaCalendarEvent, parseEurekaDocuments, parseLegistarCalendar, parseNsheMeetings, parseOnBaseMeetings, parsePrimeGovMeetings, parsePriorityGranicus, parsePrioritySchoolCalendar, priorityMeetingTime, reconcilePriorityMeetingIdentities, removeMisclassifiedSchoolPortalDocuments } from "../lib/public-meetings/nevada-priority-sources";
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
const eurekaSource = seed("eureka-county-commission");
const eurekaEventUrl = "https://events.eurekacountynv.gov/default/detail/2026-09-15-0930-Board-of-County-Commissioners";
// The actual Govstack detail structure has separate rendered date/time paragraphs.
const eurekaEventHtml = (title = "Board of County Commissioners", date = "September 15, 2026", time = "9:30 am - 2:00 pm", documents = "") => `<div id="dvTitle"><h2>${title}</h2></div><div><h3>Location:</h3><p>Eureka County Courthouse</p>${documents}</div><div class="meta-title"><h3>Dates &amp; Times</h3></div><p>${date}</p><p>${time}</p><div class="icrt-calendarContentSideTags"><span class="meta-tags">Board of County Commissioners</span></div><div id="calendar-popover-title">Title</div>`;
const [eurekaEvent] = parseEurekaCalendarEvent(eurekaEventHtml(), eurekaSource, eurekaEventUrl);
assert.equal(eurekaEvent.publicBodyName, eurekaSource.name);
assert.equal(eurekaEvent.meetingDate, "2026-09-15T16:30:00.000Z");
assert.equal(eurekaEvent.meetingTimeKnown, true);
assert.equal(eurekaEvent.location, "Eureka County Courthouse");
assert.equal(eurekaEvent.agendaUrl, null, "A published future calendar event does not need an agenda yet");
assert.equal(eurekaEvent.minutesUrl, null);
assert.equal(parseEurekaCalendarEvent(eurekaEventHtml(), eurekaSource, eurekaEventUrl.replace("/default/", "/meetings/").replace("/detail/", "/Detail/"))[0].id, eurekaEvent.id, "Two calendar views have one occurrence identity");
assert.equal(parseEurekaCalendarEvent(eurekaEventHtml(undefined, undefined, "TBD"), eurekaSource, eurekaEventUrl)[0].meetingTimeKnown, false, "The time embedded in the URL is not evidence of a published start");
assert.deepEqual(parseEurekaCalendarEvent(eurekaEventHtml(undefined, "September 16, 2026"), eurekaSource, eurekaEventUrl), [], "A URL/content date conflict must not silently choose either date");
assert.deepEqual(parseEurekaCalendarEvent(eurekaEventHtml(undefined, ""), eurekaSource, eurekaEventUrl), [], "No URL date fallback");
assert.deepEqual(parseEurekaCalendarEvent(eurekaEventHtml("Fall picnic"), eurekaSource, eurekaEventUrl), [], "Community recreation does not become a public body meeting");
assert.deepEqual(parseEurekaCalendarEvent(eurekaEventHtml(), eurekaSource, eurekaEventUrl.replace("events.eurekacountynv.gov", "unrelated.example")), []);
assert.deepEqual(parseEurekaCalendarEvent(eurekaEventHtml(), eurekaSource, `${eurekaEventUrl}/8265538f-f819-4930-9b1c-b4ba00edff58`), [], "An attachment is not an event");
const healthEventUrl = "https://events.eurekacountynv.gov/default/detail/2026-09-10-1400-Heatlh-Insurance-Advisory-Committee";
const healthAgenda = `${healthEventUrl.replace("/detail/", "/Detail/")}/8265538f-f819-4930-9b1c-b4ba00edff58`;
const healthHtml = eurekaEventHtml("Heatlh Insurance Advisory Committee", "September 10, 2026", "2:00 pm - 3:00 pm", `<div><h3>Agenda (PDF):</h3><a href="${healthAgenda}">9.10.26 Health Insurance Advisory Committee.pdf</a></div>`);
const [healthEvent] = parseEurekaCalendarEvent(healthHtml, eurekaSource, healthEventUrl);
assert.equal(healthEvent.publicBodyName, "Eureka County Health Insurance Advisory Committee");
assert.equal(healthEvent.meetingDate, "2026-09-10T21:00:00.000Z");
assert.equal(healthEvent.agendaUrl, healthAgenda, "A labeled official PDF attachment can use a UUID URL");
assert.ok(healthEvent.sourceUrls.includes(healthAgenda));
assert.equal(healthEvent.minutesUrl, null, "An agenda cannot establish minutes availability");
const eurekaMinutesUrl = "https://www.eurekacountynv.gov/media/koajtnwg/march-3-2026-bocc-minutes.pdf";
const eurekaMinutesRows = () => parseEurekaDocuments(`<a href="${eurekaMinutesUrl}">March 3 2026 BOCC Minutes</a>`, eurekaSource, eurekaSource.minutesArchiveUrl!);
const eurekaLegacy = { id: "meeting-eureka-county-commission-2026-03-03-966620b9", public_body_id: "body-eureka-county-commission-eureka-county-commission", meeting_date: "2026-03-03T15:30:00.000Z", minutes_url: eurekaMinutesUrl, source_urls: [eurekaMinutesUrl], meeting_alias_ids: ["meeting-eureka-county-commission-retained-older-alias"] } as PublicMeetingRecord;
const repairedEureka = reconcilePriorityMeetingIdentities(eurekaMinutesRows(), [eurekaLegacy]);
assert.equal(repairedEureka[0].meetingDate, "2026-03-03");
assert.deepEqual(repairedEureka[0].aliasMeetingIds, [eurekaLegacy.id, ...eurekaLegacy.meeting_alias_ids!]);
const priorRepairedEureka = structuredClone(repairedEureka);
assert.deepEqual(reconcilePriorityMeetingIdentities(repairedEureka, [eurekaLegacy]), priorRepairedEureka);
const selfAliasRows = eurekaMinutesRows();
const otherAliasOwner = { ...selfAliasRows[0], id: "meeting-eureka-county-commission-other-canonical", publicBodyName: "Eureka County TV District", aliasMeetingIds: ["already-owned-alias"] };
const protectedEureka = reconcilePriorityMeetingIdentities([...selfAliasRows, otherAliasOwner], [{ ...eurekaLegacy, meeting_alias_ids: [selfAliasRows[0].id, otherAliasOwner.id, "already-owned-alias", "retained-free-alias"] }]);
assert.deepEqual(protectedEureka[0].aliasMeetingIds, [eurekaLegacy.id, "retained-free-alias"], "Inherited aliases cannot create a self-alias, consume another canonical ID, or overlap another owner");
assert.deepEqual(protectedEureka[1].aliasMeetingIds, ["already-owned-alias"]);
assert.equal(reconcilePriorityMeetingIdentities([...eurekaMinutesRows(), { ...otherAliasOwner, aliasMeetingIds: [eurekaLegacy.id] }], [eurekaLegacy])[0].aliasMeetingIds, undefined, "A conflicting claim to the legacy ID is held");
for (const changed of [
  { public_body_id: "body-eureka-county-commission-eureka-county-liquor-board" },
  { meeting_date: "2026-03-04T15:30:00.000Z" },
  { minutes_url: "https://www.eurekacountynv.gov/media/other/another-minutes.pdf" },
  { source_urls: [eurekaSource.minutesArchiveUrl!] },
  { id: "meeting-other-county-2026-03-03" },
]) assert.equal(reconcilePriorityMeetingIdentities(eurekaMinutesRows(), [{ ...eurekaLegacy, ...changed }])[0].aliasMeetingIds, undefined, "Unrelated body/date/document/provider cannot become an alias");
const contestedEureka = eurekaMinutesRows(); contestedEureka.push({ ...contestedEureka[0], id: `${contestedEureka[0].id}-other` });
assert.ok(reconcilePriorityMeetingIdentities(contestedEureka, [eurekaLegacy]).every((row) => !row.aliasMeetingIds), "A shared document with competing incoming canonical owners must be held");
const liquorMinutesUrl = "https://www.eurekacountynv.gov/media/rdagiosf/jan-6-2026-liquor-board-minutes.pdf";
const liquorRows = () => parseEurekaDocuments(`<a href="${liquorMinutesUrl}">Jan 6 2026 liquor board minutes</a>`, eurekaSource, eurekaSource.minutesArchiveUrl!);
const reviewedLiquorLegacy = { ...eurekaLegacy, id: "meeting-eureka-county-commission-2026-01-06-614b563a", meeting_date: "2026-01-06T15:30:00.000Z", minutes_url: liquorMinutesUrl, source_urls: [liquorMinutesUrl], meeting_alias_ids: [] };
const reviewedLiquor = reconcilePriorityMeetingIdentities(liquorRows(), [reviewedLiquorLegacy])[0];
assert.equal(reviewedLiquor.publicBodyName, "Eureka County Liquor Board");
assert.deepEqual(reviewedLiquor.aliasMeetingIds, [reviewedLiquorLegacy.id]);
assert.ok(reviewedLiquor.sourceIdentityEvidence?.some((proof) => proof.includes("43a8c5c32854f1d1a2f71c5d13a1932c22df594a5712dfb3c28008011475f1f6") && proof.includes("JANUARY 6,2026 MEETING MINUTES")), "The one reviewed generic-body correction retains its exact native document proof");
for (const changed of [
  { id: "meeting-eureka-county-commission-2026-01-06-unreviewed" },
  { agenda_url: "https://www.eurekacountynv.gov/media/a/1-6-26-bocc-agenda.pdf" },
  { meeting_date: "2026-01-07" },
  { public_body_id: "body-eureka-county-commission-diamond-valley-general-improvement-district" },
]) assert.equal(reconcilePriorityMeetingIdentities(liquorRows(), [{ ...reviewedLiquorLegacy, ...changed }])[0].aliasMeetingIds, undefined, "A reviewed one-record body correction cannot establish other identities or collapse composite records");
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

async function verifyEurekaCalendarDiscovery() {
  const archiveHtml = `<a href="/media/b/9-1-26-bocc-agenda-and-backup.pdf">9 1 26 BOCC Agenda</a>`;
  const archiveRows = parseEurekaDocuments(archiveHtml, eurekaSource, eurekaSource.meetingIndexUrl!);
  const calendarOnlyUrl = eurekaEventUrl.replace("2026-09-15", "2026-10-06");
  const calls: string[] = [];
  const fetchFixture = async (url: string) => {
    calls.push(url);
    if (url === eurekaSource.meetingIndexUrl) return archiveHtml;
    if (url === eurekaSource.minutesArchiveUrl) return "";
    if (url === "https://www.eurekacountynv.gov/") return `<a href="${eurekaEventUrl}">Board of County Commissioners</a><a href="${eurekaEventUrl.replace("/default/", "/meetings/")}">Board of County Commissioners</a><a href="${healthEventUrl}">Heatlh Insurance Advisory Committee</a><a href="${healthAgenda}">Agenda</a><a href="https://unrelated.example/detail/2026-09-20-0900-Board">Board</a>`;
    if (url === "https://events.eurekacountynv.gov/meetings") return `<a href="${calendarOnlyUrl}">Board of County Commissioners</a><a href="${eurekaEventUrl.replace("2026-09-15", "2026-09-01")}">Past occurrence</a>`;
    if (url === eurekaEventUrl) return eurekaEventHtml();
    if (url === calendarOnlyUrl) return eurekaEventHtml(undefined, "October 6, 2026");
    if (url === healthEventUrl) return healthHtml;
    throw new Error(`Unexpected request ${url}`);
  };
  const rows = await discoverNevadaPriorityMeetings(eurekaSource, fetchFixture, new Date("2026-09-07T18:00:00Z"));
  assert.equal(rows.length, 4, "Both archive and published future events survive");
  assert.deepEqual(rows.find((row) => row.id === archiveRows[0].id), archiveRows[0], "Calendar expansion preserves the archive's dates, IDs and source evidence");
  assert.equal(calls.filter((url) => url === eurekaEventUrl).length, 1, "Duplicate calendar views cause one detail request");
  assert.ok(rows.find((row) => row.id === eurekaEvent.id)?.sourceUrls.includes(eurekaEventUrl.replace("/default/", "/meetings/")));
  assert.equal(calls.length, 7, "Only two archives, two listings and three dated future details are requested");
  assert.ok(rows.some((row) => row.meetingDate === "2026-10-06T16:30:00.000Z"), "The full meeting calendar extends beyond the homepage's first events");
  assert.deepEqual(await discoverNevadaPriorityMeetings(eurekaSource, fetchFixture, new Date("2026-09-07T18:00:00Z")), rows, "Repeated discovery is stable");

  const exactAgenda = "https://www.eurekacountynv.gov/media/e/9-15-26-bocc-agenda.pdf";
  const datedArchive = `<a href="${exactAgenda}">9 15 26 BOCC Agenda</a>`;
  const archived = parseEurekaDocuments(datedArchive, eurekaSource, eurekaSource.meetingIndexUrl!)[0];
  const discoverOverlap = (attachExactAgenda: boolean, secondOccurrence = false) => discoverNevadaPriorityMeetings(eurekaSource, async (url) => {
    if (url === eurekaSource.meetingIndexUrl) return datedArchive;
    if (url === eurekaSource.minutesArchiveUrl || url === "https://events.eurekacountynv.gov/meetings") return "";
    if (url === "https://www.eurekacountynv.gov/") return `<a href="${eurekaEventUrl}">Board</a>${secondOccurrence ? `<a href="${eurekaEventUrl.replace("0930", "1500")}">Board special meeting</a>` : ""}`;
    return eurekaEventHtml(undefined, undefined, "9:30 am - 2:00 pm", attachExactAgenda ? `<div><h3>Agenda (PDF):</h3><a href="${exactAgenda}">Agenda.pdf</a></div>` : "");
  }, new Date("2026-09-07T18:00:00Z"));
  const joined = await discoverOverlap(true);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].id, archived.id); assert.equal(joined[0].meetingDate, archived.meetingDate);
  assert.deepEqual(joined[0].aliasMeetingIds, [eurekaEvent.id]);
  assert.ok(joined[0].sourceUrls.includes(exactAgenda) && joined[0].sourceUrls.includes(eurekaEventUrl));
  assert.equal((await discoverOverlap(false)).length, 2, "Same date/body without a shared document cannot establish identity");
  assert.equal((await discoverOverlap(true, true)).length, 3, "Competing same-day calendar occurrences must not claim one archive alias");
  const warnings: string[] = [];
  const resilient = await discoverNevadaPriorityMeetings(eurekaSource, async (url) => {
    if (url === eurekaSource.meetingIndexUrl) return archiveHtml;
    if (url === eurekaSource.minutesArchiveUrl) return "";
    throw new Error("calendar unavailable");
  }, new Date("2026-09-07T18:00:00Z"), (message) => warnings.push(message));
  assert.deepEqual(resilient, archiveRows); assert.equal(warnings.length, 2);
  console.log("Eureka future calendar: native dates, committees, attachments, bounded discovery and conservative archive identity passed.");
}
void verifyEurekaCalendarDiscovery();

async function verifyPrimeGovCityArchives() {
  for (const [sourceId, host, body] of [
    ["las-vegas-city-council", "https://lasvegas.primegov.com", "City Council"],
    ["boulder-city-council", "https://bcnv.primegov.com", "City Council"],
    ["north-las-vegas-city-council", "https://cityofnorthlasvegas.primegov.com", "City Council"],
  ]) {
    const source = seed(sourceId);
    assert.ok(isNevadaPrioritySource(source), `${sourceId} must reach the archive adapter instead of the unparsed registration branch`);
    assert.notEqual(source.scraperType, "manual", "Native daily sources must participate in strict automated refresh coverage");
    assert.equal((source as PublicMeetingSourceSeed & { directCollectionCadenceDays?: number }).directCollectionCadenceDays, 1);
    assert.equal(source.meetingIndexUrl, `${host}/public/portal`);
    const catalog = JSON.parse(readFileSync("data/seed/nevada-jurisdiction-coverage.json", "utf8"));
    const catalogSource = catalog.providers.find((provider: { id: string }) => provider.id === sourceId);
    assert.equal(catalogSource.scraperType, source.scraperType);
    assert.equal(catalogSource.replaceSourceUrls, true, "Daily seed regeneration must retain the verified native source configuration");
    assert.deepEqual(catalogSource.discoveryUrls, [source.meetingIndexUrl]);
    const requests: string[] = [];
    const minutes = { id: 23264, templateId: 16156, templateName: "Minutes", meetingId: 2961, compileOutputType: 1, publishStatus: 1 };
    const meeting = { id: 2961, committeeId: 1, title: sourceId === "north-las-vegas-city-council" ? "City Council/RDA Meeting" : "Council meeting", date: "Jan 07, 2026", time: "4:00 PM", documentList: [
      { ...minutes, id: 23263, templateId: 16155, templateName: "Agenda" }, minutes,
      { ...minutes, id: 99991, templateId: 99991, publishStatus: 0 },
      { ...minutes, id: 99992, templateId: 99992, meetingId: 999 },
      { ...minutes, id: 99993, templateId: 99993, compileOutputType: 3, templateName: "HTML Minutes" },
    ] };
    const records = await discoverNevadaPriorityMeetings(source, async (url) => {
      requests.push(url);
      assert.ok(url.startsWith(`${host}/`), "Each city must use its own official portal");
      if (url.endsWith("GetCommitteeesListByShowInPublicPortal")) return JSON.stringify([{ id: 1, name: body }, { id: 2, name: "Parks and Recreation Advisory Commission" }]);
      if (url.endsWith("ListUpcomingMeetings")) return JSON.stringify([{ ...meeting, id: 3000, committeeId: 2, title: "Advisory meeting", date: "Sep 09, 2026", documentList: [] }]);
      assert.ok(url.endsWith("ListArchivedMeetings?year=2026"));
      return JSON.stringify([meeting]);
    }, new Date("2026-09-07T12:00:00Z"));
    assert.equal(requests.length, 3, "Discovery reads bounded metadata, never downloads a document per historical meeting");
    assert.equal(records.length, 2);
    const archived = records.find((row) => row.id.endsWith("primegov-2961"))!;
    assert.equal(archived.meetingDate, "2026-01-08T00:00:00.000Z", "Official local dates and times retain Pacific timezone ownership");
    assert.equal(archived.publicBodyName, sourceId === "north-las-vegas-city-council" ? "City Council/RDA" : source.name, "An explicit combined council/RDA title takes precedence over a generic Council committee label");
    assert.equal(archived.sourceMeetingId, 2961); assert.equal(archived.sourceCommitteeId, 1);
    assert.equal(records.find((row) => row.id.endsWith("primegov-3000"))?.publicBodyName, "Parks and Recreation Advisory Commission");
    assert.equal(archived.minutesUrl, `${host}/Public/CompiledDocument?meetingTemplateId=16156&compileOutputType=1`, "Only published minutes for the exact meeting are attached");
    const previous = { id: `meeting-manual-${sourceId}-legacy-2026-01-07`, source_urls: [`${host}/Portal/Meeting?meetingTemplateId=16155`] } as PublicMeetingRecord;
    reconcilePriorityMeetingIdentities(records, [previous]);
    assert.deepEqual(archived.aliasMeetingIds, [previous.id], "The retained official agenda template identity preserves old public IDs");
    assert.ok(archived.sourceUrls.includes(archived.minutesUrl!));
  }
  const jointAndCancelled = parsePrimeGovMeetings([
    { id: 4517, committeeId: 38, title: "Special Joint City Council and Redevelopment Agency Budget Meeting", date: "May 20, 2026", time: "09:30 AM", documentList: [] },
    { id: 3061, committeeId: 1, title: "Joint City Council and Planning Commission Special Meeting", date: "Aug 27, 2026", time: "04:00 PM", documentList: [] },
    { id: 660, committeeId: 9, title: "Audit Review Committee Meeting", date: "Jan 13, 2026", time: "03:00 PM", documentList: [{ id: 14317, templateId: 3470, templateName: "Notice of Cancellation", meetingId: 660, compileOutputType: 1, publishStatus: 1 }] },
  ], seed("las-vegas-city-council"), "https://lasvegas.primegov.com/public/portal", new Map([[38, "Special Council Meeting"], [1, "City Council"], [9, "Audit Review Committee"]]));
  assert.equal(jointAndCancelled[0].publicBodyName, "City Council and Redevelopment Agency");
  assert.equal(jointAndCancelled[1].publicBodyName, "City Council and Planning Commission");
  assert.equal(jointAndCancelled[2].meetingStatus, "cancelled", "An explicitly published cancellation is not an overdue-minutes meeting");
  assert.match(jointAndCancelled[2].agendaUrl!, /meetingTemplateId=3470/); assert.equal(jointAndCancelled[2].minutesUrl, null);
  console.log("Three PrimeGov city archives: bounded discovery, published minutes, exact document ownership, official bodies, Pacific dates and retained aliases passed.");
}
void verifyPrimeGovCityArchives();
