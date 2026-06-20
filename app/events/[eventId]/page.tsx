import Link from "next/link";
import { notFound } from "next/navigation";

import { CivicEventCard } from "@/components/domain/civic-event-card";
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
import { getCivicEventById, getCivicEventStatusLabel, getCivicEventTypeLabel } from "@/lib/events/civic-events";
import type { CivicEvent } from "@/lib/events/types";
import { getPublicMeetingAdminDashboard } from "@/lib/public-meetings/public";
import { getMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
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

function formatOfficialDate(value: string | null) {
  if (!value) return "Schedule source";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFetchedDate(value: string | null) {
  if (!value) return "Source registry connected";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Source registry connected";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EventSourceLink({ href, label, description }: { href: string | null; label: string; description?: string }) {
  if (!href) return null;
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 transition hover:border-civic-300 hover:bg-white"
    >
      <span className="text-sm font-semibold text-ink">{label}</span>
      {description ? <span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span> : null}
    </Link>
  );
}

function IntelligenceBadge({ children, tone = "slate" }: { children: string; tone?: "slate" | "green" | "amber" | "blue" }) {
  const classes = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
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
  const currentUser = await getCurrentUser();
  const civicEvent = await getCivicEventById(currentUser, eventId);

  if (!civicEvent) {
    notFound();
  }

  if (civicEvent.isOfficialMeeting) {
    return <OfficialMeetingEventDetail event={civicEvent} />;
  }

  const communityEventId = civicEvent.communityEventId ?? eventId;
  const event = await getCommunityEventById(communityEventId);

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

async function OfficialMeetingEventDetail({ event }: { event: CivicEvent }) {
  const eventTypeLabel = getCivicEventTypeLabel(event.eventType);
  const statusLabel = getCivicEventStatusLabel(event.status);
  const materialCount = event.sourceDocumentCount || [event.agendaUrl, event.packetUrl, event.minutesUrl, event.videoUrl, event.sourceUrl].filter(Boolean).length;
  const dashboard = event.meetingRecordId
    ? await withSectionTimeout(getPublicMeetingAdminDashboard(), "public meeting intelligence", 1800).catch((error) => {
        console.error(`[event-detail] public meeting intelligence fallback for ${event.id}`, error);
        return null;
      })
    : null;
  const agendaItems = dashboard?.meetingItems
    .filter((item) => item.meeting_id === event.meetingRecordId)
    .sort((left, right) => {
      const leftNumber = Number.parseFloat(left.item_number ?? "");
      const rightNumber = Number.parseFloat(right.item_number ?? "");
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
      return left.title.localeCompare(right.title);
    }) ?? [];
  const meetingVotingCards = event.meetingRecordId
    ? await withSectionTimeout(getMeetingVotingCards(), "meeting voting cards", 1400).catch((error) => {
        console.error(`[event-detail] meeting voting cards fallback for ${event.id}`, error);
        return { cards: [], allCards: [], jurisdictions: [], bodies: [], policyAreas: [] };
      })
    : { cards: [], allCards: [], jurisdictions: [], bodies: [], policyAreas: [] };
  const relatedVotingCards = meetingVotingCards.allCards.filter((card) => card.meeting_id === event.meetingRecordId).slice(0, 8);
  const votesByItemId = new Map<string, NonNullable<typeof dashboard>["voteRecords"]>();
  if (dashboard) {
    for (const vote of dashboard.voteRecords) {
      votesByItemId.set(vote.meeting_item_id, [...(votesByItemId.get(vote.meeting_item_id) ?? []), vote]);
    }
  }

  return (
    <div className="space-y-8 py-8">
      <PageIntro
        eyebrow="Official event"
        title={event.title}
        description={event.description}
        meta={
          <>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
              {eventTypeLabel}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${event.status === "completed" ? "bg-slate-100 text-slate-700" : "bg-civic-50 text-civic-700"}`}>
              {statusLabel}
            </span>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {event.sourceProviderLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {event.jurisdiction}
            </span>
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
            {event.sourceUrl ? (
              <Link
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Official source
              </Link>
            ) : null}
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <CivicEventCard event={event} returnPath={`/events/${event.id}`} />

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">What voters can review</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              {event.createdFromMeetingRecord ? "Meeting record" : "Meeting source registry"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {event.summary ??
                event.meetingSummary ??
                (event.createdFromMeetingRecord
                  ? "This official meeting record was imported from public source materials."
                  : "This public body is connected as an official meeting source. Dated agenda, minutes, video, and vote imports will appear here as the meeting import pipeline adds records.")}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Date</p>
                <p className="mt-2 text-sm font-semibold text-ink">{formatOfficialDate(event.startsAt)}</p>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Materials</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {materialCount} linked source{materialCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Host body</p>
                <p className="mt-2 text-sm font-semibold text-ink">{event.hostName}</p>
              </div>
            </div>
          </section>

          {event.actionsTaken.length ? (
            <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Votes and actions</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Actions taken</h2>
              <div className="mt-5 space-y-3">
                {event.actionsTaken.map((action) => (
                  <article key={action.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-ink">{action.title}</p>
                    {action.result ? <p className="mt-1 text-sm text-slate-600">Result: {action.result}</p> : null}
                    {action.sourceUrl ? (
                      <Link href={action.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-civic-700 hover:text-civic-900">
                        View source
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {event.meetingSummary || event.keyActions.length || event.voteResults.length ? (
            <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Civic intelligence</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Meeting summary and extracted actions</h2>
              {event.meetingSummary ? <p className="mt-3 text-sm leading-7 text-slate-600">{event.meetingSummary}</p> : null}
              {event.keyActions.length ? (
                <div className="mt-5 space-y-2">
                  {event.keyActions.map((action) => (
                    <p key={action} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{action}</p>
                  ))}
                </div>
              ) : null}
              {event.voteResults.length ? (
                <div className="mt-5 space-y-3">
                  {event.voteResults.map((vote, index) => (
                    <article key={`${vote.motion ?? "vote"}-${index}`} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      {vote.motion ? <p className="text-sm font-semibold text-ink">{vote.motion}</p> : null}
                      {vote.result ? <p className="mt-1 text-sm text-slate-600">Result: {vote.result}</p> : null}
                      {vote.voteText ? <p className="mt-2 text-sm text-slate-600">{vote.voteText}</p> : null}
                      {vote.sourceUrl ? (
                        <Link href={vote.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-civic-700 hover:text-civic-900">
                          View vote source
                        </Link>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {relatedVotingCards.length ? (
            <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Related voting cards</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Local questions generated from this meeting</h2>
              <div className="mt-5 space-y-3">
                {relatedVotingCards.map((card) => (
                  <article key={card.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <IntelligenceBadge tone={card.review_status === "approved" ? "green" : "amber"}>{card.review_status}</IntelligenceBadge>
                      <IntelligenceBadge tone="blue">{card.policy_area}</IntelligenceBadge>
                      {card.civic_layer_label ? <IntelligenceBadge tone="blue">{card.civic_layer_label}</IntelligenceBadge> : null}
                      <IntelligenceBadge>{card.outcome_status}</IntelligenceBadge>
                      {card.needs_roll_call_review ? <IntelligenceBadge tone="amber">Roll call pending</IntelligenceBadge> : null}
                      {card.financial_impact_context?.badges.map((badge) => <IntelligenceBadge key={badge} tone="amber">{badge}</IntelligenceBadge>)}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-ink">{card.public_question ?? card.question_text}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.citizen_summary ?? card.plain_language_summary}</p>
                    {(card.source_item_number || card.source_title || card.governing_body_display_name) ? (
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Source: {[card.source_item_number, card.source_title, card.governing_body_display_name ?? card.body_name].filter(Boolean).join(" / ")}
                      </p>
                    ) : null}
                    {card.financial_impact ? <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Financial:</span> {card.financial_impact}</p> : null}
                    {card.financial_impact_context ? (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Tax / cost impact</p>
                        <p className="mt-1 leading-6">{card.financial_impact_context.tax_cost_summary}</p>
                      </div>
                    ) : null}
                    {card.outcome_text ? <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Outcome:</span> {card.outcome_text}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href="/voting" className="rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Voting queue</Link>
                      <Link href="/admin/voting-cards" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Review queue</Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {agendaItems.length ? (
            <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Agenda intelligence</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Topics citizens can review</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                These child records turn the meeting into searchable topics, summaries, issue classifications, and vote hooks.
              </p>
              <div className="mt-5 space-y-4">
                {agendaItems.slice(0, 30).map((item) => {
                  const itemVotes = votesByItemId.get(item.id) ?? [];
                  return (
                    <article key={item.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.item_number ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">Item {item.item_number}</span>
                        ) : null}
                        {item.source_method === "manual_cache" ? (
                          <IntelligenceBadge tone="blue">Source-backed</IntelligenceBadge>
                        ) : null}
                        <IntelligenceBadge tone="green">{item.policy_area}</IntelligenceBadge>
                        <IntelligenceBadge>{item.item_type.replace(/_/g, " ")}</IntelligenceBadge>
                        {item.parser_status === "needs_review" ? <IntelligenceBadge tone="amber">Needs review</IntelligenceBadge> : null}
                        {item.vote_outcome || itemVotes.length ? <IntelligenceBadge tone="green">Vote parsed</IntelligenceBadge> : null}
                        {item.roll_call_status === "needs_roll_call_review" || item.roll_call_status === "needs parser" ? <IntelligenceBadge tone="amber">Roll call pending</IntelligenceBadge> : null}
                        {item.roll_call_status === "parsed" ? <IntelligenceBadge tone="green">Roll call parsed</IntelligenceBadge> : null}
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-ink">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{item.one_sentence_summary}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.plain_english_explanation}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        <span className="font-semibold text-slate-800">Why it matters:</span> {item.why_it_matters}
                      </p>
                      {item.financial_impact || item.vote_outcome || item.affected_groups.length ? (
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                          {item.financial_impact ? <p><span className="font-semibold text-slate-800">Financial:</span> {item.financial_impact}</p> : null}
                          {item.vote_outcome ? <p><span className="font-semibold text-slate-800">Outcome:</span> {item.vote_outcome}</p> : null}
                          {item.affected_groups.length ? <p><span className="font-semibold text-slate-800">Affected:</span> {item.affected_groups.join(", ")}</p> : null}
                        </div>
                      ) : null}
                      {item.staff_recommendation || item.department_names?.length ? (
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                          {item.staff_recommendation ? <p><span className="font-semibold text-slate-800">Recommended action:</span> {item.staff_recommendation}</p> : null}
                          {item.department_names?.length ? <p><span className="font-semibold text-slate-800">Departments:</span> {item.department_names.join(", ")}</p> : null}
                        </div>
                      ) : null}
                      {itemVotes.length ? (
                        <div className="mt-3 rounded-[1rem] border border-slate-200 bg-white p-3 text-sm text-slate-600">
                          <p className="font-semibold text-slate-800">Votes</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {itemVotes.map((vote) => (
                              <span key={vote.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                {vote.official_name}: {vote.vote}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {item.related_official_names.length || item.related_organization_names.length ? (
                        <p className="mt-3 text-sm text-slate-600">
                          {item.related_official_names.length ? <><span className="font-semibold text-slate-800">Officials:</span> {item.related_official_names.join(", ")} </> : null}
                          {item.related_organization_names.length ? <><span className="font-semibold text-slate-800">Organizations:</span> {item.related_organization_names.join(", ")}</> : null}
                        </p>
                      ) : null}
                      {item.source_url ? (
                        <Link href={item.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-civic-700 hover:text-civic-900">
                          View item source
                        </Link>
                      ) : null}
                      {item.source_snippet || item.source_text ? (
                        <details className="mt-3 rounded-[1rem] border border-slate-200 bg-white p-3 text-sm text-slate-600">
                          <summary className="cursor-pointer font-semibold text-slate-800">Source snippet</summary>
                          <p className="mt-2 leading-6">{item.source_snippet ?? item.source_text.slice(0, 900)}</p>
                        </details>
                      ) : null}
                      {item.source_local_path ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">Saved source: {item.source_local_path}</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Meeting materials</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Official links</h2>
            <div className="mt-5 space-y-3">
              <EventSourceLink href={event.agendaUrl} label="Agenda" description="Agenda or agenda archive from the hosting body." />
              <EventSourceLink href={event.packetUrl} label="Packet / documents" description="Meeting packet, supporting documents, or item materials." />
              <EventSourceLink href={event.minutesUrl} label="Minutes" description="Approved minutes or minutes archive when available." />
              <EventSourceLink href={event.videoUrl ?? event.virtualUrl} label="Video / recording" description="Public stream, recording, or video archive." />
              <EventSourceLink href={event.sourceUrl} label="Source page" description="Primary official source for this event record." />
            </div>
            {!materialCount ? (
              <p className="mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                No meeting materials have been imported yet. The source registry entry still keeps this public body visible in Events.
              </p>
            ) : null}
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Source attribution</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Official record status</h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-slate-800">Host</dt>
                <dd className="mt-1 text-slate-600">{event.hostName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Jurisdiction</dt>
                <dd className="mt-1 text-slate-600">{event.jurisdiction}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Source provider</dt>
                <dd className="mt-1 text-slate-600">{event.sourceProviderLabel}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Last fetched</dt>
                <dd className="mt-1 text-slate-600">{formatFetchedDate(event.lastFetchedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-6 shadow-card backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Related civic context</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Connected records</h2>
            {event.relatedIssueLabels.length || event.relatedOfficialIds.length ? (
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                {event.relatedIssueLabels.length ? <p><span className="font-semibold text-slate-800">Issues:</span> {event.relatedIssueLabels.join(", ")}</p> : null}
                {event.relatedOfficialIds.length ? <p><span className="font-semibold text-slate-800">Officials:</span> {event.relatedOfficialIds.join(", ")}</p> : null}
              </div>
            ) : (
              <p className="mt-5 rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Related officials, issues, vote questions, and action summaries will appear as dated meeting records and agenda items are parsed.
              </p>
            )}
          </section>
        </div>
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
