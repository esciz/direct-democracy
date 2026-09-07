import assert from "node:assert/strict";

import { discoverNevadaAgencyMeetings, nevadaMeetingDate, parseCannabisMeetings, parseCarsonSchoolBoardCalendar, parseEducationMeetings, parseNevadaPublicNoticeLeads, parsePublicDriveFolder, parseSchoolParentMeetings, parseTaxationMeetings } from "@/lib/public-meetings/nevada-agency-sources";
import { reconcileCarsonGranicusIdentities } from "@/lib/public-meetings/carson-granicus-identity";
import { reconcileNevadaAgencyMeetingHistory } from "@/lib/public-meetings/nevada-agency-identity";
import { slugify } from "@/lib/public-meetings/shared";
import type { PublicMeetingRecord, PublicMeetingSourceSeed } from "@/lib/public-meetings/types";

function seed(id: string, url: string): PublicMeetingSourceSeed {
  return { id, name: id, jurisdiction: "Nevada", level: "state", meetingIndexUrl: url, scraperType: "html", active: true };
}

async function main() {
  const ccb = seed("nv-cannabis-public-meetings", "https://ccb.nv.gov/public-meetings/");
  // Reduced structural fixtures exercise failure modes seen on the official archives.
  const cannabis = `<table>
    <tr><td>October 15, 2026<br>9:00 a.m.</td><td>Board Meeting</td><td></td><td></td><td></td></tr>
    <tr><td>August 20, 2026<br>9:00 a.m.</td><td>Board Meeting</td><td><a href="/agenda.pdf">Agenda</a></td><td>Carson City</td><td><a href="/old.pdf">Board Meeting Minutes 08.06.26</a></td></tr>
    <tr><td>August 6, 2026<br>9:00 a.m.</td><td>Special Board Meeting</td><td><a href="/special.pdf">Agenda</a></td><td></td><td></td></tr>
    <tr><td>September 4, 2026</td><td>Subcommittee on Taxation</td><td><a href="/tax-agenda.pdf">Agenda</a></td><td></td><td><a href="/own.pdf">Meeting Minutes 09.04.26</a></td></tr>
    <tr><td>September 4, 2026</td><td>Subcommittee on Hemp</td><td><a href="/hemp-agenda.pdf">Agenda</a></td><td></td><td></td></tr>
    <tr><td>CANCELLED August 26, 2025<br>2:00 p.m.</td><td>Subcommittee on Market Participation</td><td></td><td></td><td></td></tr>
    <tr><td>Rescheduled 7/23/26<br>July 15, 2026</td><td>Subcommittee on Taxation</td><td></td><td></td><td></td></tr>
  </table>`;
  const cannabisMeetings = parseCannabisMeetings(cannabis + cannabis, ccb, ccb.meetingIndexUrl!);
  assert.equal(cannabisMeetings.length, 7, "Duplicate desktop/mobile tables must not duplicate meetings");
  assert.equal(cannabisMeetings.find((m) => m.meetingDate.startsWith("2026-08-20"))?.minutesUrl, null, "Prior minutes must not be attributed to approving meeting");
  assert.equal(cannabisMeetings.find((m) => m.meetingDate.startsWith("2026-08-06"))?.minutesUrl, "https://ccb.nv.gov/old.pdf");
  assert.equal(cannabisMeetings.find((m) => m.meetingDate.startsWith("2026-08-20"))?.meetingDate, "2026-08-20T16:00:00.000Z");
  assert.equal(cannabisMeetings.find((m) => m.meetingDate.startsWith("2026-10-15"))?.agendaUrl, null, "Announced future meeting survives before agenda publication");
  const taxation = cannabisMeetings.find((m) => m.publicBodyName.endsWith("Subcommittee on Taxation") && m.meetingDate === "2026-09-04");
  assert.ok(taxation);
  assert.equal(taxation.meetingTimeKnown, false, "Unpublished times must remain unknown");
  assert.equal(taxation.minutesUrl, "https://ccb.nv.gov/own.pdf");
  assert.equal(cannabisMeetings.filter((m) => m.meetingDate === "2026-09-04").length, 2, "Two same-day subcommittees are distinct bodies");
  assert.equal(cannabisMeetings.find((m) => m.meetingDate.startsWith("2025-08-26"))?.meetingStatus, "cancelled");
  assert.equal(cannabisMeetings.find((m) => m.meetingDate === "2026-07-15")?.meetingStatus, "rescheduled", "Retain original date when replacement date appears first");
  const orderedAgain = parseCannabisMeetings(cannabis.replace(/<tr>/g, "\n<tr>"), ccb, ccb.meetingIndexUrl!);
  assert.deepEqual(new Set(orderedAgain.map((m) => m.id)), new Set(cannabisMeetings.map((m) => m.id)), "IDs must not depend on link order or HTML whitespace");

  assert.equal(nevadaMeetingDate("February 30, 2026"), null);
  assert.equal(nevadaMeetingDate("03.24.26"), "2026-03-24");
  assert.equal(nevadaMeetingDate("July 29-30, 2026"), "2026-07-29");
  assert.equal(nevadaMeetingDate("December 1,2023"), "2023-12-01", "Published missing whitespace after comma must not hide an archive row");
  const olderCannabis = parseCannabisMeetings(`<table>
    <tr><td>January 25, 2022</td><td>Board Meeting</td><td></td><td></td><td><a href="/Workshop-Meeting-Minutes-12.14.2021.pdf">Workshop Meeting Minutes 12.14.21</a><a href="/CCB-Meeting-Minutes-12.14.2021.pdf">CCB Meeting Minutes 12.14.21</a></td></tr>
    <tr><td>December 14, 2021</td><td>Workshop</td><td><a href="/workshop-agenda.pdf">Agenda</a></td><td></td><td></td></tr>
    <tr><td>January 19, 2024</td><td>Subcommittee on Rescheduling/Descheduling</td><td><a href="/january-agenda.pdf">Agenda</a></td><td></td><td><a href="/2024/01/CAC-ReDeSched-Subcommittee-Minutes-120123.pdf">Meeting Minutes</a><a href="/2024/02/CAC-ReDeSched-Meeting-Minutes-011924.pdf">Meeting Minutes</a></td></tr>
    <tr><td>December 1,2023</td><td>Subcommittee on Rescheduling/Descheduling</td><td><a href="/december-agenda.pdf">Agenda</a></td><td></td><td></td></tr>
    <tr><td>January 31, 2024<br>1:00 p.m.</td><td>Solicitation of Input on Regulations</td><td><a href="/input-agenda.pdf">Meeting Notice and Agenda</a></td><td>Las Vegas</td><td></td></tr>
  </table>`, ccb, ccb.meetingIndexUrl!);
  assert.equal(olderCannabis.filter((m) => m.meetingDate === "2021-12-14").length, 2, "Same-day board and workshop minutes belong to distinct sessions");
  assert.ok(olderCannabis.find((m) => m.publicBodyName.endsWith("Workshops"))?.minutesUrl?.includes("Workshop-Meeting-Minutes"));
  assert.ok(olderCannabis.find((m) => m.publicBodyName === "Nevada Cannabis Compliance Board" && m.meetingDate === "2021-12-14")?.minutesUrl?.includes("CCB-Meeting-Minutes"));
  assert.ok(olderCannabis.find((m) => m.meetingDate === "2023-12-01")?.minutesUrl?.endsWith("120123.pdf"), "A compact document date, not its upload month or host row, owns minutes");
  assert.ok(olderCannabis.find((m) => m.meetingDate === "2024-01-19")?.minutesUrl?.endsWith("011924.pdf"));
  assert.equal(olderCannabis.find((m) => m.meetingDate.startsWith("2024-01-31"))?.meetingDate, "2024-01-31T21:00:00.000Z");
  await assert.rejects(() => discoverNevadaAgencyMeetings(ccb, async () => "<h1>Website unavailable</h1>"), /source layout needs review/, "Changed source layout must become a provider failure, not an empty success");

  const tax = seed("nv-taxation-public-meetings", "https://tax.nv.gov/boards-meetings/");
  const taxMeetings = parseTaxationMeetings(`<h2>Nevada Tax Commission (NTC)</h2>
    <p><strong>May 6, 2026</strong></p><ul><li><a href="/tax-agenda.pdf">NTC Agenda - May 6, 2026</a></li><li><a href="/tax-minutes.pdf">NTC Minutes - May 6, 2026</a></li></ul>
    <h3>Appeals forms</h3><a href="/unrelated.pdf">Appeal form</a>
    <h2>State Board of Equalization (SBE)</h2><p><strong>May 6, 2026</strong></p><ul><li><a href="/sbe-agenda.pdf">SBE Agenda</a></li><li><a href="/sbe-minutes.pdf">March 23 2026 Meeting Minutes Draft</a></li></ul>`, tax, tax.meetingIndexUrl!);
  assert.equal(taxMeetings.filter((m) => m.meetingDate === "2026-05-06").length, 2);
  assert.equal(taxMeetings.find((m) => m.meetingDate === "2026-03-23")?.publicBodyName, "Nevada State Board of Equalization");
  assert.ok(taxMeetings.every((m) => !m.sourceUrls.some((url) => url.endsWith("unrelated.pdf"))), "Footer forms are not meeting documents");
  const taxSubcommittees = parseTaxationMeetings(`<h2>Committee on Local Government Finance (CLGF)</h2>
    <p><strong>January 9, 2025 - IVGID Subcommittee 1pm</strong></p><ul><li><a href="/20250109-AMENDED-CLGF-IVGID-Subcommittee-Agenda.pdf">CLGF Subcommittee IVGID Agenda 1-9-2025</a></li><li><a href="/ivgid-packet.pdf">CLGF Subcommittee IVGID PACKET</a></li></ul>
    <p><strong>January 9, 2025 - CCSD Subcommittee 9am</strong></p><ul><li><a href="/20250109-AMENDED-CLGF-CCSD-Subcommittee-Agenda.pdf">CLGF Subcommittee CCSD Agenda 1-9-2025</a></li><li><a href="/ccsd-packet.pdf">CLGF Subcommittee CCSD Packet</a></li></ul>
    <p><strong>March 27, 2026 - Subcommittee of the Committee on Local Government Finance</strong></p><ul><li><a href="https://tax.nv.gov/wp-content/uploads/2026/03/CLGF-SUBCOMMITTEE-Agenda-March-27-2026-1.pdf">CLGF SUBCOMMITTEE Agenda March 27 2026</a></li></ul>
    <p><strong>April 29, 2025 - Committee on Local Government Finance</strong></p><ul><li><a href="/full-agenda.pdf">CLGF Agenda</a></li><li><a href="/ivgid-comments.pdf">IVGID subcommittee public comments</a></li></ul>`, tax, tax.meetingIndexUrl!);
  assert.equal(taxSubcommittees.filter((m) => m.meetingDate.startsWith("2025-01-09")).length, 2);
  assert.equal(taxSubcommittees.find((m) => m.publicBodyName.includes("Clark County"))?.meetingDate, "2025-01-09T17:00:00.000Z");
  assert.equal(taxSubcommittees.find((m) => m.publicBodyName.includes("Incline Village"))?.meetingDate, "2025-01-09T21:00:00.000Z");
  assert.ok(taxSubcommittees.find((m) => m.meetingDate.startsWith("2026-03-27"))?.publicBodyName.includes("Douglas County School District"));
  assert.equal(taxSubcommittees.find((m) => m.meetingDate.startsWith("2026-03-27"))?.meetingDate, "2026-03-27T16:00:00.000Z");
  assert.equal(taxSubcommittees.find((m) => m.meetingDate === "2025-04-29")?.publicBodyName, "Nevada Committee on Local Government Finance", "Public comment about a subcommittee does not rename the full board");

  const stored = (m: typeof olderCannabis[number]): PublicMeetingRecord => ({
    id: m.id, public_body_id: `body-${m.sourceId}-${slugify(m.publicBodyName)}`, meeting_date: m.meetingDate, title: m.title, meeting_type: m.meetingType,
    agenda_url: m.agendaUrl, minutes_url: m.minutesUrl, packet_url: m.packetUrl, video_url: m.videoUrl, transcript_url: null,
    meeting_summary: null, key_actions: [], vote_results: [], source_urls: m.sourceUrls, source_document_count: m.sourceDocumentCount,
    ingestion_status: "needs_review", document_hashes: [], created_at: "2026-09-06T12:00:00Z", updated_at: "2026-09-06T12:00:00Z",
  });
  const workshop = stored(olderCannabis.find((m) => m.publicBodyName.endsWith("Workshops"))!);
  const phantom = { ...workshop, id: "legacy-workshop-minutes", agenda_url: null, public_body_id: "body-nv-cannabis-public-meetings-nevada-cannabis-compliance-board", source_urls: [workshop.minutes_url!] };
  const cc = stored(taxSubcommittees.find((m) => m.publicBodyName.includes("Clark County"))!);
  const iv = stored(taxSubcommittees.find((m) => m.publicBodyName.includes("Incline Village"))!);
  const parent = { ...cc, id: "legacy-clgf-combined", public_body_id: "body-nv-taxation-public-meetings-nevada-committee-on-local-government-finance", packet_url: iv.packet_url, source_urls: [...cc.source_urls, ...iv.source_urls] };
  const jan = stored(olderCannabis.find((m) => m.meetingDate === "2024-01-19")!);
  const dec = stored(olderCannabis.find((m) => m.meetingDate === "2023-12-01")!);
  const staleJan = { ...jan, source_urls: [...jan.source_urls, dec.minutes_url!, "https://ccb.nv.gov/older-retained-minutes.pdf"] };
  const fixed = reconcileNevadaAgencyMeetingHistory([phantom, workshop, parent, staleJan], [workshop, cc, iv, jan, dec]);
  assert.equal(fixed.meetings.length, 5);
  assert.ok(fixed.meetings.find((m) => m.id === workshop.id)?.meeting_alias_ids?.includes(phantom.id));
  assert.equal(fixed.meetings.find((m) => m.id === parent.id)?.public_body_id, cc.public_body_id, "The exact primary agenda preserves the original route when a combined row is split");
  assert.ok(fixed.meetings.find((m) => m.id === parent.id)?.meeting_alias_ids?.includes(cc.id));
  assert.equal(fixed.meetings.find((m) => m.id === parent.id)?.packet_url, cc.packet_url);
  assert.ok(!fixed.meetings.find((m) => m.id === parent.id)?.source_urls.includes(iv.agenda_url!));
  assert.ok(!fixed.meetings.find((m) => m.id === jan.id)?.source_urls.includes(dec.minutes_url!));
  assert.ok(fixed.meetings.find((m) => m.id === jan.id)?.source_urls.includes("https://ccb.nv.gov/older-retained-minutes.pdf"), "Disappearing links are retained unless current exact evidence establishes another owner");
  assert.equal(fixed.documentMeetingIds.get(dec.minutes_url!), dec.id, "Existing topic references can move by exact document URL without changing item IDs");
  const repeatedAgency = reconcileNevadaAgencyMeetingHistory(fixed.meetings, [workshop, cc, iv, jan, dec]);
  assert.deepEqual(new Set(repeatedAgency.meetings.map((m) => m.id)), new Set(fixed.meetings.map((m) => m.id)), "A refresh must not resurrect the discarded combined identity");
  const manualPriorMinutes: PublicMeetingRecord = { ...dec, id: "meeting-manual-nv-cannabis-public-meetings-wrong-date", public_body_id: "body-manual-nv-cannabis-public-meetings-combined-board", agenda_url: null,
    meeting_date: jan.meeting_date, source_method: "manual_cache", source_urls: [dec.minutes_url!], source_local_paths: ["data/manual-sources/retained-minutes.pdf"] };
  const manualCorrected = reconcileNevadaAgencyMeetingHistory([dec, manualPriorMinutes], []).meetings;
  assert.equal(manualCorrected.length, 1, "A single-document manual observation joins its unique official minutes owner even when its manifest date is wrong");
  assert.equal(manualCorrected[0].meeting_date, dec.meeting_date);
  assert.ok(manualCorrected[0].meeting_alias_ids?.includes(manualPriorMinutes.id));
  assert.ok(manualCorrected[0].source_local_paths?.includes("data/manual-sources/retained-minutes.pdf"), "Retain cached files and old route aliases after correction");
  const conflictingOwner = { ...dec, id: "ambiguous-second-owner" };
  assert.equal(reconcileNevadaAgencyMeetingHistory([dec, conflictingOwner, manualPriorMinutes], []).meetings.length, 3, "A shared minutes URL with two asserted official owners is left for review");

  const education = seed("nv-state-board-of-education", "https://doe.nv.gov/boards-commissions-councils/state-board-of-education");
  const educationHtml = `<h2>Wednesday, January 14, 2026</h2><ul><li>Time: 9:00 AM</li><li><a href="/agenda.pdf">Agenda</a></li><li>Meeting Minutes</li></ul>
    <h2>Thursday, February 5, 2026</h2><h3>Legislative Subcommittee</h3><ul><li>Time: 3:00 PM</li><li><a href="/sub-agenda.pdf">Agenda</a></li></ul>
    <h3>Postponed: Wednesday, September 9, 2026</h3><h3>State Board of Education Meeting</h3><ul><li>Time: 9:00 AM</li></ul>
    <h3>Annual Schedule</h3><a href="/unrelated-minutes.pdf">Meeting Minutes</a>`;
  const educationMeetings = parseEducationMeetings(educationHtml, education, education.meetingIndexUrl!);
  assert.equal(educationMeetings.length, 3);
  assert.equal(educationMeetings.find((m) => m.meetingDate.startsWith("2026-01-14"))?.meetingDate, "2026-01-14T17:00:00.000Z", "Winter Pacific offset differs from summer");
  assert.ok(educationMeetings.every((m) => !m.minutesUrl), "Unlinked minutes placeholders and footer links are not available meeting minutes");
  assert.equal(educationMeetings.find((m) => m.meetingDate.startsWith("2026-02-05"))?.publicBodyName, "Nevada State Board of Education — Legislative Subcommittee");
  assert.equal(educationMeetings.find((m) => m.meetingDate.startsWith("2026-09-09"))?.meetingStatus, "rescheduled");
  const fetched: string[] = [];
  await discoverNevadaAgencyMeetings(education, async (url) => {
    fetched.push(url);
    return url === education.meetingIndexUrl ? `<a href="${url}/2026-state-board-of-education-meeting-materials">2026</a><a href="${url}/2027-state-board-of-education-meeting-materials">2027</a><a href="${url}/2020-state-board-of-education-meeting-materials">2020</a>` : educationHtml;
  }, new Date("2026-12-15T12:00:00Z"));
  assert.equal(fetched.length, 3, "Discover next-year archive once officially linked, not hardcoded 2026 forever");
  assert.ok(fetched.some((url) => url.includes("2027-state")));

  const carson = seed("carson-city-school-participation", "https://www.carsoncityschools.com/families-and-students/calendars");
  const event = (id: string, title: string, start: string) => `<div class="fsCalendarInfo"><span class='fsStyleSROnly'>Bordewich Elementary</span><a class="fsCalendarEventTitle fsCalendarEventLink" data-occur-id="${id}" href="#">${title}</a><time datetime="${start}" class="fsStartTime">5:30 PM</time></div>`;
  const school = parseSchoolParentMeetings(event("123", "PTO meeting", "2026-09-09T17:30:00-07:00") + event("123", "PTO meeting", "2026-09-09T17:30:00-07:00") + event("124", "PTO committee meeting", "2026-09-09T18:30:00-07:00") + event("125", "Basketball practice", "2026-09-09T18:30:00-07:00"), carson, carson.meetingIndexUrl!);
  assert.equal(school.length, 2);
  assert.ok(school.every((m) => m.meetingCategory === "parent_organization" && m.publicBodyName === "Bordewich Elementary PTO"));
  assert.equal(school.find((m) => m.id.endsWith("123"))?.id, parseSchoolParentMeetings(event("123", "PTO meeting", "2026-09-10T17:30:00-07:00"), carson, carson.meetingIndexUrl!)[0].id, "Rescheduled school occurrence keeps its ID");

  const schoolBoard = seed("carson-city-school-district", "https://www.carsoncityschools.com/our-district/school-board");
  schoolBoard.name = "Carson City School District Board of Trustees";
  const boardCalendar = `<article><time datetime="2026-09-08T18:00:00-07:00" class="fsDate">Sep 8 2026</time><div class="fsTitle">School Board Meeting</div><div class="fsEventDetails"><time datetime="2026-09-08T18:00:00-07:00" class="fsStartTime">6:00 PM</time><div class="fsLocation">Carson City Community Center</div></div></article>`;
  const boardSource = `${boardCalendar}<a href="https://drive.google.com/drive/folders/agendaRoot">View Agendas</a><a href="https://drive.google.com/drive/folders/minutesRoot">View Minutes</a>`;
  assert.equal(parseCarsonSchoolBoardCalendar(boardCalendar, schoolBoard, schoolBoard.meetingIndexUrl!)[0].meetingDate, "2026-09-09T01:00:00.000Z");
  const driveRow = (id: string, name: string, folder = false) => `<tr data-selectable data-id="${id}"><td><div data-tooltip="${name}${folder ? " Shared folder" : " PDF"}"><strong>${name}</strong></div></td></tr>`;
  assert.deepEqual(parsePublicDriveFolder(driveRow("2026folder", "2026", true)), [{ id: "2026folder", name: "2026", folder: true }]);
  const boardMeetings = await discoverNevadaAgencyMeetings(schoolBoard, async (url) => {
    if (url === schoolBoard.meetingIndexUrl) return boardSource;
    if (url.endsWith("agendaRoot")) return driveRow("agendaYear", "2026", true);
    if (url.endsWith("minutesRoot")) return driveRow("minutesYear", "2026", true);
    if (url.endsWith("agendaYear")) return driveRow("agendaPdf", "2026-09-08 Agenda &amp; Supporting Material.pdf") + driveRow("unrelatedPdf", "2026-09-04 Additional Material.pdf");
    if (url.endsWith("minutesYear")) return driveRow("minutesPdf", "2026-08-25 Approved Meeting Minutes.pdf");
    throw new Error(`Unexpected request: ${url}`);
  }, new Date("2026-09-06T12:00:00Z"));
  assert.equal(boardMeetings.length, 2, "A standalone attachment must not invent a board meeting");
  assert.equal(boardMeetings.find((m) => m.meetingTimeKnown)?.agendaUrl, "https://drive.google.com/uc?export=download&id=agendaPdf", "Dated document joins the local attendance date, even when its timestamp is tomorrow UTC");
  assert.equal(boardMeetings.find((m) => m.meetingDate === "2026-08-25")?.minutesUrl, "https://drive.google.com/uc?export=download&id=minutesPdf");
  assert.equal(boardMeetings.find((m) => m.meetingDate === "2026-08-25")?.meetingTimeKnown, false, "Filename dates must not invent historical attendance times");
  const sourceWarnings: string[] = [];
  const calendarOnly = await discoverNevadaAgencyMeetings(schoolBoard, async (url) => { if (url === schoolBoard.meetingIndexUrl) return boardSource; throw new Error("HTTP 403"); }, new Date("2026-09-06T12:00:00Z"), (warning) => sourceWarnings.push(warning));
  assert.equal(calendarOnly.length, 1);
  assert.equal(calendarOnly[0].minutesUrl, null);
  assert.equal(sourceWarnings.length, 2, "Blocked document folders stay explicit while dates remain usable");

  const notices = parseNevadaPublicNoticeLeads(`<div class="subtoday-notice-item is-cancelled"><span class="subtoday-notice-time-date">09/08/2026</span><span class="subtoday-notice-time-clock">10:00 AM</span><div class="subtoday-notice-body"><a href="https://tax.nv.gov/boards-meetings/">Tax board</a></div><div class="subtoday-notice-posted">Date Posted: <strong>08/01/2026</strong></div></div>
    <div class="subtoday-notice-item "><span class="subtoday-notice-time-date">09/09/2026</span><div class="subtoday-notice-body"><a href="mailto:office@example.gov">Local board</a></div></div>`);
  assert.equal(notices.length, 2);
  assert.equal(notices[0].meetingDate, "2026-09-08T17:00:00.000Z", "Posting date must not become meeting date");
  assert.equal(notices[0].cancelled, true);
  assert.equal(notices[1].sourceUrl, null, "Contact-only notice must not masquerade as an ingestible public archive");

  const eventAgenda = "https://carsoncity.granicus.com/AgendaViewer.php?view_id=2&event_id=2549";
  const clipAgenda = "https://carsoncity.granicus.com/AgendaViewer.php?view_id=2&clip_id=2931";
  const packet = "https://d3n9y02raazwpg.cloudfront.net/carsoncity/unique-meeting-packet.pdf";
  const artifact = "https://granicus_production_attachments.s3.amazonaws.com/carsoncity/5392d71735f2d9f58729cfe17641036d0.html";
  const scheduled: PublicMeetingRecord = {
    id: "legacy-event-id", public_body_id: "body-carson-city-board-of-supervisors-board-of-supervisors-and-board-of-health", meeting_date: "2026-09-03T15:30:00.000Z",
    meeting_type: "Regular meeting", title: "Board of Supervisors and Board of Health", agenda_url: eventAgenda, minutes_url: null, packet_url: packet, video_url: null, transcript_url: null,
    meeting_summary: null, key_actions: [], vote_results: [], source_document_count: 2, source_urls: [eventAgenda, packet], ingestion_status: "parsed", document_hashes: [],
    created_at: "2026-08-29T12:00:00.000Z", updated_at: "2026-08-29T12:00:00.000Z",
  };
  const recorded = {
    id: "later-clip-id", sourceId: "carson-city-board-of-supervisors", publicBodyName: "Board of Supervisors and Board of Health", meetingDate: "2026-09-03T15:27:00.000Z",
    agendaUrl: clipAgenda, minutesUrl: null, packetUrl: packet, videoUrl: "https://carsoncity.granicus.com/MediaPlayer.php?view_id=2&clip_id=2931", sourceUrls: [clipAgenda, packet],
  };
  const linked = (await reconcileCarsonGranicusIdentities([recorded], [scheduled], { resolveAgendaArtifact: async () => artifact }))[0];
  assert.equal(linked.id, scheduled.id, "A verified calendar-to-recording transition keeps the existing meeting ID");
  assert.equal(linked.meetingDate, scheduled.meeting_date, "Recording start must not replace advertised attendance time");
  assert.deepEqual(linked.aliasMeetingIds, [recorded.id]);
  assert.ok(linked.sourceUrls.includes(eventAgenda) && linked.sourceUrls.includes(clipAgenda) && linked.sourceIdentityEvidence?.includes(artifact));
  const unrelated = (await reconcileCarsonGranicusIdentities([recorded], [scheduled], { resolveAgendaArtifact: async (url) => url === eventAgenda ? artifact : "https://example.gov/different-agenda.html" }))[0];
  assert.equal(unrelated.id, recorded.id, "Same body/day/packet alone cannot establish event identity");
  const deferred = (await reconcileCarsonGranicusIdentities([recorded], [scheduled], { maxBridgeChecks: 0, resolveAgendaArtifact: async () => { throw new Error("Should not fetch"); } }))[0];
  assert.equal(deferred.id, recorded.id, "Exhausted request budget preserves ambiguous records");
  const secondEvent = { ...scheduled, id: "different-scheduled-id", agenda_url: eventAgenda.replace("2549", "2550"), source_urls: [eventAgenda.replace("2549", "2550"), packet] };
  const ambiguous = (await reconcileCarsonGranicusIdentities([recorded], [scheduled, secondEvent], { resolveAgendaArtifact: async () => artifact }))[0];
  assert.equal(ambiguous.id, recorded.id, "Two scheduled event identities sharing one packet remain ambiguous");
  const persisted: PublicMeetingRecord = { ...scheduled, agenda_url: clipAgenda, source_urls: linked.sourceUrls, meeting_alias_ids: linked.aliasMeetingIds, source_identity_evidence: linked.sourceIdentityEvidence };
  const repeated = (await reconcileCarsonGranicusIdentities([{ ...recorded, id: "new-hash-after-minutes" }], [persisted], { resolveAgendaArtifact: async () => { throw new Error("Exact clip identity does not need network verification"); } }))[0];
  assert.equal(repeated.id, scheduled.id);
  assert.equal(repeated.meetingDate, scheduled.meeting_date);
  assert.ok(repeated.aliasMeetingIds?.includes("later-clip-id"), "Earlier route aliases survive another refresh");
  console.log("Nevada meeting adapters passed: body attribution, prior-minute dates, DST, missing time/agenda, cancellation, annual rollover, PTO occurrence identity and notice discovery.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
