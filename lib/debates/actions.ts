"use server";

import { redirect } from "next/navigation";

import { canUserCreateDebate, canUserTagDebateFallacies } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/server/auth-session";
import { DEBATE_FALLACY_TYPES } from "@/lib/debates/fallacies";
import { awardCreditsForAction } from "@/lib/engagement/credits";
import { getUserProfileContent } from "@/lib/profile/details";
import { ensureIssueReferenceForUser } from "@/lib/server/issues";
import {
  canUserParticipateForCurrentTurn,
  getActiveDebateCountForUser,
  getDebateDetail,
  getDebateFollowerUserIds,
  getDebateFollowState,
  getDebateParticipants,
  getDebateTurnsForDebate,
  getDebateDraftVotesForDebate,
  getDebateRecord,
  getStoredDebates,
  getStoredDebateDraftVotes,
  getStoredDebateCommunityVotes,
  getStoredDebateDrafts,
  getStoredDebateFallacyTags,
  getStoredDebateFallacyReviews,
  getStoredDebateFollows,
  getStoredDebateOverrides,
  getStoredDebateParticipants,
  getStoredDebateReactions,
  getStoredDebateTurns,
  getRemovedDebateFollowKeys,
  hasSimilarActiveDebate,
  setStoredDebates,
  setStoredDebateDraftVotes,
  setStoredDebateCommunityVotes,
  setStoredDebateDrafts,
  setStoredDebateFallacyTags,
  setStoredDebateFallacyReviews,
  setStoredDebateFollows,
  setStoredDebateOverrides,
  setStoredDebateParticipants,
  setStoredDebateReactions,
  setStoredDebateTurns,
  setRemovedDebateFollowKeys,
} from "@/lib/debates/store";
import {
  createDebateChallengeNotification,
  createDebateFollowedUserJoinedNotifications,
  createDebateGroupJoinNotifications,
  createDebateOutcomeNotifications,
  createDebatePhaseNotifications,
  createDebateTurnNotifications,
} from "@/lib/notifications/store";
import { getFollowerUserIds } from "@/lib/social/follows";
import { seedUsers } from "@/lib/auth/mock-users";
import type { CitationSourceType, DebateCommunityVoteOption } from "@/types/domain";

function redirectWithStatus(path: string, key: string, value: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${value}`);
}

function totalTurnCount(rounds: number) {
  return rounds > 1 ? 8 : 6;
}

function safeReturnPath(value: FormDataEntryValue | null, debateId?: string) {
  if (typeof value === "string" && value.startsWith("/")) {
    return value;
  }

  return debateId ? `/debates/${debateId}` : "/debates";
}

function sanitizeText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeOptionalUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const ACTIVE_DEBATE_LIMIT = 3;
const MAX_DEBATE_TURN_CITATIONS = 3;

function getDebateVoteWindowClose(closedAt: string | null | undefined) {
  if (!closedAt) {
    return null;
  }

  return new Date(Date.parse(closedAt) + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function sanitizeCitationSourceType(value: FormDataEntryValue | null): CitationSourceType | null {
  if (value !== "government" && value !== "academic" && value !== "news" && value !== "organization") {
    return null;
  }

  return value;
}

function getStructuredCitations(formData: FormData, timestamp: string) {
  const citations = [];

  for (let index = 0; index < MAX_DEBATE_TURN_CITATIONS; index += 1) {
    const title = sanitizeText(formData.get(`citationTitle_${index}`));
    const sourceName = sanitizeText(formData.get(`citationSourceName_${index}`));
    const url = sanitizeOptionalUrl(formData.get(`citationUrl_${index}`));
    const note = sanitizeText(formData.get(`citationNote_${index}`)) || null;
    const sourceType = sanitizeCitationSourceType(formData.get(`citationSourceType_${index}`));
    const hasAnyValue = Boolean(title || sourceName || url || note || sourceType);

    if (!hasAnyValue) {
      continue;
    }

    if (!title || !sourceName || !url) {
      return {
        error: "citation-invalid" as const,
        citations: [],
      };
    }

    citations.push({
      id: `debate_citation_${Date.now()}_${index}`,
      title,
      sourceName,
      sourceType,
      url,
      note,
      createdAt: timestamp,
    });
  }

  return {
    error: null,
    citations,
  };
}

async function getDebateNotificationFollowerIds(debateId: string, excludedUserIds: string[] = []) {
  const followerIds = await getDebateFollowerUserIds(debateId);
  const excluded = new Set(excludedUserIds);

  return [...new Set(followerIds)].filter((userId) => !excluded.has(userId));
}

async function notifyDebateActivated(debateId: string, debateTitle: string, excludedUserIds: string[] = []) {
  const userIds = await getDebateNotificationFollowerIds(debateId, excludedUserIds);

  if (!userIds.length) {
    return;
  }

  await createDebatePhaseNotifications({
    userIds,
    debateId,
    debateTitle,
    phaseLabel: "This debate is now active and official turns can begin.",
    contextEntityId: "phase:active",
  });
}

async function notifyDebatePublishedTurn({
  debateId,
  debateTitle,
  turnId,
  turnLabel,
  excludedUserIds = [],
}: {
  debateId: string;
  debateTitle: string;
  turnId: string;
  turnLabel: string;
  excludedUserIds?: string[];
}) {
  const userIds = await getDebateNotificationFollowerIds(debateId, excludedUserIds);

  if (!userIds.length) {
    return;
  }

  await createDebateTurnNotifications({
    userIds,
    debateId,
    debateTitle,
    turnLabel,
    contextEntityId: turnId,
  });
}

async function notifyDebateOutcome({
  debateId,
  debateTitle,
  type,
  excludedUserIds = [],
}: {
  debateId: string;
  debateTitle: string;
  type: "debateCompleted" | "debateResolved";
  excludedUserIds?: string[];
}) {
  const userIds = await getDebateNotificationFollowerIds(debateId, excludedUserIds);

  if (!userIds.length) {
    return;
  }

  await createDebateOutcomeNotifications({
    userIds,
    debateId,
    debateTitle,
    type,
  });
}

async function awardDebateCompletionCredits(debateId: string) {
  const participants = await getDebateParticipants(debateId);
  const participantUserIds = [...new Set(participants.map((participant) => participant.userId))];

  await Promise.all(
    participantUserIds.map((participantUserId) =>
      awardCreditsForAction(participantUserId, "debateComplete", 4, {
        rewardKey: `debateComplete:${participantUserId}:${debateId}`,
      }),
    ),
  );
}

export async function createDebate(formData: FormData) {
  const user = await getCurrentUser();
  const returnPath = safeReturnPath(formData.get("returnPath"));

  if (!canUserCreateDebate(user)) {
    redirectWithStatus(returnPath, "debateCreateError", "permissions");
  }

  const title = sanitizeText(formData.get("title"));
  const description = sanitizeText(formData.get("description"));
  const issueId = sanitizeText(formData.get("issueId"));
  const issueText = sanitizeText(formData.get("issueText"));
  const jurisdictionName = sanitizeText(formData.get("jurisdictionName"));
  const mode = formData.get("mode");
  const sideAName = sanitizeText(formData.get("sideAName"));
  const sideBName = sanitizeText(formData.get("sideBName"));
  const challengedUserId = sanitizeText(formData.get("challengedUserId")) || null;
  const sideAGroupTag = sanitizeText(formData.get("sideAGroupTag")) || null;
  const sideBGroupTag = sanitizeText(formData.get("sideBGroupTag")) || null;
  const rounds = Number(formData.get("numberOfRounds") ?? 1);
  const draftWindowHours = Number(formData.get("draftWindowHours") ?? 24);
  const votingWindowHours = Number(formData.get("votingWindowHours") ?? 24);

  if (
    !title ||
    !description ||
    !issueId ||
    !issueText ||
    !jurisdictionName ||
    (mode !== "individual" && mode !== "group") ||
    !sideAName ||
    !sideBName
  ) {
    redirectWithStatus(returnPath, "debateCreateError", "invalid");
  }

  const activeCount = await getActiveDebateCountForUser(user.id);
  if (activeCount >= ACTIVE_DEBATE_LIMIT) {
    redirectWithStatus(returnPath, "debateCreateError", "limit");
  }

  if (await hasSimilarActiveDebate(issueId, mode, sideAName, sideBName)) {
    redirectWithStatus(returnPath, "debateCreateError", "duplicate");
  }

  const debateId = `debate_${Date.now()}`;
  const now = new Date().toISOString();
  const debates = await getStoredDebates();
  const participants = await getStoredDebateParticipants();

  if (mode === "individual") {
    const opponent = seedUsers.find((entry) => entry.id === challengedUserId && entry.role === "trustedCitizen");
    if (!opponent || opponent.id === user.id) {
      redirectWithStatus(returnPath, "debateCreateError", "opponent");
    }

    await setStoredDebates([
      {
        id: debateId,
        title,
        description,
        issueId,
        issueText,
        jurisdictionName,
        mode,
        startState: "pendingChallenge",
        sideAName,
        sideBName,
        sideAGroupTag: null,
        sideBGroupTag: null,
        createdByUserId: user.id,
        challengedUserId: opponent.id,
        status: "open",
        createdAt: now,
        numberOfRounds: rounds === 2 ? 2 : 1,
        draftWindowHours: null,
        votingWindowHours: null,
      },
      ...debates,
    ]);

    await setStoredDebateParticipants([
      {
        debateId,
        userId: user.id,
        userName: user.name,
        side: "A",
        role: "lead",
      },
      ...participants,
    ]);

    await createDebateChallengeNotification({
      challengedUserId: opponent.id,
      challengerName: user.name,
      debateId,
      issueText,
    });

    redirect(`/debates/${debateId}?debateCreate=challenge-sent`);
  }

  if (!sideAGroupTag || !sideBGroupTag || sideAGroupTag.toLowerCase() === sideBGroupTag.toLowerCase()) {
    redirectWithStatus(returnPath, "debateCreateError", "groups");
  }

  const creatorProfile = await getUserProfileContent(user.id);
  const creatorTags = new Set([
    ...creatorProfile.groupTags.map((entry) => entry.value.toLowerCase()),
    ...creatorProfile.identityTags.map((entry) => entry.value.toLowerCase()),
  ]);

  if (!creatorTags.has(sideAGroupTag.toLowerCase())) {
    redirectWithStatus(returnPath, "debateCreateError", "groups");
  }

  await setStoredDebates([
    {
      id: debateId,
      title,
      description,
      issueId,
      issueText,
      jurisdictionName,
      mode,
      startState: "seekingParticipants",
      sideAName,
      sideBName,
      sideAGroupTag,
      sideBGroupTag,
      createdByUserId: user.id,
      challengedUserId: null,
      status: "open",
      createdAt: now,
      numberOfRounds: rounds === 2 ? 2 : 1,
      draftWindowHours,
      votingWindowHours,
    },
    ...debates,
  ]);

  await setStoredDebateParticipants([
    {
      debateId,
      userId: user.id,
      userName: user.name,
      side: "A",
      role: "lead",
    },
    ...participants,
  ]);

  const notifyUserIds = seedUsers.filter((entry) => entry.role === "trustedCitizen" && entry.id !== user.id).map((entry) => entry.id);
  await createDebateGroupJoinNotifications({
    userIds: notifyUserIds,
    debateId,
    sideAName,
    sideBName,
  });

  redirect(`/debates/${debateId}?debateCreate=group-started`);
}

export async function createPhaseOneDebate(formData: FormData) {
  const user = await getCurrentUser();
  const returnPath = safeReturnPath(formData.get("returnPath"));

  if (!canUserCreateDebate(user)) {
    redirectWithStatus(returnPath, "debateCreateError", "permissions");
  }

  const title = sanitizeText(formData.get("title"));
  const description = sanitizeText(formData.get("description"));
  const issueText = sanitizeText(formData.get("issueText"));
  const sideAName = sanitizeText(formData.get("sideAName")) || "Side A";
  const sideBName = sanitizeText(formData.get("sideBName")) || "Side B";
  const chosenSide = formData.get("chosenSide");
  const invitedUserId = sanitizeText(formData.get("invitedUserId")) || null;

  if (!title || !description || (chosenSide !== "A" && chosenSide !== "B")) {
    redirectWithStatus(returnPath, "debateCreateError", "invalid");
  }

  const activeCount = await getActiveDebateCountForUser(user.id);
  if (activeCount >= ACTIVE_DEBATE_LIMIT) {
    redirectWithStatus(returnPath, "debateCreateError", "limit");
  }

  const linkedIssue = issueText ? await ensureIssueReferenceForUser(user, issueText) : null;
  const resolvedIssueText = linkedIssue?.issueText ?? issueText;
  const issueId = linkedIssue?.id ?? (resolvedIssueText ? `phase1_issue_${resolvedIssueText.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}` : `phase1_issue_${Date.now()}`);
  if (await hasSimilarActiveDebate(issueId, "individual", sideAName, sideBName)) {
    redirectWithStatus(returnPath, "debateCreateError", "duplicate");
  }

  const now = new Date().toISOString();
  const debateId = `debate_phase1_${Date.now()}`;
  const invitedUser =
    invitedUserId && invitedUserId !== user.id
      ? seedUsers.find((entry) => entry.id === invitedUserId && entry.role === "trustedCitizen")
      : null;
  const creatorSide = chosenSide as "A" | "B";
  const debates = await getStoredDebates();
  const participants = await getStoredDebateParticipants();

  await setStoredDebates([
    {
      id: debateId,
      title,
      description,
      issueId,
      issueText: resolvedIssueText,
      jurisdictionName: user.jurisdictionName,
      mode: "individual",
      startState: "active",
      sideAName,
      sideBName,
      sideAGroupTag: null,
      sideBGroupTag: null,
      createdByUserId: user.id,
      challengedUserId: invitedUser?.id ?? null,
      status: "open",
      createdAt: now,
      numberOfRounds: 1,
      draftWindowHours: null,
      votingWindowHours: null,
    },
    ...debates,
  ]);

  const nextParticipants = [
    {
      debateId,
      userId: user.id,
      userName: user.name,
      side: creatorSide,
      role: "lead" as const,
    },
    ...participants.filter((entry) => !(entry.debateId === debateId && entry.userId === user.id)),
  ];

  if (invitedUser) {
    nextParticipants.unshift({
      debateId,
      userId: invitedUser.id,
      userName: invitedUser.name,
      side: creatorSide === "A" ? "B" : "A",
      role: "lead" as const,
    });
  }

  await setStoredDebateParticipants(nextParticipants);
  await awardCreditsForAction(user.id, "debateStart", 2, {
    rewardKey: `debateStart:${user.id}:${debateId}`,
  });

  redirect(`/debates/${debateId}?debate=created`);
}

export async function submitPhaseOneDebateStatement(formData: FormData) {
  const user = await getCurrentUser();
  const debateId = sanitizeText(formData.get("debateId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);
  const statementText = sanitizeText(formData.get("statementText"));
  const side = formData.get("side");

  if (!canUserCreateDebate(user)) {
    redirectWithStatus(returnPath, "debateError", "permissions");
  }

  if (!debateId || statementText.length < 8 || (side !== "A" && side !== "B")) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const [debate, participants, turns] = await Promise.all([
    getDebateRecord(debateId),
    getDebateParticipants(debateId),
    getStoredDebateTurns(),
  ]);

  if (!debate || debate.status !== "open") {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const existingParticipant = participants.find((entry) => entry.userId === user.id);
  const nextSide = side as "A" | "B";

  if (existingParticipant && existingParticipant.side !== nextSide) {
    redirectWithStatus(returnPath, "debateError", "permissions");
  }

  if (!existingParticipant) {
    const storedParticipants = await getStoredDebateParticipants();
    await setStoredDebateParticipants([
      {
        debateId,
        userId: user.id,
        userName: user.name,
        side: nextSide,
        role: "member",
      },
      ...storedParticipants.filter((entry) => !(entry.debateId === debateId && entry.userId === user.id)),
    ]);
  }

  const sideTurnCount = (await getDebateTurnsForDebate(debateId)).filter((turn) => turn.side === nextSide).length;
  const turnType = sideTurnCount === 0 ? "opening" : sideTurnCount === 1 ? "response" : "closing";

  await setStoredDebateTurns([
    {
      id: `debate_turn_${Date.now()}`,
      debateId,
      side: nextSide,
      turnType,
      statementText,
      videoAttachmentUrl: null,
      citations: [],
      createdByUserId: user.id,
      createdAt: new Date().toISOString(),
    },
    ...turns,
  ]);

  redirectWithStatus(returnPath, "debate", "statement-saved");
}

export async function submitDebateCommunityVote(formData: FormData) {
  const user = await getCurrentUser();
  const debateId = sanitizeText(formData.get("debateId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);
  const vote = formData.get("vote");

  if (!user.isVerifiedVoter || (vote !== "A" && vote !== "B" && vote !== "noClearWinner")) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const debate = await getDebateRecord(debateId);

  if (!debate || debate.status === "open") {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const closesAt = getDebateVoteWindowClose(debate.closedAt ?? null);

  if (!closesAt || Date.now() > Date.parse(closesAt)) {
    redirectWithStatus(returnPath, "debateError", "timing");
  }

  const existing = await getStoredDebateCommunityVotes();
  await setStoredDebateCommunityVotes([
    {
      id: `debate_community_vote_${Date.now()}`,
      debateId,
      userId: user.id,
      vote: vote as DebateCommunityVoteOption,
      createdAt: new Date().toISOString(),
    },
    ...existing.filter((entry) => !(entry.debateId === debateId && entry.userId === user.id)),
  ]);

  redirectWithStatus(returnPath, "debate", "community-vote-saved");
}

export async function acceptDebateChallenge(formData: FormData) {
  const user = await getCurrentUser();
  const debateId = sanitizeText(formData.get("debateId"));

  if (!debateId) {
    redirect("/debates?debateError=invalid");
  }

  const debate = await getDebateRecord(debateId);
  if (!debate || debate.mode !== "individual" || debate.challengedUserId !== user.id || debate.startState !== "pendingChallenge") {
    redirect(`/debates/${debateId}?debateError=permissions`);
  }

  const debates = await getStoredDebates();
  const participants = await getStoredDebateParticipants();
  await setStoredDebates([
    {
      ...debate,
      startState: "active",
    },
    ...debates.filter((entry) => entry.id !== debateId),
  ]);
  await setStoredDebateParticipants([
    {
      debateId,
      userId: user.id,
      userName: user.name,
      side: "B",
      role: "lead",
    },
    ...participants.filter((entry) => !(entry.debateId === debateId && entry.userId === user.id)),
  ]);

  const joiningUserFollowerIds = (await getFollowerUserIds(user.id)).filter((followerId) => followerId !== user.id);
  if (joiningUserFollowerIds.length) {
    await createDebateFollowedUserJoinedNotifications({
      userIds: joiningUserFollowerIds,
      debateId,
      debateTitle: debate.title,
      joinedUserName: user.name,
      contextEntityId: user.id,
    });
  }

  await notifyDebateActivated(debateId, debate.title, [user.id]);
  await awardCreditsForAction(user.id, "debateJoin", 2, {
    rewardKey: `debateJoin:${user.id}:${debateId}`,
  });

  redirect(`/debates/${debateId}?debateCreate=challenge-accepted`);
}

export async function joinGroupDebate(formData: FormData) {
  const user = await getCurrentUser();
  const debateId = sanitizeText(formData.get("debateId"));
  const side = formData.get("side");

  if (!debateId || (side !== "A" && side !== "B")) {
    redirect("/debates?debateError=invalid");
  }

  const debate = await getDebateRecord(debateId);
  if (!debate || debate.mode !== "group") {
    redirect(`/debates/${debateId}?debateError=invalid`);
  }

  if (user.role !== "trustedCitizen") {
    redirect(`/debates/${debateId}?debateError=permissions`);
  }

  const detail = await getDebateDetail(debateId, user);
  const requiredTag = (side === "A" ? debate.sideAGroupTag : debate.sideBGroupTag)?.toLowerCase();
  const profile = await getUserProfileContent(user.id);
  const tagValues = new Set([...profile.groupTags.map((entry) => entry.value.toLowerCase()), ...profile.identityTags.map((entry) => entry.value.toLowerCase())]);
  if (!requiredTag || !tagValues.has(requiredTag)) {
    redirect(`/debates/${debateId}?debateError=permissions`);
  }

  const participants = await getStoredDebateParticipants();
  await setStoredDebateParticipants([
    {
      debateId,
      userId: user.id,
      userName: user.name,
      side,
      role: detail?.participants.some((entry) => entry.side === side) ? "member" : "lead",
    },
    ...participants.filter((entry) => !(entry.debateId === debateId && entry.userId === user.id)),
  ]);

  const joiningUserFollowerIds = (await getFollowerUserIds(user.id)).filter((followerId) => followerId !== user.id);
  if (joiningUserFollowerIds.length) {
    await createDebateFollowedUserJoinedNotifications({
      userIds: joiningUserFollowerIds,
      debateId,
      debateTitle: debate.title,
      joinedUserName: user.name,
      contextEntityId: user.id,
    });
  }

  const allParticipants = await getDebateParticipants(debateId);
  const withJoiningUser = [
    ...allParticipants.filter((entry) => entry.userId !== user.id),
    { debateId, userId: user.id, userName: user.name, side, role: allParticipants.some((entry) => entry.side === side) ? "member" : "lead" as const },
  ];
  const hasA = withJoiningUser.some((entry) => entry.side === "A");
  const hasB = withJoiningUser.some((entry) => entry.side === "B");
  if (debate.startState === "seekingParticipants" && hasA && hasB) {
    const debates = await getStoredDebates();
    await setStoredDebates([
      {
        ...debate,
        startState: "active",
      },
      ...debates.filter((entry) => entry.id !== debateId),
    ]);

    await notifyDebateActivated(debateId, debate.title, [user.id]);
  }

  await awardCreditsForAction(user.id, "debateJoin", 2, {
    rewardKey: `debateJoin:${user.id}:${debateId}`,
  });

  redirect(`/debates/${debateId}?debateCreate=joined`);
}

export async function followDebate(formData: FormData) {
  const user = await getCurrentUser();
  const debateId = sanitizeText(formData.get("debateId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);

  if (!debateId) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const debate = await getDebateRecord(debateId);
  if (!debate) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const followState = await getDebateFollowState(user.id, debateId);
  if (followState.viewerIsFollowing) {
    redirectWithStatus(returnPath, "debateFollow", "exists");
  }

  const follows = await getStoredDebateFollows();
  const removedKeys = await getRemovedDebateFollowKeys();
  const followKey = `${debateId}:${user.id}`;
  await setStoredDebateFollows([
    {
      id: `debate_follow_${Date.now()}`,
      debateId,
      userId: user.id,
      createdAt: new Date().toISOString(),
    },
    ...follows.filter((entry) => !(entry.debateId === debateId && entry.userId === user.id)),
  ]);
  await setRemovedDebateFollowKeys(removedKeys.filter((entry) => entry !== followKey));

  redirectWithStatus(returnPath, "debateFollow", "saved");
}

export async function unfollowDebate(formData: FormData) {
  const user = await getCurrentUser();
  const debateId = sanitizeText(formData.get("debateId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);

  if (!debateId) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const debate = await getDebateRecord(debateId);
  if (!debate) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const follows = await getStoredDebateFollows();
  const removedKeys = await getRemovedDebateFollowKeys();
  const followKey = `${debateId}:${user.id}`;

  await setStoredDebateFollows(follows.filter((entry) => !(entry.debateId === debateId && entry.userId === user.id)));
  await setRemovedDebateFollowKeys([...new Set([...removedKeys, followKey])]);

  redirectWithStatus(returnPath, "debateFollow", "removed");
}

export async function submitDebateTurnStatement(formData: FormData) {
  const user = await getCurrentUser();
  const debateId = typeof formData.get("debateId") === "string" ? (formData.get("debateId") as string) : "";
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);
  const statementText = sanitizeText(formData.get("statementText"));
  const videoAttachmentUrl = sanitizeOptionalUrl(formData.get("videoAttachmentUrl"));

  if (!debateId || statementText.length < 32) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const detail = await getDebateDetail(debateId, user);

  if (!detail || !detail.currentTurn || !detail.viewerCanSubmitTurn) {
    redirectWithStatus(returnPath, "debateError", "permissions");
  }

  const turns = await getStoredDebateTurns();
  const now = new Date().toISOString();
  const citationPayload = getStructuredCitations(formData, now);
  if (citationPayload.error) {
    redirectWithStatus(returnPath, "debateError", citationPayload.error);
  }
  const turnId = `debate_turn_${Date.now()}`;
  await setStoredDebateTurns([
    {
      id: turnId,
      debateId,
      side: detail.currentTurn.side,
      turnType: detail.currentTurn.turnType,
      statementText,
      videoAttachmentUrl,
      citations: citationPayload.citations.map((citation) => ({
        ...citation,
        debateTurnId: turnId,
      })),
      createdByUserId: user.id,
      createdAt: now,
    },
    ...turns,
  ]);

  await notifyDebatePublishedTurn({
    debateId,
    debateTitle: detail.title,
    turnId,
    turnLabel: detail.currentTurn.label,
    excludedUserIds: [user.id],
  });

  if (detail.turns.length + 1 >= totalTurnCount(detail.numberOfRounds)) {
    const overrides = await getStoredDebateOverrides();
    await setStoredDebateOverrides([
      {
        debateId,
        status: "completed",
        outcomeType: "completed",
        closedAt: now,
      },
      ...overrides.filter((entry) => entry.debateId !== debateId),
    ]);

    await notifyDebateOutcome({
      debateId,
      debateTitle: detail.title,
      type: "debateCompleted",
      excludedUserIds: [user.id],
    });
    await awardDebateCompletionCredits(debateId);
  }

  redirectWithStatus(returnPath, "debate", "turn-submitted");
}

export async function submitDebateDraft(formData: FormData) {
  const user = await getCurrentUser();
  const debateId = typeof formData.get("debateId") === "string" ? (formData.get("debateId") as string) : "";
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);
  const statementText = sanitizeText(formData.get("statementText"));

  if (!debateId || statementText.length < 32) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const detail = await getDebateDetail(debateId, user);
  if (!detail || !detail.currentTurn || !detail.viewerCanSubmitDraft) {
    redirectWithStatus(returnPath, "debateError", "permissions");
  }

  const drafts = await getStoredDebateDrafts();
  const currentDrafts = detail.currentDrafts.filter((entry) => entry.createdByUserId === user.id);
  const now = new Date().toISOString();
  const nextDraft = {
    id: `debate_draft_${Date.now()}`,
    debateId,
    side: detail.currentTurn.side,
    turnType: detail.currentTurn.turnType,
    statementText,
    createdByUserId: user.id,
    createdAt: now,
  };

  await setStoredDebateDrafts([
    nextDraft,
    ...drafts.filter((entry) => !currentDrafts.some((draft) => draft.id === entry.id)),
  ]);

  redirectWithStatus(returnPath, "debate", "draft-submitted");
}

export async function voteOnDebateDraft(formData: FormData) {
  const user = await getCurrentUser();
  const draftId = typeof formData.get("draftId") === "string" ? (formData.get("draftId") as string) : "";
  const debateId = typeof formData.get("debateId") === "string" ? (formData.get("debateId") as string) : "";
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);

  if (!draftId || !debateId) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const detail = await getDebateDetail(debateId, user);
  if (!detail || !detail.currentTurn || !detail.viewerCanVoteOnDrafts) {
    redirectWithStatus(returnPath, "debateError", "permissions");
  }

  const targetDraft = detail.currentDrafts.find((draft) => draft.id === draftId);
  if (!targetDraft || targetDraft.createdByUserId === user.id) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const currentVotes = await getStoredDebateDraftVotes();
  const currentDraftIds = new Set(detail.currentDrafts.map((draft) => draft.id));
  await setStoredDebateDraftVotes([
    {
      id: `debate_draft_vote_${Date.now()}`,
      draftId,
      userId: user.id,
      createdAt: new Date().toISOString(),
    },
    ...currentVotes.filter((entry) => !(entry.userId === user.id && currentDraftIds.has(entry.draftId))),
  ]);

  redirectWithStatus(returnPath, "debate", "vote-saved");
}

export async function finalizeGroupDebateTurn(formData: FormData) {
  const user = await getCurrentUser();
  const debateId = typeof formData.get("debateId") === "string" ? (formData.get("debateId") as string) : "";
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);

  if (!debateId) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const detail = await getDebateDetail(debateId, user);
  if (!detail || !detail.currentTurn || detail.mode !== "group" || detail.currentTurn.phase !== "readyToFinalize") {
    redirectWithStatus(returnPath, "debateError", "timing");
  }

  const eligibility = await canUserParticipateForCurrentTurn(user, debateId);
  if (!eligibility.allowed) {
    redirectWithStatus(returnPath, "debateError", "permissions");
  }

  const draftVotes = await getDebateDraftVotesForDebate(debateId);
  const voteCountForDraft = (draftId: string) => draftVotes.filter((entry) => entry.draftId === draftId).length;
  const rankedDrafts = [...detail.currentDrafts].sort(
    (a, b) => voteCountForDraft(b.id) - voteCountForDraft(a.id) || Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const chosenDraft = rankedDrafts[0];
  const now = new Date().toISOString();
  const turnId = `debate_turn_${Date.now()}`;

  const turns = await getStoredDebateTurns();
  await setStoredDebateTurns([
    {
      id: turnId,
      debateId,
      side: detail.currentTurn.side,
      turnType: detail.currentTurn.turnType,
      statementText: chosenDraft?.statementText ?? `${detail.currentTurn.sideName} forfeited this turn.`,
      createdByUserId: chosenDraft?.createdByUserId ?? user.id,
      createdAt: now,
    },
    ...turns,
  ]);

  await notifyDebatePublishedTurn({
    debateId,
    debateTitle: detail.title,
    turnId,
    turnLabel: detail.currentTurn.label,
    excludedUserIds: [user.id],
  });

  const storedDrafts = await getStoredDebateDrafts();
  const draftIds = new Set(detail.currentDrafts.map((draft) => draft.id));
  await setStoredDebateDrafts(storedDrafts.filter((entry) => !draftIds.has(entry.id)));

  const storedVotes = await getStoredDebateDraftVotes();
  await setStoredDebateDraftVotes(storedVotes.filter((entry) => !draftIds.has(entry.draftId)));

  if (detail.turns.length + 1 >= totalTurnCount(detail.numberOfRounds)) {
    const overrides = await getStoredDebateOverrides();
    await setStoredDebateOverrides([
      {
        debateId,
        status: "completed",
        outcomeType: "completed",
        closedAt: now,
      },
      ...overrides.filter((entry) => entry.debateId !== debateId),
    ]);

    await notifyDebateOutcome({
      debateId,
      debateTitle: detail.title,
      type: "debateCompleted",
      excludedUserIds: [user.id],
    });
    await awardDebateCompletionCredits(debateId);
  }

  redirectWithStatus(returnPath, "debate", chosenDraft ? "turn-finalized" : "turn-forfeited");
}

export async function reactToDebateTurn(formData: FormData) {
  const user = await getCurrentUser();
  const turnId = typeof formData.get("turnId") === "string" ? (formData.get("turnId") as string) : "";
  const reaction = formData.get("reaction");
  const debateId = typeof formData.get("debateId") === "string" ? (formData.get("debateId") as string) : "";
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);

  if (!turnId || (reaction !== "support" && reaction !== "oppose")) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const reactions = await getStoredDebateReactions();
  await setStoredDebateReactions([
    {
      id: `debate_reaction_${Date.now()}`,
      turnId,
      userId: user.id,
      reaction,
      createdAt: new Date().toISOString(),
    },
    ...reactions.filter((entry) => !(entry.turnId === turnId && entry.userId === user.id)),
  ]);

  redirectWithStatus(returnPath, "debate", reaction === "support" ? "sentiment-support" : "sentiment-oppose");
}

export async function tagDebateTurnFallacy(formData: FormData) {
  const user = await getCurrentUser();
  const turnId = sanitizeText(formData.get("turnId"));
  const debateId = sanitizeText(formData.get("debateId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);
  const fallacyType = sanitizeText(formData.get("fallacyType"));

  if (!turnId || !debateId || !DEBATE_FALLACY_TYPES.includes(fallacyType as (typeof DEBATE_FALLACY_TYPES)[number])) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  if (!canUserTagDebateFallacies(user)) {
    redirectWithStatus(returnPath, "debateError", "permissions");
  }

  const detail = await getDebateDetail(debateId, user);
  if (!detail || !detail.turns.some((turn) => turn.id === turnId)) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  const tags = await getStoredDebateFallacyTags();
  const alreadyTagged = detail.turns
    .find((turn) => turn.id === turnId)
    ?.fallacyTags.some((tag) => tag.type === fallacyType && tag.viewerTagged);

  if (alreadyTagged) {
    redirectWithStatus(returnPath, "debate", "fallacy-exists");
  }

  await setStoredDebateFallacyTags([
    {
      id: `debate_fallacy_${Date.now()}`,
      debateTurnId: turnId,
      userId: user.id,
      fallacyType: fallacyType as (typeof DEBATE_FALLACY_TYPES)[number],
      createdAt: new Date().toISOString(),
    },
    ...tags,
  ]);

  redirectWithStatus(returnPath, "debate", "fallacy-tagged");
}

export async function reviewDebateFallacyTag(formData: FormData) {
  const user = await getCurrentUser();
  const turnId = sanitizeText(formData.get("turnId"));
  const debateId = sanitizeText(formData.get("debateId"));
  const returnPath = safeReturnPath(formData.get("returnPath"), debateId);
  const fallacyType = sanitizeText(formData.get("fallacyType"));
  const position = formData.get("position");

  if (
    !turnId ||
    !debateId ||
    !DEBATE_FALLACY_TYPES.includes(fallacyType as (typeof DEBATE_FALLACY_TYPES)[number]) ||
    (position !== "agree" && position !== "disagree")
  ) {
    redirectWithStatus(returnPath, "debateError", "invalid");
  }

  if (!canUserTagDebateFallacies(user)) {
    redirectWithStatus(returnPath, "debateError", "permissions");
  }

  const detail = await getDebateDetail(debateId, user);
  const turn = detail?.turns.find((entry) => entry.id === turnId);
  const displayedTag = turn?.fallacyTags.find((entry) => entry.type === fallacyType);

  if (!detail || !turn || !displayedTag || displayedTag.viewerTagged) {
    redirectWithStatus(returnPath, "debateError", "permissions");
  }

  const reviews = await getStoredDebateFallacyReviews();
  await setStoredDebateFallacyReviews([
    {
      id: `debate_fallacy_review_${Date.now()}`,
      debateTurnId: turnId,
      fallacyType: fallacyType as (typeof DEBATE_FALLACY_TYPES)[number],
      userId: user.id,
      position,
      createdAt: new Date().toISOString(),
    },
    ...reviews.filter(
      (entry) => !(entry.debateTurnId === turnId && entry.fallacyType === fallacyType && entry.userId === user.id),
    ),
  ]);

  redirectWithStatus(returnPath, "debate", position === "agree" ? "fallacy-agreed" : "fallacy-disagreed");
}
