"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getCreatedPosts, setCreatedPosts } from "@/lib/feed/posts";
import {
  canStartConversation,
  getExistingThreadForUsers,
  getMessageThreadRecord,
  getMessagingProfile,
  getMessagingThreadDetail,
  getStoredDirectMessages,
  getStoredMessageModeration,
  getStoredMessageThreads,
  getStoredMessagingSettings,
  setStoredDirectMessages,
  setStoredMessageModeration,
  setStoredMessageThreads,
  setStoredMessagingSettings,
} from "@/lib/messages/store";
import { createMessageRequestNotification, createMessageThreadNotification } from "@/lib/notifications/store";
import {
  canUserCreateInterviewRequest,
  canUserPublishInterview,
  createInterviewRequestRecord,
  ensureInterviewEventForRequest,
  getInterviewRequestById,
  getInterviewRequestRecord,
  updateInterviewRequestRecord,
} from "@/lib/server/interviews";
import type {
  InterviewRequestFormat,
  MessageAudienceRule,
  MessageLevel,
  MessageRequestState,
  MessageRouteType,
  MessageSubjectType,
  OfficialHelpCategory,
  PostSummary,
} from "@/types/domain";

function redirectWithStatus(path: string, key: string, value: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${value}`);
}

function sanitizeBody(body: FormDataEntryValue | null) {
  return typeof body === "string" ? body.trim() : "";
}

function sanitizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSubjectType(value: FormDataEntryValue | null): MessageSubjectType | null {
  return value === "needHelp" || value === "supportOppose" || value === "feedbackConcern" || value === "interviewRequest" || value === "other"
    ? value
    : null;
}

function sanitizeHelpCategory(value: FormDataEntryValue | null): OfficialHelpCategory | null {
  return value === "potholeRoadIssue" ||
    value === "permitsZoning" ||
    value === "schoolDistrictIssue" ||
    value === "utilitiesWater" ||
    value === "publicSafety" ||
    value === "taxesBilling" ||
    value === "housing" ||
    value === "businessLicensing" ||
    value === "other"
    ? value
    : null;
}

function sanitizeMessageLevel(value: FormDataEntryValue | null): MessageLevel | null {
  return value === "local" || value === "state" || value === "federal" ? value : null;
}

function sanitizeRouteType(value: FormDataEntryValue | null): MessageRouteType | null {
  return value === "officialType" || value === "issueType" ? value : null;
}

function sanitizeInterviewFormat(value: FormDataEntryValue | null): InterviewRequestFormat | null {
  return value === "written" || value === "video" || value === "inPerson" || value === "remote" ? value : null;
}

function sanitizeIssueTags(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))].slice(0, 6);
}

export async function sendFirstMessage(formData: FormData) {
  const currentUser = await getCurrentUser();
  const recipientUserId = formData.get("recipientUserId");
  const returnPath = formData.get("returnPath");
  const body = sanitizeBody(formData.get("body"));
  const subjectLine = sanitizeText(formData.get("subjectLine")) || null;
  const level = sanitizeMessageLevel(formData.get("level"));
  const routeType = sanitizeRouteType(formData.get("routeType"));
  const selectedOfficialType = sanitizeText(formData.get("selectedOfficialType")) || null;
  const selectedIssueType = sanitizeText(formData.get("selectedIssueType")) || null;
  const selectedRecipientProfileId = sanitizeText(formData.get("selectedRecipientProfileId")) || null;
  const subjectType = sanitizeSubjectType(formData.get("subjectType"));
  const issueCategory = sanitizeHelpCategory(formData.get("issueCategory"));
  const issueId = sanitizeText(formData.get("issueId")) || null;
  const issueText = sanitizeText(formData.get("issueText")) || null;
  const interviewFormat = sanitizeInterviewFormat(formData.get("interviewFormat"));
  const interviewIssueTags = sanitizeIssueTags(formData.get("interviewIssueTags"));
  const rawSupportPosition = formData.get("supportPosition");
  const supportPosition =
    rawSupportPosition === "support" || rawSupportPosition === "oppose" ? rawSupportPosition : null;
  const safeReturnPath = typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/messages";

  if (typeof recipientUserId !== "string" || body.length < 8 || !subjectType) {
    redirectWithStatus(safeReturnPath, "messageError", "invalid");
  }

  if (subjectType === "needHelp" && !issueCategory) {
    redirectWithStatus(safeReturnPath, "messageError", "invalid");
  }

  if (subjectType === "supportOppose" && !supportPosition) {
    redirectWithStatus(safeReturnPath, "messageError", "invalid");
  }

  if (subjectType === "interviewRequest") {
    if (!canUserCreateInterviewRequest(currentUser)) {
      redirectWithStatus(safeReturnPath, "messageError", "denied");
    }

    if (!subjectLine || subjectLine.length < 6 || !interviewFormat || body.length < 20) {
      redirectWithStatus(safeReturnPath, "messageError", "invalid");
    }
  }

  const eligibility = await canStartConversation(currentUser, recipientUserId);

  if (!eligibility.allowed) {
    redirectWithStatus(safeReturnPath, "messageError", eligibility.reason ?? "denied");
  }

  const existingThread = await getExistingThreadForUsers(currentUser.id, recipientUserId);

  if (existingThread) {
    redirectWithStatus(`/messages/${existingThread.id}`, "messageError", existingThread.requestState);
  }

  const now = new Date().toISOString();
  const threads = await getStoredMessageThreads();
  const threadId = `thread_${currentUser.id}_${recipientUserId}_${Date.now()}`;
  const messageId = `message_${Date.now()}`;
  const senderProfile = currentUser.role === "official" ? await getMessagingProfile(currentUser.id, currentUser.role) : null;

  await setStoredMessageThreads([
    {
      id: threadId,
      participantOneUserId: currentUser.id,
      participantTwoUserId: recipientUserId,
      participantOneRole: currentUser.role,
      participantTwoRole: eligibility.recipient?.role ?? "candidate",
      participantOneProfileId: senderProfile?.profileId ?? null,
      participantTwoProfileId: eligibility.profile?.profileId ?? recipientUserId,
      requestState: eligibility.initialState ?? "pending",
      initiatedByUserId: currentUser.id,
      requestRecipientUserId: recipientUserId,
      createdAt: now,
    },
    ...threads,
  ]);

  const messages = await getStoredDirectMessages();
  await setStoredDirectMessages([
    {
      id: messageId,
      threadId,
      senderUserId: currentUser.id,
      subjectLine,
      level,
      routeType,
      selectedOfficialType,
      selectedIssueType,
      selectedRecipientProfileId,
      subjectType,
      issueCategory: subjectType === "needHelp" ? issueCategory : null,
      issueId: subjectType === "supportOppose" || subjectType === "feedbackConcern" || subjectType === "interviewRequest" ? issueId : null,
      issueText: subjectType === "supportOppose" || subjectType === "feedbackConcern" || subjectType === "interviewRequest" ? issueText : null,
      supportPosition: subjectType === "supportOppose" ? supportPosition : null,
      body,
      createdAt: now,
    },
    ...messages,
  ]);

  if (subjectType === "interviewRequest" && eligibility.profile && subjectLine && interviewFormat) {
    await createInterviewRequestRecord({
      threadId,
      requesterUserId: currentUser.id,
      recipientUserId,
      recipientProfileId: eligibility.profile.profileId,
      topicTitle: subjectLine,
      issueTags: [...new Set([...(issueText ? [issueText] : []), ...interviewIssueTags])].slice(0, 6),
      requestedFormat: interviewFormat,
      proposedQuestions: body,
    });
  }

  if ((eligibility.initialState ?? "pending") === "pending") {
    await createMessageRequestNotification({
      recipientUserId,
      senderName: currentUser.name,
      threadId,
      messageId,
    });
    redirect("/messages?message=requested");
  }

  await createMessageThreadNotification({
    recipientUserId,
    senderName: currentUser.name,
    threadId,
    messageId,
    isReply: false,
  });

  redirect("/messages?message=sent");
}

export async function sendThreadReply(formData: FormData) {
  const currentUser = await getCurrentUser();
  const threadId = formData.get("threadId");
  const body = sanitizeBody(formData.get("body"));

  if (typeof threadId !== "string" || body.length < 2) {
    redirect("/messages?messageError=invalid");
  }

  const thread = await getMessagingThreadDetail(threadId, currentUser);

  if (!thread || !thread.canReply || thread.requestState === "blocked" || thread.requestState === "reported") {
    redirect(`/messages/${threadId}?messageError=denied`);
  }

  const messageId = `message_${Date.now()}`;
  const messages = await getStoredDirectMessages();
  await setStoredDirectMessages([
    {
      id: messageId,
      threadId,
      senderUserId: currentUser.id,
      body,
      createdAt: new Date().toISOString(),
    },
    ...messages,
  ]);

  const recipientUserId = thread.viewerIsSender ? thread.requestRecipientUserId : thread.initiatedByUserId;
  await createMessageThreadNotification({
    recipientUserId,
    senderName: currentUser.name,
    threadId,
    messageId,
    isReply: true,
  });

  redirect(`/messages/${threadId}?message=sent`);
}

export async function updateMessageRequestState(formData: FormData) {
  const currentUser = await getCurrentUser();
  const threadId = formData.get("threadId");
  const state = formData.get("state");

  if (
    typeof threadId !== "string" ||
    (state !== "accepted" && state !== "ignored" && state !== "blocked" && state !== "reported")
  ) {
    redirect("/messages?messageError=invalid");
  }

  const thread = await getMessagingThreadDetail(threadId, currentUser);
  const threadRecord = await getMessageThreadRecord(threadId);

  if (!thread || !threadRecord || !thread.viewerIsRecipient) {
    redirect("/messages?messageError=denied");
  }

  const threads = await getStoredMessageThreads();

  await setStoredMessageThreads([
    {
      ...threadRecord,
      requestState: state as MessageRequestState,
    },
    ...threads.filter((entry) => entry.id !== threadId),
  ]);

  if (state !== "accepted") {
    const moderation = await getStoredMessageModeration();
    await setStoredMessageModeration([
      {
        id: `message_moderation_${Date.now()}`,
        threadId,
        userId: currentUser.id,
        actionState: state,
        createdAt: new Date().toISOString(),
      },
      ...moderation,
    ]);
  }

  redirect(`/messages/${threadId}?messageRequest=${state}`);
}

export async function updateInterviewRequestStatus(formData: FormData) {
  const currentUser = await getCurrentUser();
  const interviewId = formData.get("interviewId");
  const nextStatus = formData.get("status");

  if (
    typeof interviewId !== "string" ||
    (nextStatus !== "accepted" && nextStatus !== "declined" && nextStatus !== "completed" && nextStatus !== "canceled")
  ) {
    redirect("/messages?messageError=invalid");
  }

  const [interviewRecord, interviewSummary] = await Promise.all([
    getInterviewRequestRecord(interviewId),
    getInterviewRequestById(interviewId),
  ]);

  if (!interviewRecord || !interviewSummary) {
    redirect("/messages?messageError=invalid");
  }

  const [thread, threadRecord] = await Promise.all([
    getMessagingThreadDetail(interviewRecord.threadId, currentUser),
    getMessageThreadRecord(interviewRecord.threadId),
  ]);

  if (!thread || !threadRecord) {
    redirect("/messages?messageError=denied");
  }

  if ((nextStatus === "accepted" || nextStatus === "declined" || nextStatus === "completed") && !thread.viewerIsRecipient) {
    redirect(`/messages/${interviewRecord.threadId}?messageError=denied`);
  }

  if (nextStatus === "canceled" && !thread.viewerIsSender) {
    redirect(`/messages/${interviewRecord.threadId}?messageError=denied`);
  }

  if (nextStatus === "accepted" && interviewSummary.status !== "pending") {
    redirect(`/messages/${interviewRecord.threadId}?messageError=denied`);
  }

  if (nextStatus === "declined" && interviewSummary.status !== "pending") {
    redirect(`/messages/${interviewRecord.threadId}?messageError=denied`);
  }

  if (nextStatus === "completed" && interviewSummary.status !== "accepted") {
    redirect(`/messages/${interviewRecord.threadId}?messageError=denied`);
  }

  if (nextStatus === "canceled" && !(interviewSummary.status === "pending" || interviewSummary.status === "accepted")) {
    redirect(`/messages/${interviewRecord.threadId}?messageError=denied`);
  }

  const acceptedEvent = nextStatus === "accepted" ? await ensureInterviewEventForRequest(interviewId) : null;

  await updateInterviewRequestRecord(interviewId, (record) => ({
    ...record,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    completedAt: nextStatus === "completed" ? new Date().toISOString() : record.completedAt ?? null,
    eventId: acceptedEvent?.id ?? record.eventId ?? null,
    eventStartsAt: acceptedEvent?.startsAt ?? record.eventStartsAt ?? null,
  }));

  const threads = await getStoredMessageThreads();
  const nextRequestState: MessageRequestState =
    nextStatus === "accepted" || nextStatus === "completed"
      ? "accepted"
      : nextStatus === "declined" || nextStatus === "canceled"
        ? "ignored"
        : threadRecord.requestState;

  await setStoredMessageThreads([
    {
      ...threadRecord,
      requestState: nextRequestState,
    },
    ...threads.filter((entry) => entry.id !== threadRecord.id),
  ]);

  redirect(`/messages/${interviewRecord.threadId}?interview=${nextStatus}`);
}

export async function publishInterviewPost(formData: FormData) {
  const currentUser = await getCurrentUser();
  const interviewId = formData.get("interviewId");
  const title = sanitizeText(formData.get("title"));
  const summary = sanitizeBody(formData.get("summary"));
  const transcript = sanitizeBody(formData.get("transcript"));
  const mediaUrl = sanitizeText(formData.get("mediaUrl")) || undefined;

  if (typeof interviewId !== "string" || !canUserPublishInterview(currentUser)) {
    redirect("/messages?messageError=denied");
  }

  const [interviewRecord, interviewSummary] = await Promise.all([
    getInterviewRequestRecord(interviewId),
    getInterviewRequestById(interviewId),
  ]);

  if (!interviewRecord || !interviewSummary) {
    redirect("/messages?messageError=invalid");
  }

  if (
    interviewRecord.requesterUserId !== currentUser.id ||
    interviewSummary.status !== "completed" ||
    interviewSummary.publishedPostId
  ) {
    redirect(`/messages/${interviewSummary.threadId}?messageError=denied`);
  }

  if (title.length < 8 || summary.length < 20 || transcript.length < 30) {
    redirect(`/interviews/${interviewId}/publish?error=invalid`);
  }

  const postId = `post_interview_${Date.now()}`;
  const createdPost: PostSummary = {
    id: postId,
    title,
    authorId: currentUser.id,
    authorName: currentUser.name,
    authorRole: currentUser.role,
    authorMediaTier: currentUser.mediaTier ?? null,
    jurisdictionName: currentUser.jurisdictionName,
    content: `${summary}\n\n${transcript}`,
    perspectiveType: "perspective",
    attachments: [
      {
        type: "event",
        id: interviewSummary.eventId ?? `interview-${interviewId}`,
        label: interviewSummary.eventTitle ?? title,
        jurisdictionId: currentUser.primaryCommunityId ?? null,
      },
      {
        type: interviewSummary.recipientProfileHref?.startsWith("/officials/") ? "official" : "candidate",
        id: interviewSummary.recipientProfileId ?? interviewSummary.recipientName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        label: interviewSummary.recipientName,
        jurisdictionId: currentUser.primaryCommunityId ?? null,
      },
    ],
    visibilityScope: "crossContext",
    jurisdictionScope: currentUser.primaryCommunityId ? [currentUser.primaryCommunityId] : undefined,
    stance: "explain",
    moderationStatus: "published",
    postType: mediaUrl ? "VIDEO" : "TEXT",
    contentType: "interview",
    mediaUrl,
    createdAt: new Date().toISOString(),
    reactionTotals: {
      up: 0,
      down: 0,
    },
    truthScore: {
      media: null,
      moderators: null,
      citizens: null,
    },
    interviewRequestId: interviewId,
    interviewSubjectName: interviewSummary.recipientName,
    interviewSubjectProfileId: interviewSummary.recipientProfileId,
    interviewSubjectProfileHref: interviewSummary.recipientProfileHref,
    interviewerName: currentUser.name,
    eventId: interviewSummary.eventId ?? null,
    eventTitle: interviewSummary.eventTitle ?? null,
  };

  const existingPosts = await getCreatedPosts();
  await setCreatedPosts([createdPost, ...existingPosts]);
  await updateInterviewRequestRecord(interviewId, (record) => ({
    ...record,
    publishedPostId: postId,
    updatedAt: new Date().toISOString(),
  }));

  redirect(`/posts/${postId}`);
}

export async function updateMessagingAudienceRule(formData: FormData) {
  const currentUser = await getCurrentUser();
  const audienceRule = formData.get("audienceRule");

  if (
    currentUser.role !== "candidate" &&
    currentUser.role !== "official"
  ) {
    redirect("/messages?messageError=denied");
  }

  if (audienceRule !== "everyone" && audienceRule !== "followersOnly" && audienceRule !== "jurisdictionOnly") {
    redirect("/messages?messageError=invalid");
  }

  const settings = await getStoredMessagingSettings();
  await setStoredMessagingSettings([
    {
      userId: currentUser.id,
      audienceRule: audienceRule as MessageAudienceRule,
    },
    ...settings.filter((entry) => entry.userId !== currentUser.id),
  ]);

  redirect("/messages?settings=updated");
}
