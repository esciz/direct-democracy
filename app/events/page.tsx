import Link from "next/link";

import { CommunityEventCard } from "@/components/domain/community-event-card";
import { CommunitySelector } from "@/components/domain/community-selector";
import { ActionLabel, ThumbsUpIcon } from "@/components/ui/action-icons";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageIntro } from "@/components/ui/page-intro";
import { canUserApproveEventProposal, canUserCreateCommunityEvent } from "@/lib/auth/guards";
import { isGuestUser } from "@/lib/auth/session";
import { getCommunityById, getDefaultCommunityForUser } from "@/lib/community/communities";
import {
  getDiscoverableEventsForUser,
  type EventBrowseDate,
  type EventBrowseDistance,
  type EventBrowseSort,
  type EventBrowseType,
} from "@/lib/community/event-discovery";
import { getOpenEventProposals, MIN_PROPOSAL_SUPPORTERS } from "@/lib/community/event-proposals";
import { approveEventProposal, supportEventProposal } from "@/lib/community/event-actions";
import { getCurrentUser } from "@/lib/server/auth-session";

type EventsPageProps = {
  searchParams?: Promise<{
    communityId?: string;
    view?: string;
    event?: string;
    eventError?: string;
    distance?: string;
    date?: string;
    type?: string;
    sort?: string;
    denied?: string;
  }>;
};

function normalizeDistance(value: string | undefined): EventBrowseDistance {
  return value === "nearby" || value === "regional" ? value : "all";
}

function normalizeDate(value: string | undefined): EventBrowseDate {
  return value === "today" || value === "week" || value === "later" ? value : "all";
}

function normalizeType(value: string | undefined): EventBrowseType {
  return value === "civic" || value === "rally" || value === "meeting" || value === "social" || value === "cultural" ? value : "all";
}

function normalizeSort(value: string | undefined): EventBrowseSort {
  return value === "soonest" || value === "attending" || value === "trending" ? value : "recommended";
}

function buildEventsHref({
  communityId,
  view,
  distance,
  date,
  type,
  sort,
}: {
  communityId: string;
  view?: string;
  distance?: EventBrowseDistance;
  date?: EventBrowseDate;
  type?: EventBrowseType;
  sort?: EventBrowseSort;
}) {
  const params = new URLSearchParams({ communityId });
  if (view && view !== "upcoming") params.set("view", view);
  if (distance && distance !== "all") params.set("distance", distance);
  if (date && date !== "all") params.set("date", date);
  if (type && type !== "all") params.set("type", type);
  if (sort && sort !== "recommended") params.set("sort", sort);
  return `/events?${params.toString()}`;
}

function renderDayKey(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const user = await getCurrentUser();
  const params = searchParams ? await searchParams : undefined;
  const defaultCommunity = getDefaultCommunityForUser(user);
  const selectedCommunityId = params?.communityId ?? defaultCommunity.id;
  const currentCommunity = getCommunityById(selectedCommunityId) ?? defaultCommunity;
  const selectedView = params?.view === "calendar" ? "calendar" : "upcoming";
  const selectedDistance = normalizeDistance(params?.distance);
  const selectedDate = normalizeDate(params?.date);
  const selectedType = normalizeType(params?.type);
  const selectedSort = normalizeSort(params?.sort);
  const guestMode = isGuestUser(user);
  const canCreateEvents = await canUserCreateCommunityEvent(user);
  const canApproveProposals = canUserApproveEventProposal(user);
  const [events, proposals] = await Promise.all([
    getDiscoverableEventsForUser(user, {
      communityId: selectedCommunityId,
      distance: selectedDistance,
      date: selectedDate,
      type: selectedType,
      sort: selectedSort,
    }),
    getOpenEventProposals(selectedCommunityId),
  ]);

  const groupedEvents = events.reduce<Record<string, typeof events>>((groups, event) => {
    const key = renderDayKey(event.startsAt);
    groups[key] = [...(groups[key] ?? []), event];
    return groups;
  }, {});

  const viewTabs = [
    {
      label: "Upcoming",
      href: buildEventsHref({ communityId: selectedCommunityId, distance: selectedDistance, date: selectedDate, type: selectedType, sort: selectedSort }),
      active: selectedView === "upcoming",
    },
    {
      label: "Calendar",
      href: buildEventsHref({
        communityId: selectedCommunityId,
        view: "calendar",
        distance: selectedDistance,
        date: selectedDate,
        type: selectedType,
        sort: selectedSort,
      }),
      active: selectedView === "calendar",
    },
  ];
  const sortTabs = [
    { label: "Recommended", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: selectedType, sort: "recommended" }), active: selectedSort === "recommended" },
    { label: "Soonest", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: selectedType, sort: "soonest" }), active: selectedSort === "soonest" },
    { label: "Most attending", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: selectedType, sort: "attending" }), active: selectedSort === "attending" },
    { label: "Trending", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: selectedType, sort: "trending" }), active: selectedSort === "trending" },
  ];
  const distanceTabs = [
    { label: "All distances", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: "all", date: selectedDate, type: selectedType, sort: selectedSort }), active: selectedDistance === "all" },
    { label: "Nearby", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: "nearby", date: selectedDate, type: selectedType, sort: selectedSort }), active: selectedDistance === "nearby" },
    { label: "Regional", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: "regional", date: selectedDate, type: selectedType, sort: selectedSort }), active: selectedDistance === "regional" },
  ];
  const dateTabs = [
    { label: "Any date", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: "all", type: selectedType, sort: selectedSort }), active: selectedDate === "all" },
    { label: "Today", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: "today", type: selectedType, sort: selectedSort }), active: selectedDate === "today" },
    { label: "This week", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: "week", type: selectedType, sort: selectedSort }), active: selectedDate === "week" },
    { label: "Later", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: "later", type: selectedType, sort: selectedSort }), active: selectedDate === "later" },
  ];
  const typeTabs = [
    { label: "All types", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: "all", sort: selectedSort }), active: selectedType === "all" },
    { label: "Civic", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: "civic", sort: selectedSort }), active: selectedType === "civic" },
    { label: "Rally", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: "rally", sort: selectedSort }), active: selectedType === "rally" },
    { label: "Meeting", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: "meeting", sort: selectedSort }), active: selectedType === "meeting" },
    { label: "Social", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: "social", sort: selectedSort }), active: selectedType === "social" },
    { label: "Cultural", href: buildEventsHref({ communityId: selectedCommunityId, view: selectedView, distance: selectedDistance, date: selectedDate, type: "cultural", sort: selectedSort }), active: selectedType === "cultural" },
  ];

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Events"
        title={`Community coordination in ${currentCommunity.name}`}
        description="Upcoming meetings, forums, rallies, and issue-based gatherings from trusted citizens, candidates, officials, and community organizers."
        meta={
          <>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{currentCommunity.name}</span>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{selectedSort === "recommended" ? "Recommended" : selectedSort}</span>
            {guestMode ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Guest browse · Read only</span>
            ) : null}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/my-community?communityId=${selectedCommunityId}`}
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Back to My Community
            </Link>
            {canCreateEvents ? (
              <Link
                href={`/events/create?communityId=${selectedCommunityId}`}
                className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {user.role === "citizen" ? "Create or propose event" : "Create event"}
              </Link>
            ) : null}
            {guestMode ? (
              <Link
                href="/get-started?step=account"
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              >
                Verify to participate
              </Link>
            ) : null}
          </div>
        }
      />

      {params?.denied === "create-event" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Your account cannot create events from this view.
        </section>
      ) : null}

      <CommunitySelector
        currentCommunity={currentCommunity}
        followedCommunities={[]}
        suggestedCommunities={[]}
        followedIds={[]}
        returnPath="/events"
        destinationBase="/events"
      />

      {params?.event === "created" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Event published. It now appears in this community calendar and on My Community.
        </section>
      ) : null}
      {params?.event === "rsvp-saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          RSVP saved. You can open the event to confirm attendance and participate once you arrive.
        </section>
      ) : null}
      {params?.event === "attendance-confirmed" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Attendance confirmed. Event posting and attendee sentiment are now unlocked for this event where applicable.
        </section>
      ) : null}
      {params?.event === "post-created" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your event post is live on the event page and in the main feed.
        </section>
      ) : null}
      {params?.denied === "guest" ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          Guest browsing is read-only. Create an account and verify to support proposals or RSVP to events.
        </section>
      ) : null}
      {params?.event === "sentiment-saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your attendee sentiment has been added to the event totals.
        </section>
      ) : null}
      {params?.event === "proposed" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your civic event proposal is live. It becomes an official event once it reaches enough support or is approved by a trusted citizen.
        </section>
      ) : null}
      {params?.event === "proposal-supported" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your support was added to that civic event proposal.
        </section>
      ) : null}
      {params?.event === "proposal-promoted" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          The proposal reached the threshold and is now an official event.
        </section>
      ) : null}
      {params?.eventError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {params.eventError === "attendance" && "Attendance could not be confirmed yet. Make sure you marked Attending and are at the event during its active window."}
          {params.eventError === "posting" && "Event posting is only available for confirmed attendees during the event and shortly after it ends."}
          {params.eventError === "sentiment" && "Attendee sentiment is only available for confirmed attendees at eligible events."}
          {params.eventError === "content" && "Event posts need a little more detail before they can be published."}
          {params.eventError === "invalid" && "That event action could not be completed."}
          {params.eventError === "proposalMissing" && "That proposal is no longer available."}
        </section>
      ) : null}

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
              const proposalReturnPath = buildEventsHref({
                communityId: selectedCommunityId,
                view: selectedView,
                distance: selectedDistance,
                date: selectedDate,
                type: selectedType,
                sort: selectedSort,
              });

              return (
                <article key={proposal.id} className="rounded-[1.5rem] border border-orange-200 bg-white p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-800">
                      Proposal
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {proposal.eventType}
                    </span>
                    <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
                      {proposal.supporterUserIds.length} supporter{proposal.supporterUserIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{proposal.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {new Date(proposal.startsAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · {proposal.jurisdictionName}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{proposal.description}</p>
                  <p className="mt-3 text-sm text-slate-700">
                    <span className="font-semibold">Purpose:</span> {proposal.purpose}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {!guestMode ? (
                      <form action={supportEventProposal}>
                        <input type="hidden" name="proposalId" value={proposal.id} />
                        <input type="hidden" name="returnPath" value={proposalReturnPath} />
                        <FormSubmitButton
                          idleLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>{viewerSupported ? "Supported" : "Support proposal"}</ActionLabel>}
                          pendingLabel={<ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>Saving...</ActionLabel>}
                          disabled={viewerSupported}
                          className={
                            viewerSupported
                              ? "rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                              : "rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300"
                          }
                        />
                      </form>
                    ) : (
                      <Link
                        href="/get-started?step=account"
                        className="inline-flex rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300"
                      >
                        Verify to support proposal
                      </Link>
                    )}
                    {canApproveProposals ? (
                      <form action={approveEventProposal}>
                        <input type="hidden" name="proposalId" value={proposal.id} />
                        <input type="hidden" name="returnPath" value={proposalReturnPath} />
                        <FormSubmitButton
                          idleLabel="Approve as trusted citizen"
                          pendingLabel="Approving..."
                          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        />
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">View</p>
            <p className="mt-2 text-sm text-slate-600">Browse events by timing, turnout, and distance without losing community context.</p>
          </div>
          <FilterTabs tabs={viewTabs} />
        </div>
        <div className="mt-4 space-y-4">
          <FilterTabs tabs={sortTabs} />
          <FilterTabs tabs={distanceTabs} />
          <FilterTabs tabs={dateTabs} />
          <FilterTabs tabs={typeTabs} />
        </div>
      </section>

      {selectedView === "upcoming" ? (
        <section className="grid gap-4">
          {events.length ? (
            events.map((event) => (
              <CommunityEventCard
                key={event.id}
                event={event}
                attendanceCount={event.attendanceCount}
                confirmedCount={event.confirmedCount}
                distanceLabel={event.distanceLabel}
                momentumLabel={event.momentumLabel}
                viewerStatus={event.viewerStatus}
                returnPath={buildEventsHref({
                  communityId: selectedCommunityId,
                  view: selectedView,
                  distance: selectedDistance,
                  date: selectedDate,
                  type: selectedType,
                  sort: selectedSort,
                })}
                showQuickRsvp
                guestMode={guestMode}
              />
            ))
          ) : (
            <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 text-sm text-slate-600 shadow-card backdrop-blur">
              No events match this community view yet.
            </section>
          )}
        </section>
      ) : (
        <section className="grid gap-6">
          {Object.entries(groupedEvents).length ? (
            Object.entries(groupedEvents).map(([dayLabel, dayEvents]) => (
              <section key={dayLabel} className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Calendar</p>
                    <h2 className="mt-2 text-xl font-semibold text-ink">{dayLabel}</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-5 grid gap-4">
                  {dayEvents.map((event) => (
                    <CommunityEventCard
                      key={event.id}
                      event={event}
                      attendanceCount={event.attendanceCount}
                      confirmedCount={event.confirmedCount}
                      distanceLabel={event.distanceLabel}
                      momentumLabel={event.momentumLabel}
                      viewerStatus={event.viewerStatus}
                      returnPath={buildEventsHref({
                        communityId: selectedCommunityId,
                        view: selectedView,
                        distance: selectedDistance,
                        date: selectedDate,
                        type: selectedType,
                        sort: selectedSort,
                      })}
                      showQuickRsvp
                      guestMode={guestMode}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 text-sm text-slate-600 shadow-card backdrop-blur">
              No events match this community view yet.
            </section>
          )}
        </section>
      )}
    </div>
  );
}
