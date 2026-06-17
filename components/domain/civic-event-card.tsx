import Link from "next/link";

import { FavoriteToggleControl } from "@/components/domain/favorite-toggle-control";
import { ShareActionMenu } from "@/components/domain/share-action-menu";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { getCivicEventStatusLabel, getCivicEventTypeLabel } from "@/lib/events/civic-events";
import { updateEventRsvp } from "@/lib/community/event-participation-actions";
import type { CivicEvent } from "@/lib/events/types";

type CivicEventCardProps = {
  event: CivicEvent;
  returnPath?: string;
  showQuickRsvp?: boolean;
  guestMode?: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) return "Schedule source";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildCalendarHref(event: CivicEvent) {
  if (!event.startsAt) return null;
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt ?? start.getTime() + 90 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${format(start)}/${format(end)}`,
    details: [event.description, event.sourceUrl ? `Source: ${event.sourceUrl}` : null].filter(Boolean).join("\n\n"),
    location: event.locationName ?? event.address ?? event.virtualUrl ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function SourceLink({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <Link href={href} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-civic-400 hover:text-civic-700">
      {label}
    </Link>
  );
}

function formatMode(mode: CivicEvent["eventMode"]) {
  if (mode === "virtual") return "Virtual";
  if (mode === "in_person") return "In-person";
  if (mode === "hybrid") return "Hybrid";
  return "Format pending";
}

export function CivicEventCard({ event, returnPath, showQuickRsvp = false, guestMode = false }: CivicEventCardProps) {
  const eventHref = `/events/${event.id}`;
  const resolvedReturnPath = returnPath ?? eventHref;
  const typeLabel = getCivicEventTypeLabel(event.eventType);
  const statusLabel = getCivicEventStatusLabel(event.status);
  const calendarHref = buildCalendarHref(event);
  const canRsvp = !event.isOfficialMeeting && Boolean(event.communityEventId);
  const isAttending = event.viewerStatus === "attending" || event.viewerStatus === "confirmed";

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
              {typeLabel}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${event.status === "completed" ? "bg-slate-200 text-slate-700" : "bg-civic-50 text-civic-700"}`}>
              {statusLabel}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${event.isOfficialMeeting ? "bg-sky-50 text-sky-700" : "bg-orange-50 text-orange-700"}`}>
              {event.sourceProviderLabel}
            </span>
            {event.distanceLabel ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                {event.distanceLabel}
              </span>
            ) : null}
            {event.momentumLabel ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                {event.momentumLabel}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-ink">
            <Link href={eventHref} className="transition hover:text-civic-700">
              {event.title}
            </Link>
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {formatDateTime(event.startsAt)} · {event.jurisdiction}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FavoriteToggleControl targetType="event" targetId={event.id} />
          <ShareActionMenu
            target={{
              entityType: "event",
              entityId: event.id,
              title: event.title,
              href: eventHref,
              summary: event.description,
              issueTag: event.relatedIssueLabels[0] ?? null,
            }}
            returnPath={resolvedReturnPath}
            guestMode={guestMode}
            iconOnly
          />
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-600">{event.description}</p>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
        <p>
          <span className="font-semibold text-slate-800">Host:</span> {event.hostName}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Location:</span> {event.locationName ?? event.address ?? (event.virtualUrl ? "Virtual" : "Location pending")}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Format:</span> {formatMode(event.eventMode)}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Community:</span> {event.jurisdiction}
        </p>
        {event.relatedEntityLabels.length ? (
          <p className="md:col-span-2">
            <span className="font-semibold text-slate-800">Linked:</span> {event.relatedEntityLabels.join(", ")}
          </p>
        ) : null}
        {event.relatedIssueLabels.length ? (
          <p className="md:col-span-2">
            <span className="font-semibold text-slate-800">Related issues:</span> {event.relatedIssueLabels.join(", ")}
          </p>
        ) : null}
        {typeof event.attendanceCount === "number" && !event.isOfficialMeeting ? (
          <p>
            {event.attendanceCount} attending · {event.confirmedCount} confirmed
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <SourceLink href={event.agendaUrl} label={event.status === "completed" ? "Agenda" : "Agenda / packet"} />
        <SourceLink href={event.packetUrl} label="Packet" />
        <SourceLink href={event.minutesUrl} label="Minutes" />
        <SourceLink href={event.videoUrl ?? event.virtualUrl} label={event.status === "completed" ? "Video / recording" : "Virtual / video"} />
        <SourceLink href={event.sourceUrl} label={event.isOfficialMeeting ? "Official source" : "Source"} />
        {calendarHref ? (
          <Link href={calendarHref} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-civic-400 hover:text-civic-700">
            Add to calendar
          </Link>
        ) : null}
        <Link href={eventHref} className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800">
          View event
        </Link>
      </div>

      {showQuickRsvp && canRsvp && !guestMode ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={updateEventRsvp}>
            <input type="hidden" name="eventId" value={event.communityEventId ?? event.id} />
            <input type="hidden" name="status" value="attending" />
            <input type="hidden" name="returnPath" value={resolvedReturnPath} />
            <FormSubmitButton
              idleLabel={event.viewerStatus === "confirmed" ? "Confirmed" : isAttending ? "Attending" : "Attend"}
              pendingLabel="Saving..."
              className={
                isAttending
                  ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
              }
            />
          </form>
          <form action={updateEventRsvp}>
            <input type="hidden" name="eventId" value={event.communityEventId ?? event.id} />
            <input type="hidden" name="status" value="maybe" />
            <input type="hidden" name="returnPath" value={resolvedReturnPath} />
            <FormSubmitButton
              idleLabel="Maybe"
              pendingLabel="Saving..."
              className={
                event.viewerStatus === "maybe"
                  ? "rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:text-amber-700"
              }
            />
          </form>
        </div>
      ) : null}
    </article>
  );
}
