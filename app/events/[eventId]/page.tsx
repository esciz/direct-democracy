import Link from "next/link";
import { notFound } from "next/navigation";

import { CommunityEventCard } from "@/components/domain/community-event-card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { PageIntro } from "@/components/ui/page-intro";
import { ActionLabel, ThumbsUpIcon } from "@/components/ui/action-icons";
import { getDefaultSeedUser } from "@/lib/auth/mock-users";
import { getCurrentUser } from "@/lib/server/auth-session";
import { getCommunityEventById, getCommunityEventTypeLabel } from "@/lib/community/events";
import {
  canUserConfirmAttendance,
  canUserCreateEventPost,
  getEventPhotobook,
  getEventAttendanceState,
  getEventPosts,
  getEventSentimentSummary,
} from "@/lib/community/event-participation";
import { confirmEventAttendance, createEventPost, submitEventSentiment, updateEventRsvp } from "@/lib/community/event-participation-actions";
import type { PostSummary } from "@/types/domain";

type EventDetailPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<{
    event?: string;
    eventError?: string;
  }>;
};

function withSectionTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 1800): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function formatCompact(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderEventPostPreview(post: PostSummary) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
          Event Post
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{formatCompact(post.createdAt)}</span>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-ink">{post.authorName}</span> · {post.authorRole}
        </p>
        <p className="text-sm leading-7 text-slate-700">{post.content}</p>
        {post.mediaUrl ? (
          <a href={post.mediaUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.mediaUrl}
              alt={post.content.slice(0, 80)}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default async function EventDetailPage({ params, searchParams }: EventDetailPageProps) {
  const [{ eventId }, resolvedSearchParams] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const event = await getCommunityEventById(eventId);

  if (!event) {
    notFound();
  }

  const returnPath = `/events/${event.id}`;
  const eventTypeLabel = getCommunityEventTypeLabel(event.eventType);

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Event"
        title={event.title}
        description={event.description}
        meta={
          <>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
              {eventTypeLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {event.format === "virtual" ? "Virtual" : "In person"}
            </span>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700">
              {event.jurisdictionName}
            </span>
            {event.issueLabel ? (
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                {event.issueLabel}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link
              href="/events"
              className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              Back to Events
            </Link>
            <Link
              href={`/feed?search=${encodeURIComponent(event.title)}`}
              className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              View in Feed
            </Link>
          </>
        }
      />

      {resolvedSearchParams?.event === "rsvp-saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          RSVP saved. If you attend, confirm attendance to unlock event posting.
        </section>
      ) : null}
      {resolvedSearchParams?.event === "attendance-confirmed" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Attendance confirmed. You can now publish posts tied directly to this event.
        </section>
      ) : null}
      {resolvedSearchParams?.event === "post-created" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your event post is live and now appears both here and in the main feed as an Event Post.
        </section>
      ) : null}
      {resolvedSearchParams?.event === "sentiment-saved" ? (
        <section className="rounded-[1.75rem] border border-civic-200 bg-civic-50 p-5 text-sm text-civic-900 shadow-card">
          Your attendee sentiment was recorded in the event summary.
        </section>
      ) : null}
      {resolvedSearchParams?.eventError ? (
        <section className="rounded-[1.75rem] border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900 shadow-card">
          {resolvedSearchParams.eventError === "attendance" &&
            "Attendance could not be confirmed. RSVP as Attending first, then confirm attendance manually."}
          {resolvedSearchParams.eventError === "posting" && "Only confirmed attendees can publish event posts."}
          {resolvedSearchParams.eventError === "sentiment" && "Only confirmed attendees can submit sentiment for this event."}
          {resolvedSearchParams.eventError === "content" && "Please add a little more detail before publishing your event post."}
          {resolvedSearchParams.eventError === "invalid" && "That event action could not be completed."}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <EventDetailBody eventId={event.id} returnPath={returnPath} />
      </section>
    </div>
  );
}

async function EventDetailBody({ eventId, returnPath }: { eventId: string; returnPath: string }) {
  const [currentUser, event] = await Promise.all([
    withSectionTimeout(getCurrentUser(), "event current user", 1200).catch((error) => {
      console.error(`[event-detail] current user fallback for ${eventId}`, error);
      return getDefaultSeedUser();
    }),
    withSectionTimeout(getCommunityEventById(eventId), "event detail", 1400).catch((error) => {
      console.error(`[event-detail] event fallback for ${eventId}`, error);
      return null;
    }),
  ]);

  if (!event) {
    notFound();
  }

  const [attendanceState, canConfirmAttendance, canPostToEvent, eventPosts, photobook, sentimentSummary] = await Promise.all([
    withSectionTimeout(getEventAttendanceState(event.id, currentUser.id), "event attendance state", 1400).catch((error) => {
      console.error(`[event-detail] attendance fallback for ${eventId}`, error);
      return {
        viewerStatus: null,
        viewerConfirmedAt: null,
        attendingCount: 0,
        maybeCount: 0,
        confirmedCount: 0,
      };
    }),
    withSectionTimeout(canUserConfirmAttendance(event.id, currentUser.id), "event attendance confirmation", 1200).catch((error) => {
      console.error(`[event-detail] confirm attendance fallback for ${eventId}`, error);
      return false;
    }),
    withSectionTimeout(canUserCreateEventPost(event.id, currentUser.id), "event post permissions", 1200).catch((error) => {
      console.error(`[event-detail] event post permission fallback for ${eventId}`, error);
      return false;
    }),
    withSectionTimeout(getEventPosts(event.id), "event posts", 1600).catch((error) => {
      console.error(`[event-detail] event posts fallback for ${eventId}`, error);
      return [];
    }),
    withSectionTimeout(getEventPhotobook(event.id), "event photobook", 1600).catch((error) => {
      console.error(`[event-detail] event photobook fallback for ${eventId}`, error);
      return [];
    }),
    withSectionTimeout(getEventSentimentSummary(event.id, currentUser.id), "event sentiment", 1400).catch((error) => {
      console.error(`[event-detail] event sentiment fallback for ${eventId}`, error);
      return {
        enabled: false,
        viewerValue: null,
        supportCount: 0,
        dissentCount: 0,
        neutralCount: 0,
        totalCount: 0,
      };
    }),
  ]);

  return (
    <>
      <div className="space-y-6">
        <CommunityEventCard event={event} />

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Purpose</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Why this event is happening</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{event.purpose}</p>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Participation</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">RSVP and attendance</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                RSVPs help organize turnout. Confirmed attendance unlocks event posts and event-specific statements.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">{attendanceState.attendingCount} attending</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">{attendanceState.maybeCount} maybe</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{attendanceState.confirmedCount} confirmed attended</span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <form action={updateEventRsvp} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value="attending" />
              <input type="hidden" name="returnPath" value={returnPath} />
              <p className="text-sm font-semibold text-ink">Attending</p>
              <p className="mt-2 text-sm text-slate-600">Mark that you plan to be there. This is the first step toward confirmed attendance.</p>
              <div className="mt-4">
                <FormSubmitButton
                  idleLabel={
                    attendanceState.viewerStatus === "confirmed"
                      ? "Confirmed attended"
                      : attendanceState.viewerStatus === "attending"
                        ? "Marked Attending"
                        : "Mark Attending"
                  }
                  pendingLabel="Saving..."
                  className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                />
              </div>
            </form>

            <form action={updateEventRsvp} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="status" value="maybe" />
              <input type="hidden" name="returnPath" value={returnPath} />
              <p className="text-sm font-semibold text-ink">Maybe</p>
              <p className="mt-2 text-sm text-slate-600">Save the event without fully committing yet. Maybe does not unlock attendance confirmation.</p>
              <div className="mt-4">
                <FormSubmitButton
                  idleLabel={attendanceState.viewerStatus === "maybe" ? "Marked Maybe" : "Mark Maybe"}
                  pendingLabel="Saving..."
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-300 hover:text-civic-700"
                />
              </div>
            </form>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-civic-100 bg-civic-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Attendance confirmation</p>
                <p className="mt-2 text-sm text-slate-600">
                  Phase 1 keeps confirmation simple: mark yourself as Attending, then manually confirm attendance when you are there.
                </p>
              </div>
              <div className="text-sm text-slate-600">
                {attendanceState.viewerConfirmedAt ? (
                  <p className="rounded-full bg-emerald-100 px-3 py-2 font-semibold text-emerald-700">
                    Confirmed attended · {formatCompact(attendanceState.viewerConfirmedAt)}
                  </p>
                ) : (
                  <p className="rounded-full bg-slate-100 px-3 py-2 font-semibold text-slate-700">Waiting for confirmation</p>
                )}
              </div>
            </div>
            {!attendanceState.viewerConfirmedAt ? (
              <form action={confirmEventAttendance} className="mt-4">
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <FormSubmitButton
                  idleLabel="Confirm attendance"
                  pendingLabel="Confirming..."
                  disabled={!canConfirmAttendance}
                  className={
                    canConfirmAttendance
                      ? "rounded-full bg-civic-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-civic-800"
                      : "rounded-full border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
                  }
                />
              </form>
            ) : null}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Event Posts</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Confirmed attendee updates</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Confirmed attendees can publish lightweight text updates tied directly to this event.</p>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-ink">Share what happened</p>
            <p className="mt-2 text-sm text-slate-600">Text is required. Photos are optional. Event posts also appear in the main feed as Event Posts.</p>
            <form action={createEventPost} className="mt-4 space-y-4">
              <input type="hidden" name="eventId" value={event.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">What did you see or hear?</span>
                <textarea
                  name="content"
                  rows={5}
                  required
                  minLength={8}
                  placeholder="Share a grounded recap of what happened at the event."
                  className="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner outline-none transition focus:border-civic-400 focus:ring-2 focus:ring-civic-100"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Photo URL (optional)</span>
                <input
                  type="url"
                  name="mediaUrl"
                  placeholder="https://example.com/photo.jpg"
                  className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-civic-400 focus:ring-2 focus:ring-civic-100"
                />
              </label>
              <FormSubmitButton
                idleLabel="Publish event post"
                pendingLabel="Publishing..."
                disabled={!canPostToEvent}
                className={
                  canPostToEvent
                    ? "rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    : "rounded-full border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
                }
              />
            </form>
          </div>

          <div className="mt-6 space-y-4">
            {eventPosts.length ? (
              eventPosts.map((post) => <div key={post.id}>{renderEventPostPreview(post)}</div>)
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">No confirmed attendee posts yet.</div>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Attendee Sentiment</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Confirmed attendee sentiment</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Confirmed attendees can record whether they experienced this event as support, dissent, or neutral. Sentiment is shown only in aggregate.
          </p>

          {sentimentSummary.enabled ? (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Support</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-800">{sentimentSummary.supportCount}</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">Neutral</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-800">{sentimentSummary.neutralCount}</p>
                </div>
                <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Dissent</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-800">{sentimentSummary.dissentCount}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600">
                {sentimentSummary.totalCount
                  ? `${sentimentSummary.totalCount} confirmed attendee sentiment vote${sentimentSummary.totalCount === 1 ? "" : "s"} recorded.`
                  : "No attendee sentiment yet."}
              </p>
              <form action={submitEventSentiment} className="mt-5 space-y-3">
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: "support", label: "Support", activeClass: "bg-emerald-600 text-white" },
                    { value: "neutral", label: "Neutral", activeClass: "bg-slate-900 text-white" },
                    { value: "dissent", label: "Dissent", activeClass: "bg-rose-600 text-white" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="submit"
                      name="value"
                      value={option.value}
                      disabled={!attendanceState.viewerConfirmedAt}
                      className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                        sentimentSummary.viewerValue === option.value
                          ? option.activeClass
                          : attendanceState.viewerConfirmedAt
                            ? "border border-slate-200 bg-white text-slate-700 hover:border-civic-300 hover:text-civic-700"
                            : "border border-slate-200 bg-slate-100 text-slate-400"
                      }`}
                    >
                      {option.value === "support" ? <ActionLabel icon={<ThumbsUpIcon className="h-4 w-4" />}>{option.label}</ActionLabel> : option.label}
                    </button>
                  ))}
                </div>
              </form>
            </>
          ) : (
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500">
              Attendee sentiment is enabled for demonstrations, rallies, and public hearings.
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Photobook</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Event gallery</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Lightweight image gallery built only from attendee event posts with photos.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {photobook.length ? (
              photobook.map((post) => (
                <a
                  key={post.id}
                  href={post.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.mediaUrl}
                    alt={post.content.slice(0, 80)}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                  <div className="space-y-2 p-4">
                    <p className="text-sm font-semibold text-ink">{post.authorName}</p>
                    <p className="text-sm leading-6 text-slate-600">{post.content}</p>
                  </div>
                </a>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-500 sm:col-span-2">
                No event photos yet. Add an image to an event post to start the photobook.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Why this matters</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">Phase 2 participation rules</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li>Only verified users can RSVP.</li>
            <li>Only confirmed attendees can publish event posts.</li>
            <li>Only confirmed attendees can record event sentiment on supported event types.</li>
            <li>Event posts appear on this page and in the main feed with an Event Post label.</li>
            <li>Photobook images come only from event posts and stay off feed cards.</li>
            <li>Attendance confirmation is still manual and does not use geo validation yet.</li>
            <li>Attendee lists are still intentionally not shown.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
