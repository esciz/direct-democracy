import Link from "next/link";

import { CivicEventCard } from "@/components/domain/civic-event-card";
import { CommunitySelector } from "@/components/domain/community-selector";
import { ActionLabel, ThumbsUpIcon } from "@/components/ui/action-icons";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageIntro } from "@/components/ui/page-intro";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { canUserApproveEventProposal, canUserCreateCommunityEvent } from "@/lib/auth/guards";
import { isGuestUser } from "@/lib/auth/session";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import { approveEventProposal, supportEventProposal } from "@/lib/community/event-actions";
import { getOpenEventProposals, MIN_PROPOSAL_SUPPORTERS } from "@/lib/community/event-proposals";
import {
  getCivicEventsForBrowse,
  type CivicEventBrowseMode,
  type CivicEventBrowseSort,
  type CivicEventBrowseSource,
  type CivicEventBrowseStatus,
  type CivicEventBrowseType,
} from "@/lib/events/civic-events";
import { getCurrentUser } from "@/lib/server/auth-session";
import type { CivicEvent } from "@/lib/events/types";

type EventsPageProps = {
  searchParams?: Promise<{
    communityId?: string;
    status?: string;
    source?: string;
    type?: string;
    mode?: string;
    dateFrom?: string;
    dateTo?: string;
    linkedTo?: string;
    sort?: string;
    event?: string;
    eventError?: string;
    denied?: string;
    page?: string;
  }>;
};

const EVENTS_PER_PAGE = 24;

function normalizeStatus(value: string | undefined): CivicEventBrowseStatus {
  if (value === "all" || value === "completed") return value;
  return "upcoming";
}

function normalizeSource(value: string | undefined): CivicEventBrowseSource {
  return value === "official" || value === "community" ? value : "all";
}

function normalizeType(value: string | undefined): CivicEventBrowseType {
  return value === "official_meeting" || value === "public_hearing" || value === "rally" || value === "forum" || value === "election_deadline" || value === "community_event" ? value : "all";
}

function normalizeMode(value: string | undefined): CivicEventBrowseMode {
  return value === "virtual" || value === "in_person" || value === "hybrid" ? value : "all";
}

function normalizeSort(value: string | undefined): CivicEventBrowseSort {
  return value === "soonest" || value === "recent" || value === "recommended" ? value : "official-first";
}

function buildEventsHref({
  communityId,
  status,
  source,
  type,
  mode,
  dateFrom,
  dateTo,
  linkedTo,
  sort,
  page,
}: {
  communityId?: string;
  status?: CivicEventBrowseStatus;
  source?: CivicEventBrowseSource;
  type?: CivicEventBrowseType;
  mode?: CivicEventBrowseMode;
  dateFrom?: string;
  dateTo?: string;
  linkedTo?: string;
  sort?: CivicEventBrowseSort;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (communityId) params.set("communityId", communityId);
  if (status && status !== "upcoming") params.set("status", status);
  if (source && source !== "all") params.set("source", source);
  if (type && type !== "all") params.set("type", type);
  if (mode && mode !== "all") params.set("mode", mode);
  if (dateFrom?.trim()) params.set("dateFrom", dateFrom.trim());
  if (dateTo?.trim()) params.set("dateTo", dateTo.trim());
  if (linkedTo?.trim()) params.set("linkedTo", linkedTo.trim());
  if (sort && sort !== "official-first") params.set("sort", sort);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/events?${query}` : "/events";
}

function renderDayKey(event: CivicEvent) {
  if (!event.startsAt) return event.status === "completed" ? "Completed records" : "Official meeting sources";
  return new Date(event.startsAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupEvents(events: CivicEvent[]) {
  return events.reduce<Record<string, CivicEvent[]>>((groups, event) => {
    const key = renderDayKey(event);
    groups[key] = [...(groups[key] ?? []), event];
    return groups;
  }, {});
}

function EventCountSummary({ events }: { events: CivicEvent[] }) {
  const officialCount = events.filter((event) => event.isOfficialMeeting).length;
  const completedCount = events.filter((event) => event.status === "completed").length;
  const upcomingCount = events.filter((event) => event.status === "upcoming" && event.startsAt).length;
  const sourceRegistryCount = events.filter((event) => event.sourceProvider === "public_meeting_source_registry").length;

  return (
    <section className="grid gap-3 md:grid-cols-4">
      <div className="rounded-[1.25rem] border border-white/70 bg-white/85 p-4 shadow-card backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Official meetings</p>
        <p className="mt-2 text-2xl font-semibold text-ink">{officialCount}</p>
      </div>
      <div className="rounded-[1.25rem] border border-white/70 bg-white/85 p-4 shadow-card backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Upcoming dates</p>
        <p className="mt-2 text-2xl font-semibold text-ink">{upcomingCount}</p>
      </div>
      <div className="rounded-[1.25rem] border border-white/70 bg-white/85 p-4 shadow-card backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Completed</p>
        <p className="mt-2 text-2xl font-semibold text-ink">{completedCount}</p>
      </div>
      <div className="rounded-[1.25rem] border border-white/70 bg-white/85 p-4 shadow-card backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Calendar sources</p>
        <p className="mt-2 text-2xl font-semibold text-ink">{sourceRegistryCount}</p>
      </div>
    </section>
  );
}

function getEventSuccessMessage(value: string | undefined) {
  switch (value) {
    case "created":
      return "Event published. It now appears in this community calendar and on My Community.";
    case "rsvp-saved":
      return "RSVP saved. You can open the event to confirm attendance and participate once you arrive.";
    case "attendance-confirmed":
      return "Attendance confirmed. Event posting and attendee sentiment are now unlocked for this event where applicable.";
    case "post-created":
      return "Your event post is live on the event page and in the main feed.";
    case "sentiment-saved":
      return "Your attendee sentiment has been added to the event totals.";
    case "statement-saved":
      return "Your event statement has been recorded.";
    case "proposed":
      return "Your civic event proposal is live. It becomes an official event once it reaches enough support or is approved by a trusted citizen.";
    case "proposal-supported":
      return "Your support was added to that civic event proposal.";
    case "proposal-promoted":
      return "The proposal reached the threshold and is now an official event.";
    default:
      return null;
  }
}

function getEventErrorMessage(value: string | undefined) {
  switch (value) {
    case "attendance":
      return "Attendance could not be confirmed yet. Make sure you marked Attending and are at the event during its active window.";
    case "posting":
      return "Event posting is only available for confirmed attendees during the event and shortly after it ends.";
    case "sentiment":
      return "Attendee sentiment is only available for confirmed attendees at eligible events.";
    case "statement":
      return "Event statements are only available for confirmed attendees at eligible events.";
    case "content":
      return "Event posts need a little more detail before they can be published.";
    case "proposalMissing":
      return "That proposal is no longer available.";
    case "proposalApproval":
      return "Only trusted citizens or admins can approve event proposals.";
    case "invalid":
      return "That event action could not be completed.";
    default:
      return value ? "That event action is not available from this view." : null;
  }
}

function getDeniedMessage(value: string | undefined) {
  switch (value) {
    case "create-event":
      return "Your account cannot create events from this view.";
    case "guest":
      return "Guest browsing is read-only. Create an account and verify to support proposals or RSVP to events.";
    default:
      return null;
  }
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = getCommunityById(params?.communityId)?.id;
  const currentCommunity = selectedCommunityId ? getCommunityById(selectedCommunityId) ?? defaultCommunity : null;
  const selectedStatus = normalizeStatus(params?.status);
  const selectedSource = normalizeSource(params?.source);
  const selectedType = normalizeType(params?.type);
  const selectedMode = normalizeMode(params?.mode);
  const selectedDateFrom = params?.dateFrom ?? "";
  const selectedDateTo = params?.dateTo ?? "";
  const selectedLinkedTo = params?.linkedTo ?? "";
  const selectedSort = normalizeSort(params?.sort);
  const requestedPage = Math.max(1, Number.parseInt(params?.page ?? "1", 10) || 1);
  const guestMode = isGuestUser(user);
  const canCreateEvents = await canUserCreateCommunityEvent(user);
  const canApproveProposals = canUserApproveEventProposal(user);
  const [events, allCommunityEvents, proposals] = await Promise.all([
    getCivicEventsForBrowse(user, {
      communityId: selectedCommunityId,
      status: selectedStatus,
      source: selectedSource,
      type: selectedType,
      mode: selectedMode,
      dateFrom: selectedDateFrom,
      dateTo: selectedDateTo,
      linkedTo: selectedLinkedTo,
      sort: selectedSort,
    }),
    getCivicEventsForBrowse(user, { communityId: selectedCommunityId, status: "all", source: "all", type: "all", sort: "official-first" }),
    selectedCommunityId ? getOpenEventProposals(selectedCommunityId) : Promise.resolve([]),
  ]);
  const totalPages = Math.max(1, Math.ceil(events.length / EVENTS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const visibleEvents = events.slice((currentPage - 1) * EVENTS_PER_PAGE, currentPage * EVENTS_PER_PAGE);
  const groupedEvents = groupEvents(visibleEvents);
  const lastSourceRefresh = allCommunityEvents
    .map((event) => event.lastFetchedAt ? Date.parse(event.lastFetchedAt) : Number.NaN)
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];
  const sourceAgeDays = Number.isFinite(lastSourceRefresh) ? Math.max(0, Math.floor((Date.now() - lastSourceRefresh) / 86_400_000)) : null;
  const returnPath = buildEventsHref({
    communityId: selectedCommunityId,
    status: selectedStatus,
    source: selectedSource,
    type: selectedType,
    mode: selectedMode,
    dateFrom: selectedDateFrom,
    dateTo: selectedDateTo,
    linkedTo: selectedLinkedTo,
    sort: selectedSort,
    page: currentPage,
  });
  const statusTabs = [
    { label: "All", href: buildEventsHref({ communityId: selectedCommunityId, status: "all", source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedStatus === "all" },
    { label: "Upcoming", href: buildEventsHref({ communityId: selectedCommunityId, status: "upcoming", source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedStatus === "upcoming" },
    { label: "Completed", href: buildEventsHref({ communityId: selectedCommunityId, status: "completed", source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedStatus === "completed" },
  ];
  const sourceTabs = [
    { label: "All sources", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: "all", type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedSource === "all" },
    { label: "Official / source-backed", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: "official", type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedSource === "official" },
    { label: "Community events", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: "community", type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedSource === "community" },
  ];
  const typeTabs = [
    { label: "All types", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: "all", mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedType === "all" },
    { label: "Official meeting", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: "official_meeting", mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedType === "official_meeting" },
    { label: "Public hearing", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: "public_hearing", mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedType === "public_hearing" },
    { label: "Forum", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: "forum", mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedType === "forum" },
    { label: "Rally", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: "rally", mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedType === "rally" },
    { label: "Election deadline", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: "election_deadline", mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedType === "election_deadline" },
    { label: "Community event", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: "community_event", mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedType === "community_event" },
  ];
  const modeTabs = [
    { label: "Any format", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: "all", dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedMode === "all" },
    { label: "Virtual", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: "virtual", dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedMode === "virtual" },
    { label: "In-person", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: "in_person", dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedMode === "in_person" },
    { label: "Hybrid", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: "hybrid", dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedMode === "hybrid" },
  ];
  const sortTabs = [
    { label: "Official first", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: "official-first" }), active: selectedSort === "official-first" },
    { label: "Soonest", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: "soonest" }), active: selectedSort === "soonest" },
    { label: "Recent", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: "recent" }), active: selectedSort === "recent" },
    { label: "Recommended", href: buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: "recommended" }), active: selectedSort === "recommended" },
  ];
  const deniedMessage = getDeniedMessage(params?.denied);
  const eventSuccessMessage = getEventSuccessMessage(params?.event);
  const eventErrorMessage = getEventErrorMessage(params?.eventError);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Events"
        title={currentCommunity ? `Civic calendar in ${currentCommunity.name}` : "Civic calendar"}
        description="Official meetings, public hearings, community forums, rallies, election deadlines, and local gatherings in one voter-facing calendar."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{currentCommunity?.name ?? "All known events"}</span>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Official meetings included</span>
            {sourceAgeDays !== null ? (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sourceAgeDays > 7 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                Sources refreshed {sourceAgeDays === 0 ? "today" : `${sourceAgeDays}d ago`}
              </span>
            ) : null}
            {guestMode ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Guest browse · Read only</span> : null}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={`/my-community?communityId=${selectedCommunityId ?? defaultCommunity.id}`} className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700">
              Back to My Community
            </Link>
            {canCreateEvents ? (
              <Link href={`/events/create?communityId=${selectedCommunityId ?? defaultCommunity.id}`} className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                {user.role === "citizen" ? "Create or propose event" : "Create event"}
              </Link>
            ) : null}
          </div>
        }
      />

      {deniedMessage ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {deniedMessage}
        </section>
      ) : null}
      {eventSuccessMessage ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          {eventSuccessMessage}
        </section>
      ) : null}
      {eventErrorMessage ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {eventErrorMessage}
        </section>
      ) : null}

      <CommunitySelector
        currentCommunity={currentCommunity ?? defaultCommunity}
        followedCommunities={[]}
        suggestedCommunities={[]}
        followedIds={[]}
        returnPath="/events"
        destinationBase="/events"
      />

      <EventCountSummary events={allCommunityEvents} />

      {proposals.length ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50/80 p-6 shadow-card backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Civic event proposals</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Pending higher-trust events</h2>
            <p className="mt-2 text-sm text-slate-600">
              Citizen-proposed civic events need {MIN_PROPOSAL_SUPPORTERS} supporters or a trusted citizen approval before going live.
            </p>
          </div>
          <div className="mt-5 grid gap-4">
            {proposals.slice(0, 4).map((proposal) => {
              const viewerSupported = proposal.supporterUserIds.includes(user.id);
              return (
                <article key={proposal.id} className="rounded-[1.5rem] border border-orange-200 bg-white p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-800">Proposal</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{proposal.eventType}</span>
                    <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                      {proposal.supporterUserIds.length} supporter{proposal.supporterUserIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{proposal.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {new Date(proposal.startsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {proposal.jurisdictionName}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{proposal.description}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {!guestMode ? (
                      <form action={supportEventProposal}>
                        <input type="hidden" name="proposalId" value={proposal.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <FormSubmitButton
                          idleLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>{viewerSupported ? "Supported" : "Support proposal"}</ActionLabel>}
                          pendingLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
                          disabled={viewerSupported}
                          className={viewerSupported ? "rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white" : "rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300"}
                        />
                      </form>
                    ) : null}
                    {canApproveProposals ? (
                      <form action={approveEventProposal}>
                        <input type="hidden" name="proposalId" value={proposal.id} />
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <FormSubmitButton idleLabel="Approve as trusted citizen" pendingLabel="Approving..." className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800" />
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Browse</p>
            <p className="mt-2 text-sm text-slate-600">Filter official meeting records, meeting-source calendars, and community events without mixing up their source status.</p>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <FilterTabs
            tabs={[
              { label: "All communities", href: buildEventsHref({ status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: !selectedCommunityId },
              { label: "Carson City", href: buildEventsHref({ communityId: "carson-city", status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedCommunityId === "carson-city" },
              { label: "Reno", href: buildEventsHref({ communityId: "reno", status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedCommunityId === "reno" },
              { label: "Washoe County", href: buildEventsHref({ communityId: "washoe-county", status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedCommunityId === "washoe-county" },
              { label: "Nevada", href: buildEventsHref({ communityId: "nevada", status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort }), active: selectedCommunityId === "nevada" },
            ]}
          />
          <FilterTabs tabs={statusTabs} />
          <FilterTabs tabs={sourceTabs} />
          <FilterTabs tabs={typeTabs} />
          <FilterTabs tabs={modeTabs} />
          <FilterTabs tabs={sortTabs} />
          <form action="/events" className="grid gap-3 rounded-[1.35rem] border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_1fr_1.5fr_auto]">
            {selectedCommunityId ? <input type="hidden" name="communityId" value={selectedCommunityId} /> : null}
            {selectedStatus !== "upcoming" ? <input type="hidden" name="status" value={selectedStatus} /> : null}
            {selectedSource !== "all" ? <input type="hidden" name="source" value={selectedSource} /> : null}
            {selectedType !== "all" ? <input type="hidden" name="type" value={selectedType} /> : null}
            {selectedMode !== "all" ? <input type="hidden" name="mode" value={selectedMode} /> : null}
            {selectedSort !== "official-first" ? <input type="hidden" name="sort" value={selectedSort} /> : null}
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              From
              <input type="date" name="dateFrom" defaultValue={selectedDateFrom} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              To
              <input type="date" name="dateTo" defaultValue={selectedDateTo} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Office, candidate, official, organization, issue
              <input name="linkedTo" defaultValue={selectedLinkedTo} placeholder="Example: Reno City Council" className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 placeholder:text-slate-500" />
            </label>
            <button className="self-end rounded-full bg-[linear-gradient(135deg,#34d399,#22d3ee)] px-5 py-2.5 text-sm font-semibold text-slate-950">
              Apply
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-6">
        {events.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm text-slate-400">
              Showing {visibleEvents.length} of {events.length} matching events
            </p>
          </div>
        ) : null}
        {Object.entries(groupedEvents).length ? (
          Object.entries(groupedEvents).map(([dayLabel, dayEvents]) => (
            <section key={dayLabel} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">{selectedStatus === "completed" ? "Completed" : "Events"}</p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">{dayLabel}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-5 grid gap-4">
                {dayEvents.map((event) => (
                  <CivicEventCard key={event.id} event={event} returnPath={returnPath} showQuickRsvp guestMode={guestMode} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 text-sm leading-6 text-slate-600 shadow-card backdrop-blur">
            <h2 className="text-lg font-semibold text-ink">No events found yet.</h2>
            <p className="mt-2">
              Events will appear here once imported from official calendars, agendas, public notices, or verified community sources.
            </p>
          </section>
        )}
        {totalPages > 1 ? (
          <div className="rounded-[1.75rem] border border-white/70 bg-white/85 px-6 shadow-card backdrop-blur">
            <PaginationNav
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={events.length}
              itemLabel="events"
              previousHref={currentPage > 1 ? buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort, page: currentPage - 1 }) : null}
              nextHref={currentPage < totalPages ? buildEventsHref({ communityId: selectedCommunityId, status: selectedStatus, source: selectedSource, type: selectedType, mode: selectedMode, dateFrom: selectedDateFrom, dateTo: selectedDateTo, linkedTo: selectedLinkedTo, sort: selectedSort, page: currentPage + 1 }) : null}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
