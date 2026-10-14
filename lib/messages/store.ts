import { cookies } from "next/headers";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { seedUsers } from "@/lib/auth/mock-users";
import { canUserMessagePublicFigures } from "@/lib/auth/guards";
import { getTopIssuesForUser } from "@/lib/community/issues";
import { getRepresentativeLookup, type RepresentativeGroupKey, type RepresentativeLookupItem } from "@/lib/district-matching/lookup";
import { getAllCandidateCampaigns, getAllPublicProfiles, getAllOfficialPositions } from "@/lib/server/elections-context";
import { getInterviewRequestByThreadId } from "@/lib/server/interviews";
import { getNotificationsForUser } from "@/lib/notifications/store";
import { getAllFollows } from "@/lib/social/follows";
import type {
  AuthUser,
  DirectMessageSummary,
  GuidedMessageRecipientSummary,
  MessageLevel,
  MessageRouteType,
  MessageSubjectType,
  OfficialHelpCategory,
  MessageAudienceRule,
  MessageRequestState,
  MessageThreadSummary,
  MessagingInboxSummary,
  MessagingThreadDetail,
  PublicFigureMessagingSettingsSummary,
  UserRole,
} from "@/types/domain";

const MESSAGE_THREADS_COOKIE = "dd_message_threads";
const DIRECT_MESSAGES_COOKIE = "dd_direct_messages";
const MESSAGE_SETTINGS_COOKIE = "dd_message_settings";
const MESSAGE_MODERATION_COOKIE = "dd_message_moderation";

type ThreadRecord = {
  id: string;
  participantOneUserId: string;
  participantTwoUserId: string;
  participantOneRole: UserRole;
  participantTwoRole: UserRole;
  participantOneProfileId?: string | null;
  participantTwoProfileId?: string | null;
  requestState: MessageRequestState;
  initiatedByUserId: string;
  requestRecipientUserId: string;
  createdAt: string;
};

type MessageRecord = {
  id: string;
  threadId: string;
  senderUserId: string;
  subjectLine?: string | null;
  level?: MessageLevel | null;
  routeType?: MessageRouteType | null;
  selectedOfficialType?: string | null;
  selectedIssueType?: string | null;
  selectedRecipientProfileId?: string | null;
  subjectType?: MessageSubjectType | null;
  issueCategory?: OfficialHelpCategory | null;
  issueId?: string | null;
  issueText?: string | null;
  supportPosition?: "support" | "oppose" | null;
  body: string;
  createdAt: string;
};

type SettingsRecord = {
  userId: string;
  audienceRule: MessageAudienceRule;
};

type GeneratedCurrentOfficialRecord = {
  id: string;
  name: string;
  title?: string | null;
  office?: string | null;
  jurisdiction?: string | null;
  source_url?: string | null;
  source_label?: string | null;
  profile_url?: string | null;
  confidence?: number | null;
  review_status?: string | null;
};

type ModerationRecord = {
  id: string;
  threadId: string;
  userId: string;
  actionState: Exclude<MessageRequestState, "accepted">;
  createdAt: string;
};

type StartConversationResult = {
  allowed: boolean;
  reason: "recipient" | "profile" | "sender" | "followersOnly" | "jurisdictionOnly" | null;
  recipient: AuthUser | null;
  profile: Awaited<ReturnType<typeof getMessagingProfile>> | null;
  initialState?: "accepted" | "pending";
};

const seededThreads: ThreadRecord[] = [
  {
    id: "thread_alicia_elena",
    participantOneUserId: "user_citizen_alicia_hart",
    participantTwoUserId: "user_official_elena_ramirez",
    participantOneRole: "citizen",
    participantTwoRole: "official",
    participantOneProfileId: null,
    participantTwoProfileId: "profile_elena_ramirez",
    requestState: "accepted",
    initiatedByUserId: "user_citizen_alicia_hart",
    requestRecipientUserId: "user_official_elena_ramirez",
    createdAt: "2026-03-18T16:00:00.000Z",
  },
  {
    id: "thread_tiana_maya_request",
    participantOneUserId: "user_citizen_tiana_moore",
    participantTwoUserId: "user_candidate_maya_ortega",
    participantOneRole: "citizen",
    participantTwoRole: "candidate",
    participantOneProfileId: null,
    participantTwoProfileId: "profile_maya_ortega",
    requestState: "pending",
    initiatedByUserId: "user_citizen_tiana_moore",
    requestRecipientUserId: "user_candidate_maya_ortega",
    createdAt: "2026-03-25T19:10:00.000Z",
  },
  {
    id: "thread_elena_david_official",
    participantOneUserId: "user_official_elena_ramirez",
    participantTwoUserId: "user_official_david_park",
    participantOneRole: "official",
    participantTwoRole: "official",
    participantOneProfileId: "profile_elena_ramirez",
    participantTwoProfileId: "profile_david_park",
    requestState: "accepted",
    initiatedByUserId: "user_official_elena_ramirez",
    requestRecipientUserId: "user_official_david_park",
    createdAt: "2026-03-26T14:40:00.000Z",
  },
];

const seededMessages: MessageRecord[] = [
  {
    id: "message_alicia_elena_1",
    threadId: "thread_alicia_elena",
    senderUserId: "user_citizen_alicia_hart",
    subjectLine: "Feedback on archived meetings implementation costs",
    level: "local",
    routeType: "issueType",
    selectedIssueType: "Other local issue",
    selectedRecipientProfileId: "profile_elena_ramirez",
    subjectType: "feedbackConcern",
    issueId: "curated_issue_nevada_finance",
    issueText: "Campaign finance transparency across Nevada races",
    body: "I support the archived meetings petition. Will the city publish implementation costs before the final draft moves forward?",
    createdAt: "2026-03-18T16:00:00.000Z",
  },
  {
    id: "message_alicia_elena_2",
    threadId: "thread_alicia_elena",
    senderUserId: "user_official_elena_ramirez",
    body: "Yes. My office plans to publish a plain-language budget note before committee review so residents can see the cost and accessibility tradeoffs.",
    createdAt: "2026-03-18T18:20:00.000Z",
  },
  {
    id: "message_tiana_maya_1",
    threadId: "thread_tiana_maya_request",
    senderUserId: "user_citizen_tiana_moore",
    subjectLine: "Support for rural healthcare reporting",
    level: "federal",
    routeType: "issueType",
    selectedIssueType: "Healthcare access",
    selectedRecipientProfileId: "profile_maya_ortega",
    subjectType: "supportOppose",
    issueId: "curated_issue_national_healthcare",
    issueText: "Healthcare affordability and insurance costs nationwide",
    supportPosition: "support",
    body: "If elected, would you support more frequent public updates on healthcare provider shortages in rural counties?",
    createdAt: "2026-03-25T19:10:00.000Z",
  },
  {
    id: "message_elena_david_1",
    threadId: "thread_elena_david_official",
    senderUserId: "user_official_elena_ramirez",
    body: "Can we compare notes before next week’s regional transportation meeting? I want to align on the archived materials request from residents.",
    createdAt: "2026-03-26T14:40:00.000Z",
  },
];

const seededSettings: SettingsRecord[] = [
  { userId: "user_official_elena_ramirez", audienceRule: "everyone" },
  { userId: "user_official_david_park", audienceRule: "jurisdictionOnly" },
  { userId: "user_candidate_sofia_bennett", audienceRule: "followersOnly" },
  { userId: "user_candidate_owen_castillo", audienceRule: "everyone" },
  { userId: "user_candidate_ava_marquette", audienceRule: "followersOnly" },
  { userId: "user_candidate_maya_ortega", audienceRule: "everyone" },
  { userId: "user_candidate_cole_wyatt", audienceRule: "jurisdictionOnly" },
];

function isThreadRecord(value: unknown): value is ThreadRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const thread = value as Record<string, unknown>;
  return (
    typeof thread.id === "string" &&
    typeof thread.participantOneUserId === "string" &&
    typeof thread.participantTwoUserId === "string" &&
    typeof thread.participantOneRole === "string" &&
    typeof thread.participantTwoRole === "string" &&
    (typeof thread.participantOneProfileId === "string" || thread.participantOneProfileId === null || thread.participantOneProfileId === undefined) &&
    (typeof thread.participantTwoProfileId === "string" || thread.participantTwoProfileId === null || thread.participantTwoProfileId === undefined) &&
    typeof thread.requestState === "string" &&
    typeof thread.initiatedByUserId === "string" &&
    typeof thread.requestRecipientUserId === "string" &&
    typeof thread.createdAt === "string"
  );
}

function isMessageRecord(value: unknown): value is MessageRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    typeof message.threadId === "string" &&
    typeof message.senderUserId === "string" &&
    (typeof message.subjectLine === "string" || message.subjectLine === null || message.subjectLine === undefined) &&
    (message.level === "local" || message.level === "state" || message.level === "federal" || message.level === null || message.level === undefined) &&
    (message.routeType === "officialType" || message.routeType === "issueType" || message.routeType === null || message.routeType === undefined) &&
    (typeof message.selectedOfficialType === "string" || message.selectedOfficialType === null || message.selectedOfficialType === undefined) &&
    (typeof message.selectedIssueType === "string" || message.selectedIssueType === null || message.selectedIssueType === undefined) &&
    (typeof message.selectedRecipientProfileId === "string" || message.selectedRecipientProfileId === null || message.selectedRecipientProfileId === undefined) &&
    (typeof message.subjectType === "string" || message.subjectType === null || message.subjectType === undefined) &&
    (typeof message.issueCategory === "string" || message.issueCategory === null || message.issueCategory === undefined) &&
    (typeof message.issueId === "string" || message.issueId === null || message.issueId === undefined) &&
    (typeof message.issueText === "string" || message.issueText === null || message.issueText === undefined) &&
    (message.supportPosition === "support" || message.supportPosition === "oppose" || message.supportPosition === null || message.supportPosition === undefined) &&
    typeof message.body === "string" &&
    typeof message.createdAt === "string"
  );
}

function isSettingsRecord(value: unknown): value is SettingsRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const settings = value as Record<string, unknown>;
  return (
    typeof settings.userId === "string" &&
    (settings.audienceRule === "everyone" || settings.audienceRule === "followersOnly" || settings.audienceRule === "jurisdictionOnly")
  );
}

function isModerationRecord(value: unknown): value is ModerationRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const moderation = value as Record<string, unknown>;
  return (
    typeof moderation.id === "string" &&
    typeof moderation.threadId === "string" &&
    typeof moderation.userId === "string" &&
    (moderation.actionState === "ignored" || moderation.actionState === "blocked" || moderation.actionState === "reported") &&
    typeof moderation.createdAt === "string"
  );
}

async function readCookieArray<T>(cookieName: string, guard: (value: unknown) => value is T): Promise<T[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(cookieName)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

async function writeCookieArray<T>(cookieName: string, data: T[]) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, JSON.stringify(data), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getStoredMessageThreads() {
  return readCookieArray(MESSAGE_THREADS_COOKIE, isThreadRecord);
}

export async function setStoredMessageThreads(threads: ThreadRecord[]) {
  await writeCookieArray(MESSAGE_THREADS_COOKIE, threads.slice(0, 200));
}

export async function getStoredDirectMessages() {
  return readCookieArray(DIRECT_MESSAGES_COOKIE, isMessageRecord);
}

export async function setStoredDirectMessages(messages: MessageRecord[]) {
  await writeCookieArray(DIRECT_MESSAGES_COOKIE, messages.slice(0, 500));
}

export async function getStoredMessagingSettings() {
  return readCookieArray(MESSAGE_SETTINGS_COOKIE, isSettingsRecord);
}

export async function setStoredMessagingSettings(settings: SettingsRecord[]) {
  await writeCookieArray(MESSAGE_SETTINGS_COOKIE, settings.slice(0, 80));
}

export async function getStoredMessageModeration() {
  return readCookieArray(MESSAGE_MODERATION_COOKIE, isModerationRecord);
}

export async function setStoredMessageModeration(records: ModerationRecord[]) {
  await writeCookieArray(MESSAGE_MODERATION_COOKIE, records.slice(0, 200));
}

async function getAllThreads() {
  const merged = new Map<string, ThreadRecord>();

  for (const thread of seededThreads) {
    merged.set(thread.id, thread);
  }

  for (const thread of await getStoredMessageThreads()) {
    merged.set(thread.id, thread);
  }

  return [...merged.values()];
}

export async function getMessageThreadRecord(threadId: string) {
  const threads = await getAllThreads();
  return threads.find((thread) => thread.id === threadId) ?? null;
}

async function getAllMessages() {
  const merged = new Map<string, MessageRecord>();

  for (const message of seededMessages) {
    merged.set(message.id, message);
  }

  for (const message of await getStoredDirectMessages()) {
    merged.set(message.id, message);
  }

  return [...merged.values()];
}

async function getAllSettings() {
  const merged = new Map<string, SettingsRecord>();

  for (const settings of seededSettings) {
    merged.set(settings.userId, settings);
  }

  for (const settings of await getStoredMessagingSettings()) {
    merged.set(settings.userId, settings);
  }

  return [...merged.values()];
}

function isPublicFigureRole(role: UserRole) {
  return role === "candidate" || role === "official";
}

export async function getMessagingProfile(userId: string, role?: UserRole) {
  const [profiles, positions] = await Promise.all([getAllPublicProfiles(), getAllOfficialPositions()]);
  const profile = profiles.find((entry) => entry.claimedByUserId === userId && (entry.profileType === "candidate" || entry.profileType === "official" || entry.profileType === "incumbentCandidate"));

  if (!profile) {
    return null;
  }

  const resolvedRole =
    profile.profileType === "official" || positions.some((position) => position.publicProfileId === profile.id && position.isCurrent)
      ? "official"
      : "candidate";

  return {
    profileId: profile.id,
    href: resolvedRole === "official" ? `/officials/${profile.id}` : `/candidates/${profile.id}`,
    role: resolvedRole as "candidate" | "official",
  };
}

function getParticipantName(userId: string) {
  return seedUsers.find((user) => user.id === userId)?.name ?? "Public figure";
}

function getParticipantJurisdiction(userId: string) {
  return seedUsers.find((user) => user.id === userId)?.jurisdictionName ?? "Community";
}

async function getThreadParticipantInfo(thread: ThreadRecord, viewerId: string) {
  const isViewerParticipantOne = thread.participantOneUserId === viewerId;
  const otherUserId = isViewerParticipantOne ? thread.participantTwoUserId : thread.participantOneUserId;
  const otherRole = isViewerParticipantOne ? thread.participantTwoRole : thread.participantOneRole;
  const otherProfileId = isViewerParticipantOne ? thread.participantTwoProfileId ?? null : thread.participantOneProfileId ?? null;
  const otherProfileHref =
    otherRole === "candidate" || otherRole === "official"
      ? `${otherRole === "official" ? "/officials" : "/candidates"}/${otherProfileId ?? otherUserId}`
      : `/citizens/${otherUserId}`;

  return {
    otherUserId,
    otherRole,
    otherProfileId: otherProfileId ?? otherUserId,
    otherProfileHref,
    otherJurisdictionName: getParticipantJurisdiction(otherUserId),
  };
}

export async function getMessagingSettings(userId: string): Promise<PublicFigureMessagingSettingsSummary> {
  const settings = await getAllSettings();
  return settings.find((entry) => entry.userId === userId) ?? { userId, audienceRule: "everyone" };
}

export async function canStartConversation(sender: AuthUser, recipientUserId: string): Promise<StartConversationResult> {
  const recipient = seedUsers.find((entry) => entry.id === recipientUserId);

  if (!recipient || !isPublicFigureRole(recipient.role)) {
    return { allowed: false, reason: "recipient" as const, recipient: null, profile: null };
  }

  if (sender.role === "official" && recipient.role === "official") {
    const profile = await getMessagingProfile(recipientUserId, recipient.role);

    if (!profile) {
      return { allowed: false, reason: "profile" as const, recipient, profile: null, initialState: "accepted" as const };
    }

    return { allowed: true, reason: null, recipient, profile, initialState: "accepted" as const };
  }

  if (!canUserMessagePublicFigures(sender)) {
    return { allowed: false, reason: "sender" as const, recipient, profile: null };
  }

  if (!(sender.role === "citizen" || sender.role === "trustedCitizen")) {
    return { allowed: false, reason: "sender" as const, recipient, profile: null };
  }

  const profile = await getMessagingProfile(recipientUserId, recipient.role);

  if (!profile) {
    return { allowed: false, reason: "profile" as const, recipient, profile: null, initialState: "pending" as const };
  }

  const settings = await getMessagingSettings(recipientUserId);
  const follows = await getAllFollows();
  const viewerFollows = follows.some((entry) => entry.followerUserId === sender.id && entry.followingUserId === recipientUserId);
  const sameJurisdiction = sender.jurisdictionName === recipient.jurisdictionName;

  if (settings.audienceRule === "followersOnly" && !viewerFollows) {
    return { allowed: false, reason: "followersOnly" as const, recipient, profile, initialState: "pending" as const };
  }

  if (settings.audienceRule === "jurisdictionOnly" && !sameJurisdiction) {
    return { allowed: false, reason: "jurisdictionOnly" as const, recipient, profile, initialState: "pending" as const };
  }

  return { allowed: true, reason: null, recipient, profile, initialState: "pending" as const };
}

export async function canMessagePublicFigure(sender: AuthUser, recipientUserId: string) {
  return canStartConversation(sender, recipientUserId);
}

export async function getExistingThreadForUsers(userAId: string, userBId: string) {
  const threads = await getAllThreads();
  return (
    threads.find(
      (thread) =>
        (thread.participantOneUserId === userAId && thread.participantTwoUserId === userBId) ||
        (thread.participantOneUserId === userBId && thread.participantTwoUserId === userAId),
    ) ?? null
  );
}

async function buildThreadSummary(
  thread: ThreadRecord,
  messages: MessageRecord[],
  viewerId: string,
): Promise<MessageThreadSummary> {
  const notifications = await getNotificationsForUser(viewerId);
  const threadMessages = messages
    .filter((message) => message.threadId === thread.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const latest = threadMessages[0];
  const participant = await getThreadParticipantInfo(thread, viewerId);
  const unreadCount = notifications.filter(
    (notification) =>
      !notification.isRead &&
      notification.entityId === thread.id &&
      (notification.type === "messageRequest" ||
        notification.type === "messageThreadUpdate" ||
        notification.type === "messageReplyReceived"),
  ).length;

  return {
    id: thread.id,
    participantUserId: participant.otherUserId,
    participantName: getParticipantName(participant.otherUserId),
    participantRole: participant.otherRole,
    participantProfileId: participant.otherProfileId,
    participantProfileHref: participant.otherProfileHref,
    jurisdictionName: participant.otherJurisdictionName,
    requestState: thread.requestState,
    latestMessagePreview: latest?.body ?? "No messages yet.",
    latestMessageAt: latest?.createdAt ?? thread.createdAt,
    unreadCount,
    initiatedByUserId: thread.initiatedByUserId,
    requestRecipientUserId: thread.requestRecipientUserId,
    canReply: thread.requestState === "accepted",
  };
}

export async function getMessagingInbox(user: AuthUser): Promise<MessagingInboxSummary> {
  const [threads, messages, settings] = await Promise.all([getAllThreads(), getAllMessages(), getMessagingSettings(user.id)]);
  const relatedThreads = threads.filter((thread) => thread.participantOneUserId === user.id || thread.participantTwoUserId === user.id);
  const summaries = await Promise.all(relatedThreads.map((thread) => buildThreadSummary(thread, messages, user.id)));

  return {
    inbox: summaries
      .filter((thread) => thread.requestState === "accepted")
      .sort((a, b) => Date.parse(b.latestMessageAt) - Date.parse(a.latestMessageAt)),
    sent: summaries
      .filter((thread) => thread.initiatedByUserId === user.id)
      .sort((a, b) => Date.parse(b.latestMessageAt) - Date.parse(a.latestMessageAt)),
    requests: summaries
      .filter((thread) => thread.requestState === "pending" && thread.requestRecipientUserId === user.id)
      .sort((a, b) => Date.parse(b.latestMessageAt) - Date.parse(a.latestMessageAt)),
    settings: isPublicFigureRole(user.role) ? settings : null,
  };
}

export async function getMessagingThreadDetail(threadId: string, user: AuthUser): Promise<MessagingThreadDetail | null> {
  const [threads, messages] = await Promise.all([getAllThreads(), getAllMessages()]);
  const thread = threads.find((entry) => entry.id === threadId);

  if (!thread || (thread.participantOneUserId !== user.id && thread.participantTwoUserId !== user.id)) {
    return null;
  }

  const summary = await buildThreadSummary(thread, messages, user.id);
  const threadMessages = messages
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map(
      (message) =>
        ({
          id: message.id,
          threadId,
          senderUserId: message.senderUserId,
          senderName: getParticipantName(message.senderUserId),
          senderRole: seedUsers.find((entry) => entry.id === message.senderUserId)?.role ?? "citizen",
          subjectLine: message.subjectLine ?? null,
          level: message.level ?? null,
          routeType: message.routeType ?? null,
          selectedOfficialType: message.selectedOfficialType ?? null,
          selectedIssueType: message.selectedIssueType ?? null,
          selectedRecipientProfileId: message.selectedRecipientProfileId ?? null,
          subjectType: message.subjectType ?? null,
          issueCategory: message.issueCategory ?? null,
          issueId: message.issueId ?? null,
          issueText: message.issueText ?? null,
          supportPosition: message.supportPosition ?? null,
          body: message.body,
          createdAt: message.createdAt,
        }) satisfies DirectMessageSummary,
    );
  const interviewRequest = await getInterviewRequestByThreadId(threadId);

  return {
    ...summary,
    messages: threadMessages,
    viewerIsRecipient: thread.requestRecipientUserId === user.id,
    viewerIsSender: thread.initiatedByUserId === user.id,
    interviewRequest,
  };
}

export async function getMessageComposerIssues(user: AuthUser) {
  return getTopIssuesForUser(user, "all");
}

function getLevelForJurisdiction(jurisdictionName: string): MessageLevel | null {
  if (jurisdictionName === "United States") {
    return "federal";
  }

  if (jurisdictionName === "Nevada") {
    return "state";
  }

  if (jurisdictionName.includes("Nevada")) {
    return "local";
  }

  return null;
}

function normalizeRecipientText(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function currentOfficialLevel(record: GeneratedCurrentOfficialRecord): MessageLevel | null {
  const jurisdiction = normalizeRecipientText(record.jurisdiction);
  const title = normalizeRecipientText(record.title ?? record.office);

  if (jurisdiction === "united states" || title.includes("u s ") || title.includes("congress") || title.includes("representative")) return "federal";
  if (
    jurisdiction === "nevada" ||
    jurisdiction.includes("system of higher education") ||
    title.includes("regent") ||
    title.includes("governor") ||
    title.includes("secretary of state") ||
    title.includes("attorney general") ||
    title.includes("state senate") ||
    title.includes("assembly")
  ) return "state";
  if (jurisdiction.includes("nevada")) return "local";

  return null;
}

function readGeneratedCurrentOfficialsForMessaging() {
  const filePath = path.join(process.cwd(), "data", "generated", "nevada-community-officials.json");
  if (!existsSync(filePath)) return [];

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as { records?: GeneratedCurrentOfficialRecord[] } | GeneratedCurrentOfficialRecord[];
    return Array.isArray(parsed) ? parsed : parsed.records ?? [];
  } catch (error) {
    console.warn("[messages] generated current officials unavailable for guided routing", error);
    return [];
  }
}

function generatedOfficialMatchesLocalJurisdiction(record: GeneratedCurrentOfficialRecord, localJurisdictionName: string) {
  const level = currentOfficialLevel(record);
  if (level !== "local") return true;

  const recordJurisdiction = normalizeRecipientText(record.jurisdiction);
  const userJurisdiction = normalizeRecipientText(localJurisdictionName);

  if (!recordJurisdiction) return false;
  return Boolean(userJurisdiction && (recordJurisdiction.includes(userJurisdiction) || userJurisdiction.includes(recordJurisdiction)));
}

function isDuplicateGuidedRecipient(existing: GuidedMessageRecipientSummary[], candidate: GuidedMessageRecipientSummary) {
  const candidateName = normalizeRecipientText(candidate.name);
  const candidateOffice = normalizeRecipientText(candidate.officeTitle);

  return existing.some((recipient) => {
    const samePerson = normalizeRecipientText(recipient.name) === candidateName;
    const sameLocalJurisdiction = localJurisdictionMatches(recipient.jurisdictionName, candidate.jurisdictionName);

    if (samePerson && sameLocalJurisdiction) {
      return true;
    }

    return (
      samePerson &&
      normalizeRecipientText(recipient.officeTitle) === candidateOffice &&
      normalizeRecipientText(recipient.jurisdictionName) === normalizeRecipientText(candidate.jurisdictionName)
    );
  });
}

function localJurisdictionMatches(recipientJurisdiction: string, localJurisdiction: string) {
  const normalizedRecipientJurisdiction = normalizeRecipientText(recipientJurisdiction);
  const normalizedLocalJurisdiction = normalizeRecipientText(localJurisdiction);

  if (!normalizedRecipientJurisdiction || !normalizedLocalJurisdiction) return false;
  if (normalizedRecipientJurisdiction.includes(normalizedLocalJurisdiction) || normalizedLocalJurisdiction.includes(normalizedRecipientJurisdiction)) return true;

  const localTokens = normalizedLocalJurisdiction.split(" ").filter((token) => token.length > 2);
  return localTokens.length > 0 && localTokens.every((token) => normalizedRecipientJurisdiction.includes(token));
}

function inferLocalJurisdictionName(value: string | null | undefined, fallback: string) {
  const normalized = normalizeRecipientText(value);

  if (normalized.includes("carson city")) return "Carson City";
  if (normalized.includes("washoe county")) return "Washoe County";
  if (normalized.includes("clark county")) return "Clark County";
  if (normalized.includes("reno")) return "Reno";
  if (normalized.includes("sparks")) return "Sparks";
  if (normalized.includes("henderson")) return "Henderson";
  if (normalized.includes("north las vegas")) return "North Las Vegas";
  if (normalized.includes("las vegas")) return "Las Vegas";

  return fallback;
}

function levelForRepresentativeGroup(groupKey: RepresentativeGroupKey): MessageLevel {
  if (groupKey === "federal") return "federal";
  if (groupKey === "state") return "state";
  return "local";
}

function representativeToGuidedRecipient(
  item: RepresentativeLookupItem,
  groupKey: RepresentativeGroupKey,
  locationSourceLabel: string,
): GuidedMessageRecipientSummary {
  return {
    userId: `source-official:${item.id}`,
    profileId: item.id,
    name: item.name,
    role: "official",
    officeTitle: item.roleLabel,
    jurisdictionName: item.jurisdictionName,
    level: levelForRepresentativeGroup(groupKey),
    audienceRule: "everyone",
    deliveryMode: "source_contact",
    sourceUrl: item.sourceUrl ?? item.href,
    sourceLabel: item.sourceName,
    matchNote: `${locationSourceLabel}. ${item.matchNote} Direct in-app messaging opens once this officeholder claims a profile.`,
  };
}

type GuidedRecipientOptions = {
  locationInput?: string | null;
  locationSourceLabel?: string;
};

export async function getGuidedMessageRecipients(user: AuthUser, options: GuidedRecipientOptions = {}): Promise<GuidedMessageRecipientSummary[]> {
  const [profiles, positions, campaigns] = await Promise.all([
    getAllPublicProfiles(),
    getAllOfficialPositions(),
    getAllCandidateCampaigns(),
  ]);

  const recipients: GuidedMessageRecipientSummary[] = [];

  for (const profile of profiles) {
    if (!profile.claimedByUserId) {
      continue;
    }

    const level = getLevelForJurisdiction(profile.jurisdictionName);
    if (!level) {
      continue;
    }

    const eligibility = await canStartConversation(user, profile.claimedByUserId);
    if (!eligibility.allowed) {
      continue;
    }

    const currentPosition = positions.find((position) => position.publicProfileId === profile.id && position.isCurrent);
    const currentCampaign = campaigns.find((campaign) => campaign.publicProfileId === profile.id);
    const officeTitle = currentPosition?.officeTitle ?? currentCampaign?.officeSought ?? (profile.profileType === "official" ? "Official" : "Candidate");
    const settings = await getMessagingSettings(profile.claimedByUserId);

    recipients.push({
      userId: profile.claimedByUserId,
      profileId: profile.id,
      name: profile.name,
      role: currentPosition || profile.profileType === "official" ? "official" : "candidate",
      officeTitle,
      jurisdictionName: profile.jurisdictionName,
      level,
      audienceRule: settings.audienceRule,
      deliveryMode: "direct_message",
    });
  }

  const lookupLocation = options.locationInput?.trim() || user.jurisdictionName;
  const locationSourceLabel = options.locationSourceLabel ?? "Matched from your verified jurisdiction";
  const localJurisdiction = inferLocalJurisdictionName(lookupLocation, user.jurisdictionName);

  try {
    const lookup = await getRepresentativeLookup({ user, locationInput: lookupLocation });
    for (const group of lookup.groups) {
      for (const official of group.officials) {
        const candidate = representativeToGuidedRecipient(official, group.key, locationSourceLabel);
        if (!isDuplicateGuidedRecipient(recipients, candidate)) {
          recipients.push(candidate);
        }
      }
    }
  } catch (error) {
    console.warn("[messages] representative lookup unavailable for guided routing", error);
  }

  for (const official of readGeneratedCurrentOfficialsForMessaging()) {
    const level = currentOfficialLevel(official);
    if (!level || !generatedOfficialMatchesLocalJurisdiction(official, localJurisdiction)) continue;

    const title = official.title ?? official.office ?? "Current official";
    const candidate: GuidedMessageRecipientSummary = {
      userId: `source-official:${official.id}`,
      profileId: official.id,
      name: official.name,
      role: "official",
      officeTitle: title,
      jurisdictionName: official.jurisdiction ?? (level === "state" ? "Nevada" : level === "federal" ? "United States" : user.jurisdictionName),
      level,
      audienceRule: "everyone",
      deliveryMode: "source_contact",
      sourceUrl: official.profile_url ?? official.source_url ?? `/officials/${official.id}`,
      sourceLabel: official.source_label ?? "Current official source",
      matchNote: "Source-backed current officeholder. Direct in-app messaging opens once this officeholder claims a profile.",
    };

    if (!isDuplicateGuidedRecipient(recipients, candidate)) {
      recipients.push(candidate);
    }
  }

  return recipients
    .filter((recipient) => {
      if (recipient.level === "local") {
        return localJurisdictionMatches(recipient.jurisdictionName, localJurisdiction);
      }

      if (recipient.level === "state") {
        return recipient.jurisdictionName === "Nevada";
      }

      return recipient.level === "federal";
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
