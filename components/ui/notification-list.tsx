import Link from "next/link";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { markNotificationReadAction } from "@/lib/notifications/actions";
import type { NotificationSummary } from "@/types/domain";

type NotificationListProps = {
  notifications: NotificationSummary[];
  compact?: boolean;
};

function getNotificationHref(notification: NotificationSummary) {
  if (notification.type === "pollConvertedToPetition") {
    const pollContext = notification.contextEntityId ? `&pollId=${notification.contextEntityId}` : "";
    return `/petitions/${notification.entityId}?fromPollNotification=1${pollContext}`;
  }

  if (notification.type === "followeeTrustedCitizen") {
    return `/citizens/${notification.entityId}?progressionRole=trustedCitizen`;
  }

  if (notification.type === "followeeCandidate") {
    const sourceUser = notification.contextEntityId ? `&sourceUserId=${notification.contextEntityId}` : "";
    return `/candidates/${notification.entityId}?progressionRole=candidate${sourceUser}`;
  }

  if (notification.type === "followeeOfficial") {
    const sourceUser = notification.contextEntityId ? `&sourceUserId=${notification.contextEntityId}` : "";
    return `/officials/${notification.entityId}?progressionRole=official${sourceUser}`;
  }

  if (
    notification.type === "nearbyEvent" ||
    notification.type === "eventTrending" ||
    notification.type === "eventReminder" ||
    notification.type === "followeeEventRsvp" ||
    notification.type === "eventLive" ||
    notification.type === "eventPostActivity"
  ) {
    return `/events/${notification.entityId}`;
  }

  if (
    notification.type === "messageRequest" ||
    notification.type === "messageThreadUpdate" ||
    notification.type === "messageReplyReceived"
  ) {
    return `/messages/${notification.entityId}`;
  }

  if (notification.type === "organizationAnnouncement") {
    return `/organizations/${notification.entityId}`;
  }

  if (notification.type === "debateRecommended") {
    return notification.contextEntityId ?? "/debates";
  }

  if (notification.type === "watchlistUpdate") {
    return notification.contextEntityId ?? "/profile/updates";
  }

  if (notification.type === "debateChallenge" || notification.type === "debateGroupJoin") {
    return `/debates/${notification.entityId}`;
  }

  if (
    notification.type === "debateUpdate" ||
    notification.type === "debateFollowedUserJoined" ||
    notification.type === "debateCompleted" ||
    notification.type === "debateResolved"
  ) {
    return `/debates/${notification.entityId}`;
  }

  if (notification.type.startsWith("petition")) {
    return `/petitions/${notification.entityId}`;
  }

  if (notification.type === "followeePost") {
    return "/posts";
  }

  if (notification.type === "followeeMajorAction") {
    if (notification.entityId.startsWith("petition_")) {
      return `/petitions/${notification.entityId}`;
    }

    if (notification.entityId.startsWith("poll_")) {
      return "/polls";
    }
  }

  return "/notifications";
}

function getNotificationLinkLabel(notification: NotificationSummary) {
  if (notification.type === "followeeTrustedCitizen") {
    return "View profile";
  }

  if (notification.type === "followeeCandidate") {
    return "View campaign";
  }

  if (notification.type === "followeeOfficial") {
    return "View office";
  }

  if (
    notification.type === "nearbyEvent" ||
    notification.type === "eventTrending" ||
    notification.type === "eventReminder" ||
    notification.type === "followeeEventRsvp" ||
    notification.type === "eventLive" ||
    notification.type === "eventPostActivity"
  ) {
    return "Open event";
  }

  if (
    notification.type === "messageRequest" ||
    notification.type === "messageThreadUpdate" ||
    notification.type === "messageReplyReceived"
  ) {
    return "Open thread";
  }

  if (notification.type === "organizationAnnouncement") {
    return "Open organization";
  }

  if (notification.type === "debateRecommended") {
    return "Open recommendation";
  }

  if (notification.type === "watchlistUpdate") {
    return "Open update";
  }

  if (notification.type === "debateChallenge" || notification.type === "debateGroupJoin") {
    return "Open debate";
  }

  if (
    notification.type === "debateUpdate" ||
    notification.type === "debateFollowedUserJoined" ||
    notification.type === "debateCompleted" ||
    notification.type === "debateResolved"
  ) {
    return "Open debate";
  }

  return "View update";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationList({ notifications, compact = false }: NotificationListProps) {
  if (!notifications.length) {
    return (
      <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
        No civic notifications yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={
            notification.isRead
              ? "rounded-3xl border border-slate-200 bg-white p-4"
              : "rounded-3xl border border-civic-200 bg-civic-50/80 p-4"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink">{notification.title}</p>
                {!notification.isRead ? (
                  <span className="rounded-full bg-civic-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                    Unread
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{notification.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href={getNotificationHref(notification)}
                  className="text-sm font-semibold text-civic-700 transition hover:text-civic-800"
                >
                  {getNotificationLinkLabel(notification)}
                </Link>
                <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{formatTimestamp(notification.createdAt)}</span>
              </div>
            </div>
            {!notification.isRead && !compact ? (
              <form action={markNotificationReadAction}>
                <input type="hidden" name="notificationId" value={notification.id} />
                <FormSubmitButton
                  idleLabel="Mark read"
                  pendingLabel="Saving..."
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </form>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
