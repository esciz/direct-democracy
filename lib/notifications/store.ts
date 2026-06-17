import { cache } from "react";
import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import { getRecommendedDebatesForUser } from "@/lib/debates/recommendations";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { getFollowerUserIds } from "@/lib/social/follows";
import type { NotificationSummary, NotificationType } from "@/types/domain";

const NOTIFICATIONS_COOKIE = "dd_mock_notifications";
const RECOMMENDED_DEBATE_NOTIFICATIONS_COOKIE = "dd_recommended_debate_notification_reads";
const seededNotifications: NotificationSummary[] = [
  {
    id: "notification_seeded_carson_meeting_archives_alicia",
    userId: "user_citizen_alicia_hart",
    type: "petitionDrafting",
    title: "Draft legislation is now in progress",
    body: "\"Require Carson City public meetings to be livestreamed and archived\" has moved from petition support into a public drafting stage.",
    entityId: "petition_carson_meeting_archives",
    contextEntityId: null,
    isRead: false,
    createdAt: "2026-03-29T18:15:00.000Z",
  },
  {
    id: "notification_seeded_followee_trusted_alicia",
    userId: "user_citizen_miles_reed",
    type: "followeeTrustedCitizen",
    title: "Someone you follow is now a Trusted Citizen: Hannah Cho",
    body: "Hannah Cho now has enough community support to appear as a trusted civic voice in Washoe County.",
    entityId: "user_trusted_citizen_hannah_cho",
    contextEntityId: null,
    isRead: false,
    createdAt: "2026-03-21T18:00:00.000Z",
  },
  {
    id: "notification_seeded_followee_candidate_tiana",
    userId: "user_citizen_tiana_moore",
    type: "followeeCandidate",
    title: "A Trusted Citizen you follow is now running for office: Maya Ortega",
    body: "Maya Ortega is now running for office in Nevada. View campaign details and decide whether to support this run.",
    entityId: "profile_maya_ortega",
    contextEntityId: "user_candidate_maya_ortega",
    isRead: false,
    createdAt: "2026-03-21T19:10:00.000Z",
  },
  {
    id: "notification_seeded_followee_official_marco",
    userId: "user_trusted_citizen_marco_silva",
    type: "followeeOfficial",
    title: "Elena Ramirez was elected — see what happens next",
    body: "Someone you follow has moved from campaign mode into public office. Review Elena Ramirez's profile and in-office activity.",
    entityId: "profile_elena_ramirez",
    contextEntityId: "user_official_elena_ramirez",
    isRead: false,
    createdAt: "2026-03-20T17:45:00.000Z",
  },
  {
    id: "notification_seeded_message_request_elena",
    userId: "user_official_elena_ramirez",
    type: "messageRequest",
    title: "New message request from Alicia Hart",
    body: "A citizen sent you a new message request tied to your public profile.",
    entityId: "thread_alicia_elena",
    contextEntityId: "message_alicia_elena_1",
    isRead: false,
    createdAt: "2026-03-18T16:00:00.000Z",
  },
];

function isNotificationSummary(value: unknown): value is NotificationSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const notification = value as Record<string, unknown>;

  return (
    typeof notification.id === "string" &&
    typeof notification.userId === "string" &&
    typeof notification.type === "string" &&
    typeof notification.title === "string" &&
    typeof notification.body === "string" &&
    typeof notification.entityId === "string" &&
    (typeof notification.contextEntityId === "string" || notification.contextEntityId === null || notification.contextEntityId === undefined) &&
    typeof notification.isRead === "boolean" &&
    typeof notification.createdAt === "string"
  );
}

async function readNotifications() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(NOTIFICATIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNotificationSummary) : [];
  } catch {
    return [];
  }
}

async function writeNotifications(notifications: NotificationSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(NOTIFICATIONS_COOKIE, JSON.stringify(notifications.slice(0, 200)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

async function readRecommendedDebateNotificationReads() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(RECOMMENDED_DEBATE_NOTIFICATIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

async function writeRecommendedDebateNotificationReads(ids: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(RECOMMENDED_DEBATE_NOTIFICATIONS_COOKIE, JSON.stringify(ids.slice(0, 200)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

async function getComputedRecommendedDebateNotifications(userId: string): Promise<NotificationSummary[]> {
  const user = seedUsers.find((entry) => entry.id === userId);

  if (!user || user.isAnonymousPublic) {
    return [];
  }

  const [recommendations, readIds] = await Promise.all([
    getRecommendedDebatesForUser(userId, { limit: 2 }),
    readRecommendedDebateNotificationReads(),
  ]);
  const readSet = new Set(readIds);

  return recommendations
    .map(
      (recommendation): NotificationSummary => ({
        id: recommendation.id,
        userId,
        type: "debateRecommended",
        title: recommendation.title,
        body: recommendation.reasonDescription,
        entityId: recommendation.id,
        contextEntityId: recommendation.href,
        isRead: readSet.has(recommendation.id),
        createdAt: recommendation.createdAt,
      }),
    )
    .filter((notification) => !notification.isRead);
}

const getNotificationsForUserCached = cache(async (userId: string): Promise<NotificationSummary[]> => {
  const [storedNotifications, computedRecommendedNotifications] = await Promise.all([
    readNotifications(),
    getComputedRecommendedDebateNotifications(userId),
  ]);
  const notifications = [...seededNotifications, ...storedNotifications, ...computedRecommendedNotifications];

  return notifications
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
});

export async function getNotificationsForUser(userId: string): Promise<NotificationSummary[]> {
  return getNotificationsForUserCached(userId);
}

export async function getRecentNotificationsForUser(userId: string, limit = 5): Promise<NotificationSummary[]> {
  const notifications = await getNotificationsForUser(userId);
  return notifications.slice(0, limit);
}

export async function getUnreadNotificationCount(userId: string) {
  const notifications = await getNotificationsForUser(userId);
  return notifications.filter((notification) => !notification.isRead).length;
}

export async function getNotificationMenuSummary(userId: string, limit = 5) {
  const notifications = await getNotificationsForUser(userId);

  return {
    notifications: notifications.slice(0, limit),
    unreadCount: notifications.filter((notification) => !notification.isRead).length,
  };
}

export async function createNotifications(
  notifications: Array<Omit<NotificationSummary, "id" | "isRead" | "createdAt">>,
) {
  const existing = await readNotifications();
  const now = new Date().toISOString();
  const additions = notifications.flatMap((notification) => {
    const alreadyExists = existing.some(
      (entry) =>
        entry.userId === notification.userId &&
        entry.type === notification.type &&
        entry.entityId === notification.entityId &&
        (entry.contextEntityId ?? null) === (notification.contextEntityId ?? null),
    );

    if (alreadyExists) {
      return [];
    }

    return [
      {
        ...notification,
        id: `notification_${notification.type}_${notification.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        isRead: false,
        createdAt: now,
      } satisfies NotificationSummary,
    ];
  });

  if (!additions.length) {
    return;
  }

  await writeNotifications([...additions, ...existing]);
}

export async function createPetitionProgressNotifications({
  userIds,
  type,
  petitionId,
  petitionTitle,
}: {
  userIds: string[];
  type: NotificationType;
  petitionId: string;
  petitionTitle: string;
}) {
  const uniqueUserIds = [...new Set(userIds)];

  const contentByType: Record<NotificationType, Pick<NotificationSummary, "title" | "body">> = {
    petitionSeekingSponsor: {
      title: "Petition reached the sponsorship threshold",
      body: `"${petitionTitle}" now has enough support to begin seeking an official sponsor.`,
    },
    petitionSponsorFound: {
      title: "Sponsor found for a petition you signed",
      body: `"${petitionTitle}" now has a public sponsorship request and is moving forward.`,
    },
    petitionDrafting: {
      title: "Drafting has begun",
      body: `"${petitionTitle}" is now moving into an early drafting stage.`,
    },
    pollConvertedToPetition: {
      title: "A poll you voted on became a petition",
      body: `"${petitionTitle}" is now open for signatures.`,
    },
    nearbyEvent: {
      title: "New nearby event",
      body: "A new event was added in your area.",
    },
    eventTrending: {
      title: "A nearby event is gaining traction",
      body: "Attendance is climbing for an event in your area.",
    },
    eventReminder: {
      title: "Event reminder",
      body: "An event you saved is coming up soon.",
    },
    followeeEventRsvp: {
      title: "Someone you follow is attending an event",
      body: "A followed user just RSVPed to a public event.",
    },
    eventLive: {
      title: "An event you saved is live",
      body: "A saved event is happening now.",
    },
    eventPostActivity: {
      title: "New activity from an event you saved",
      body: "Confirmed attendees are now posting from this event.",
    },
    debateChallenge: {
      title: "You were challenged to a debate",
      body: "A trusted citizen invited you into a structured debate.",
    },
    debateGroupJoin: {
      title: "A debate started for your group",
      body: "A structured group debate is looking for trusted participants on your side.",
    },
    debateUpdate: {
      title: "New response in a debate you follow",
      body: "A followed debate published a new official statement.",
    },
    debateFollowedUserJoined: {
      title: "Someone you follow joined a debate",
      body: "A followed user just joined a public issue debate.",
    },
    debateCompleted: {
      title: "Debate completed",
      body: "A followed debate finished its final round.",
    },
    debateResolved: {
      title: "Debate resolved by agreement",
      body: "A followed debate closed with an agreed statement.",
    },
    debateRecommended: {
      title: "Recommended debate",
      body: "A structured debate opportunity now fits your issues, jurisdiction, and civic record.",
    },
    followeeTrustedCitizen: {
      title: "Someone you follow became a Trusted Citizen",
      body: "A followed user has reached trusted status on the platform.",
    },
    followeeCandidate: {
      title: "Someone you follow is now running for office",
      body: "A followed trusted citizen has launched a public candidate profile.",
    },
    followeeOfficial: {
      title: "Someone you follow moved into office",
      body: "A followed candidate is now shown as an official on the platform.",
    },
    messageRequest: {
      title: "New message request",
      body: "Someone sent you a new civic message request.",
    },
    messageThreadUpdate: {
      title: "New message in a conversation",
      body: "There is a new message in one of your accepted civic conversations.",
    },
    messageReplyReceived: {
      title: "You received a reply",
      body: "There is a new reply in one of your civic conversations.",
    },
    organizationAnnouncement: {
      title: "New organization announcement",
      body: "An organization you belong to posted an update for members.",
    },
    followeePost: {
      title: "Someone you follow posted",
      body: "A followed voice published a new public post.",
    },
    followeeMajorAction: {
      title: "Someone you follow took a major civic action",
      body: "A followed voice took a public civic action on the platform.",
    },
  };

  await createNotifications(
    uniqueUserIds.map((userId) => ({
      userId,
      type,
      title: contentByType[type].title,
      body: contentByType[type].body,
      entityId: petitionId,
      contextEntityId: null,
    })),
  );
}

export async function createDebateChallengeNotification({
  challengedUserId,
  challengerName,
  debateId,
  issueText,
}: {
  challengedUserId: string;
  challengerName: string;
  debateId: string;
  issueText: string;
}) {
  await createNotifications([
    {
      userId: challengedUserId,
      type: "debateChallenge",
      title: `You were challenged to a debate on ${issueText}`,
      body: `${challengerName} invited you into a structured issue debate.`,
      entityId: debateId,
      contextEntityId: null,
    },
  ]);
}

export async function createDebateGroupJoinNotifications({
  userIds,
  debateId,
  sideAName,
  sideBName,
}: {
  userIds: string[];
  debateId: string;
  sideAName: string;
  sideBName: string;
}) {
  await createNotifications(
    [...new Set(userIds)].map((userId) => ({
      userId,
      type: "debateGroupJoin" as const,
      title: `A debate started: ${sideAName} vs ${sideBName}`,
      body: "Join your side to help activate this structured group debate.",
      entityId: debateId,
      contextEntityId: null,
    })),
  );
}

export async function createDebateTurnNotifications({
  userIds,
  debateId,
  debateTitle,
  turnLabel,
  contextEntityId,
}: {
  userIds: string[];
  debateId: string;
  debateTitle: string;
  turnLabel: string;
  contextEntityId: string;
}) {
  await createNotifications(
    [...new Set(userIds)].map((userId) => ({
      userId,
      type: "debateUpdate" as const,
      title: `New response in ${debateTitle}`,
      body: `${turnLabel} is now published as an official debate turn.`,
      entityId: debateId,
      contextEntityId,
    })),
  );
}

export async function createDebateFollowedUserJoinedNotifications({
  userIds,
  debateId,
  debateTitle,
  joinedUserName,
  contextEntityId,
}: {
  userIds: string[];
  debateId: string;
  debateTitle: string;
  joinedUserName: string;
  contextEntityId: string;
}) {
  await createNotifications(
    [...new Set(userIds)].map((userId) => ({
      userId,
      type: "debateFollowedUserJoined" as const,
      title: `Someone you follow joined the debate: ${debateTitle}`,
      body: `${joinedUserName} joined this structured debate.`,
      entityId: debateId,
      contextEntityId,
    })),
  );
}

export async function createDebatePhaseNotifications({
  userIds,
  debateId,
  debateTitle,
  phaseLabel,
  contextEntityId,
}: {
  userIds: string[];
  debateId: string;
  debateTitle: string;
  phaseLabel: string;
  contextEntityId: string;
}) {
  await createNotifications(
    [...new Set(userIds)].map((userId) => ({
      userId,
      type: "debateUpdate" as const,
      title: `Debate update: ${debateTitle}`,
      body: phaseLabel,
      entityId: debateId,
      contextEntityId,
    })),
  );
}

export async function createDebateOutcomeNotifications({
  userIds,
  debateId,
  debateTitle,
  type,
}: {
  userIds: string[];
  debateId: string;
  debateTitle: string;
  type: "debateCompleted" | "debateResolved";
}) {
  await createNotifications(
    [...new Set(userIds)].map((userId) => ({
      userId,
      type,
      title: type === "debateResolved" ? `Debate resolved by agreement: ${debateTitle}` : `Debate completed: ${debateTitle}`,
      body:
        type === "debateResolved"
          ? "This debate closed with an agreed statement."
          : "This debate finished its final round and is now complete.",
      entityId: debateId,
      contextEntityId: null,
    })),
  );
}

export async function createNearbyEventNotifications({
  userIds,
  eventId,
  eventTitle,
}: {
  userIds: string[];
  eventId: string;
  eventTitle: string;
}) {
  await createNotifications(
    [...new Set(userIds)].map((userId) => ({
      userId,
      type: "nearbyEvent" as const,
      title: `New nearby event: ${eventTitle}`,
      body: "A new civic event was added near you. Review the details and decide whether to attend.",
      entityId: eventId,
      contextEntityId: null,
    })),
  );
}

export async function createTrendingEventNotifications({
  userIds,
  eventId,
  eventTitle,
  attendingCount,
}: {
  userIds: string[];
  eventId: string;
  eventTitle: string;
  attendingCount: number;
}) {
  await createNotifications(
    [...new Set(userIds)].map((userId) => ({
      userId,
      type: "eventTrending" as const,
      title: `High-engagement event: ${eventTitle}`,
      body: `${attendingCount} people are now marked as attending. This event is gaining traction.`,
      entityId: eventId,
      contextEntityId: null,
    })),
  );
}

export async function createFolloweeEventNotifications({
  userIds,
  eventId,
  eventTitle,
  userName,
}: {
  userIds: string[];
  eventId: string;
  eventTitle: string;
  userName: string;
}) {
  await createNotifications(
    [...new Set(userIds)].map((userId) => ({
      userId,
      type: "followeeEventRsvp" as const,
      title: `Someone you follow is attending: ${eventTitle}`,
      body: `${userName} marked that they are attending this event.`,
      entityId: eventId,
      contextEntityId: null,
    })),
  );
}

export async function createEventPostActivityNotifications({
  userIds,
  eventId,
  eventTitle,
}: {
  userIds: string[];
  eventId: string;
  eventTitle: string;
}) {
  await createNotifications(
    [...new Set(userIds)].map((userId) => ({
      userId,
      type: "eventPostActivity" as const,
      title: `New activity from ${eventTitle}`,
      body: "Confirmed attendees are now posting updates and photos from this event.",
      entityId: eventId,
      contextEntityId: null,
    })),
  );
}

export async function createFolloweeRoleProgressionNotifications({
  userId,
  userName,
  toRole,
  jurisdictionName,
  profileId,
}: {
  userId: string;
  userName: string;
  toRole: "trustedCitizen" | "candidate" | "official";
  jurisdictionName: string;
  profileId?: string | null;
}) {
  const followerIds = await getFollowerUserIds(userId);
  const eligibleFollowerIds: string[] = [];

  for (const followerId of followerIds) {
    const preferences = await getNotificationPreferences(followerId);

    if (preferences.majorActions) {
      eligibleFollowerIds.push(followerId);
    }
  }

  const type =
    toRole === "trustedCitizen"
      ? "followeeTrustedCitizen"
      : toRole === "candidate"
        ? "followeeCandidate"
        : "followeeOfficial";
  const entityId = toRole === "trustedCitizen" ? userId : profileId ?? userId;
  const title =
    toRole === "trustedCitizen"
      ? `Someone you follow is now a Trusted Citizen: ${userName}`
      : toRole === "candidate"
        ? `A Trusted Citizen you follow is now running for office: ${userName}`
        : `${userName} was elected — see what happens next`;
  const body =
    toRole === "trustedCitizen"
      ? `${userName} now has enough community support to appear as a trusted civic voice in ${jurisdictionName}.`
      : toRole === "candidate"
        ? `${userName} is now running for office in ${jurisdictionName}. View campaign details and decide whether to support this run.`
        : `${userName} is now shown as an official in ${jurisdictionName}. Review their public profile and in-office activity.`;

  await createNotifications(
    eligibleFollowerIds.map((followerId) => ({
      userId: followerId,
      type,
      title,
      body,
      entityId,
      contextEntityId: userId,
    })),
  );
}

export async function createPollConvertedToPetitionNotifications({
  userIds,
  pollId,
  pollQuestion,
  petitionId,
  petitionTitle,
}: {
  userIds: string[];
  pollId: string;
  pollQuestion: string;
  petitionId: string;
  petitionTitle: string;
}) {
  const uniqueUserIds = [...new Set(userIds)];

  await createNotifications(
    uniqueUserIds.map((userId) => ({
      userId,
      type: "pollConvertedToPetition" as const,
      title: "The poll you voted on is now a petition",
      body: `"${pollQuestion}" is now "${petitionTitle}" — take action.`,
      entityId: petitionId,
      contextEntityId: pollId,
    })),
  );
}

export async function createMessageRequestNotification({
  recipientUserId,
  senderName,
  threadId,
  messageId,
}: {
  recipientUserId: string;
  senderName: string;
  threadId: string;
  messageId: string;
}) {
  await createNotifications([
    {
      userId: recipientUserId,
      type: "messageRequest",
      title: `New message request from ${senderName}`,
      body: "A verified user wants to start a civic conversation with you.",
      entityId: threadId,
      contextEntityId: messageId,
    },
  ]);
}

export async function createMessageThreadNotification({
  recipientUserId,
  senderName,
  threadId,
  messageId,
  isReply,
}: {
  recipientUserId: string;
  senderName: string;
  threadId: string;
  messageId: string;
  isReply: boolean;
}) {
  await createNotifications([
    {
      userId: recipientUserId,
      type: isReply ? "messageReplyReceived" : "messageThreadUpdate",
      title: isReply ? `${senderName} replied` : `New message from ${senderName}`,
      body: isReply
        ? "A civic conversation you are part of has a new reply."
        : "A civic conversation you are part of has a new message.",
      entityId: threadId,
      contextEntityId: messageId,
    },
  ]);
}

export async function createFolloweeNotificationsForPost(userId: string, userName: string, postId: string, postTitle?: string) {
  const followerIds = await getFollowerUserIds(userId);
  const eligibleFollowerIds: string[] = [];

  for (const followerId of followerIds) {
    const preferences = await getNotificationPreferences(followerId);

    if (preferences.posts) {
      eligibleFollowerIds.push(followerId);
    }
  }

  await createNotifications(
    eligibleFollowerIds.map((followerId) => ({
      userId: followerId,
      type: "followeePost",
      title: `${userName} posted a new update`,
      body: postTitle ? `New post: ${postTitle}` : `${userName} shared a new post in the public feed.`,
      entityId: postId,
      contextEntityId: null,
    })),
  );
}

export async function createFolloweeNotificationsForMajorAction(userId: string, userName: string, entityId: string, title: string, body: string) {
  const followerIds = await getFollowerUserIds(userId);
  const eligibleFollowerIds: string[] = [];

  for (const followerId of followerIds) {
    const preferences = await getNotificationPreferences(followerId);

    if (preferences.majorActions) {
      eligibleFollowerIds.push(followerId);
    }
  }

  await createNotifications(
    eligibleFollowerIds.map((followerId) => ({
      userId: followerId,
      type: "followeeMajorAction",
      title: `${userName} ${title}`,
      body,
      entityId,
      contextEntityId: null,
    })),
  );
}

export async function markNotificationRead(notificationId: string, userId: string) {
  if (notificationId.startsWith("debate_recommendation_")) {
    const readIds = await readRecommendedDebateNotificationReads();
    await writeRecommendedDebateNotificationReads([...new Set([...readIds, notificationId])]);
    return;
  }

  const notifications = await readNotifications();
  const updated = notifications.map((notification) =>
    notification.id === notificationId && notification.userId === userId
      ? {
          ...notification,
          isRead: true,
        }
      : notification,
  );

  await writeNotifications(updated);
}

export async function markAllNotificationsRead(userId: string) {
  const notifications = await readNotifications();
  const recommendations = await getComputedRecommendedDebateNotifications(userId);
  const readIds = await readRecommendedDebateNotificationReads();
  const updated = notifications.map((notification) =>
    notification.userId === userId
      ? {
          ...notification,
          isRead: true,
        }
      : notification,
  );

  if (recommendations.length) {
    await writeRecommendedDebateNotificationReads([...new Set([...readIds, ...recommendations.map((notification) => notification.id)])]);
  }
  await writeNotifications(updated);
}
