import Link from "next/link";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { getCommunityEventTypeLabel } from "@/lib/community/events";
import { updateEventRsvp } from "@/lib/community/event-participation-actions";
import type { CommunityEventSummary, EventRsvpStatus } from "@/types/domain";

type CommunityEventCardProps = {
  event: CommunityEventSummary;
  attendanceCount?: number;
  confirmedCount?: number;
  distanceLabel?: string | null;
  momentumLabel?: string | null;
  viewerStatus?: EventRsvpStatus | null;
  returnPath?: string;
  showQuickRsvp?: boolean;
  guestMode?: boolean;
};

export function CommunityEventCard({
  event,
  attendanceCount,
  confirmedCount,
  distanceLabel,
  momentumLabel,
  viewerStatus,
  returnPath,
  showQuickRsvp = false,
  guestMode = false,
}: CommunityEventCardProps) {
  const isAttending = viewerStatus === "attending" || viewerStatus === "confirmed";
  const eventLabel = getCommunityEventTypeLabel(event.eventType);
  const startsAt = new Date(event.startsAt);
  const formatLabel = event.format === "virtual" ? "Virtual" : "In person";
  const resolvedReturnPath = returnPath ?? `/events/${event.id}`;

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
            {eventLabel}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
            {formatLabel}
          </span>
          <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">
            {event.sponsorType}
          </span>
          {event.issueLabel ? (
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{event.issueLabel}</span>
          ) : null}
          {distanceLabel ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
              {distanceLabel}
            </span>
          ) : null}
          {momentumLabel ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              {momentumLabel}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <FavoriteToggleControl targetType="event" targetId={event.id} />
          <ShareActionMenu
            target={{
              entityType: "event",
              entityId: event.id,
              title: event.title,
              href: `/events/${event.id}`,
              summary: event.description,
              issueTag: event.issueLabel ?? null,
            }}
            returnPath={resolvedReturnPath}
            guestMode={guestMode}
            iconOnly
          />
        </div>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-ink">
        <Link href={`/events/${event.id}`} className="transition hover:text-civic-700">
          {event.title}
        </Link>
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        {startsAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ·{" "}
        {startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {event.jurisdictionName}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{event.description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-600">
        {event.eventType === "interview" && (event.interviewerName || event.interviewSubjectName) ? (
          <p>
            {event.interviewerName ? `Interviewer: ${event.interviewerName}` : null}
            {event.interviewerName && event.interviewSubjectName ? " · " : null}
            {event.interviewSubjectName ? `Subject: ${event.interviewSubjectName}` : null}
          </p>
        ) : null}
        {event.locationLabel ? <p>Location: {event.locationLabel}</p> : null}
        {event.meetingUrl ? (
          <p>
            Meeting link:{" "}
            <a href={event.meetingUrl} className="font-semibold text-civic-700 hover:text-civic-900">
              Join details
            </a>
          </p>
        ) : null}
        {typeof attendanceCount === "number" || typeof confirmedCount === "number" ? (
          <p>
            {typeof attendanceCount === "number" ? `${attendanceCount} attending` : null}
            {typeof attendanceCount === "number" && typeof confirmedCount === "number" ? " · " : null}
            {typeof confirmedCount === "number" ? `${confirmedCount} confirmed` : null}
          </p>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {event.sponsorHref ? (
          <Link href={event.sponsorHref} className="font-semibold text-civic-700 hover:text-civic-900">
            Hosted by {event.sponsorName}
          </Link>
        ) : (
          <p className="font-semibold text-slate-700">Hosted by {event.sponsorName}</p>
        )}
        {event.issueLabel ? (
          <Link
            href={`/voting?search=${encodeURIComponent(event.issueLabel)}`}
            className="font-semibold text-orange-700 hover:text-orange-900"
          >
            Explore issue
          </Link>
        ) : null}
        <Link href={`/events/${event.id}`} className="font-semibold text-slate-700 hover:text-civic-700">
          View event
        </Link>
      </div>
      {showQuickRsvp && !guestMode ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={updateEventRsvp}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="status" value="attending" />
            <input type="hidden" name="returnPath" value={resolvedReturnPath} />
            <FormSubmitButton
              idleLabel={viewerStatus === "confirmed" ? "Confirmed" : isAttending ? "Attending" : "Attend"}
              pendingLabel="Saving..."
              className={
                isAttending
                  ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              }
            />
          </form>
          <form action={updateEventRsvp}>
            <input type="hidden" name="eventId" value={event.id} />
            <input type="hidden" name="status" value="maybe" />
            <input type="hidden" name="returnPath" value={resolvedReturnPath} />
            <FormSubmitButton
              idleLabel={viewerStatus === "maybe" ? "Maybe" : "Maybe"}
              pendingLabel="Saving..."
              className={
                viewerStatus === "maybe"
                  ? "rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:text-amber-700"
              }
            />
          </form>
        </div>
      ) : guestMode ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">
          Browse is open in guest mode. Verify to RSVP, attend, or save this event.
        </div>
      ) : null}
    </article>
  );
}
