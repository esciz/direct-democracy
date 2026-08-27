import "server-only";

import { getAllCommunityEvents } from "@/lib/community/events";
import {
  getAllDebateAcknowledgments,
  getAllDebatesForTrust,
  getAllDebateTurnsForTrust,
} from "@/lib/debates/store";
import { getCreatedPosts } from "@/lib/feed/posts";
import { getAllPetitions } from "@/lib/petitions/store";
import { getUserCivicActivityCollection, type CivicActivityItem } from "@/lib/server/profile-activity";

export type LeadershipDimensionKey =
  | "groundedKnowledge"
  | "constructiveDeliberation"
  | "initiative"
  | "followThrough"
  | "communityRegard";

export type LeadershipDimension = {
  key: LeadershipDimensionKey;
  label: string;
  state: "Starting" | "Building" | "Demonstrated";
  evidenceCount: number;
  detail: string;
};

export type CivicLeadershipRecord = {
  stage: "Emerging participant" | "Active contributor" | "Civic builder" | "Community steward";
  summary: string;
  dimensions: LeadershipDimension[];
  acknowledgments: Array<{ label: string; count: number }>;
  evidence: CivicActivityItem[];
  nextPractice: {
    title: string;
    detail: string;
    href: string;
    actionLabel: string;
  };
};

const ACKNOWLEDGMENT_LABELS = {
  wellSourced: "Well sourced",
  helpedMeUnderstand: "Helped me understand",
  fairRepresentation: "Fair representation",
  constructiveChallenge: "Constructive challenge",
  practicalProposal: "Practical proposal",
} as const;

function getDimensionState(evidenceCount: number, demonstratedAt: number): LeadershipDimension["state"] {
  if (evidenceCount >= demonstratedAt) return "Demonstrated";
  if (evidenceCount > 0) return "Building";
  return "Starting";
}

function getStage(dimensions: LeadershipDimension[]): CivicLeadershipRecord["stage"] {
  const demonstrated = dimensions.filter((dimension) => dimension.state === "Demonstrated").length;
  const active = dimensions.filter((dimension) => dimension.state !== "Starting").length;

  if (demonstrated >= 4) return "Community steward";
  if (demonstrated >= 2 && active >= 4) return "Civic builder";
  if (active >= 2) return "Active contributor";
  return "Emerging participant";
}

function getNextPractice(dimensions: LeadershipDimension[]): CivicLeadershipRecord["nextPractice"] {
  const next = dimensions.find((dimension) => dimension.state === "Starting") ??
    dimensions.find((dimension) => dimension.state === "Building") ??
    dimensions[0];

  switch (next.key) {
    case "groundedKnowledge":
      return {
        title: "Ground your next contribution",
        detail: "Add evidence or a primary source inside an issue room so neighbors can inspect the basis for your position.",
        href: "/issues",
        actionLabel: "Find an issue",
      };
    case "constructiveDeliberation":
      return {
        title: "Practice disagreement in public",
        detail: "Join a structured debate and respond to the strongest version of the other side's argument.",
        href: "/debates",
        actionLabel: "Open debates",
      };
    case "initiative":
      return {
        title: "Create a path to action",
        detail: "Start a focused event, debate, or petition tied to a real community decision.",
        href: "/events/create",
        actionLabel: "Create an event",
      };
    case "followThrough":
      return {
        title: "Close an open loop",
        detail: "Return to work you started and publish what happened, what changed, or what the community should do next.",
        href: "/profile/activity",
        actionLabel: "Review your activity",
      };
    case "communityRegard":
      return {
        title: "Make your value legible to others",
        detail: "Contribute something neighbors can recognize as fair, useful, well sourced, or practical even when they disagree.",
        href: "/debates",
        actionLabel: "Contribute to a debate",
      };
  }
}

export async function getCivicLeadershipRecord(userId: string): Promise<CivicLeadershipRecord> {
  const [activity, posts, debates, turns, acknowledgments, events, petitions] = await Promise.all([
    getUserCivicActivityCollection(userId),
    getCreatedPosts(),
    getAllDebatesForTrust(),
    getAllDebateTurnsForTrust(),
    getAllDebateAcknowledgments(),
    getAllCommunityEvents(),
    getAllPetitions(),
  ]);

  const authoredPosts = posts.filter((post) => post.authorId === userId);
  const authoredTurns = turns.filter((turn) => turn.createdByUserId === userId);
  const authoredTurnIds = new Set(authoredTurns.map((turn) => turn.id));
  const acknowledgmentsReceived = acknowledgments.filter(
    (acknowledgment) => authoredTurnIds.has(acknowledgment.turnId) && acknowledgment.userId !== userId,
  );
  const participatedDebateIds = new Set(authoredTurns.map((turn) => turn.debateId));
  const createdDebates = debates.filter((debate) => debate.createdByUserId === userId);
  const completedDebates = debates.filter(
    (debate) =>
      (debate.createdByUserId === userId || participatedDebateIds.has(debate.id)) &&
      (debate.status === "completed" || debate.status === "agreed"),
  );
  const hostedEvents = events.filter((event) => event.sponsorUserId === userId);
  const completedEvents = hostedEvents.filter((event) => Date.parse(event.endsAt ?? event.startsAt) < Date.now());
  const createdPetitions = petitions.filter((petition) => petition.creatorId === userId);
  const progressedPetitions = createdPetitions.filter(
    (petition) => petition.status === "ELIGIBLE_FOR_COSPONSORSHIP" || petition.status === "CLOSED",
  );
  const groundedPosts = authoredPosts.filter(
    (post) =>
      post.contentType === "statementClaim" ||
      /^\[Evidence\]/i.test(post.title ?? "") ||
      (post.attachments?.length ?? 0) > 0,
  );
  const citedTurns = authoredTurns.filter((turn) => (turn.citations?.length ?? 0) > 0);
  const initiativeCount = createdDebates.length + hostedEvents.length + createdPetitions.length;
  const followThroughCount = completedDebates.length + completedEvents.length + progressedPetitions.length;
  const acknowledgmentCounts = Object.keys(ACKNOWLEDGMENT_LABELS).map((key) => ({
    label: ACKNOWLEDGMENT_LABELS[key as keyof typeof ACKNOWLEDGMENT_LABELS],
    count: acknowledgmentsReceived.filter((entry) => entry.acknowledgment === key).length,
  }));

  const dimensions: LeadershipDimension[] = [
    {
      key: "groundedKnowledge",
      label: "Grounded knowledge",
      evidenceCount: groundedPosts.length + citedTurns.length,
      state: getDimensionState(groundedPosts.length + citedTurns.length, 3),
      detail: "Issue contributions, claims, and debate turns connected to inspectable context or sources.",
    },
    {
      key: "constructiveDeliberation",
      label: "Constructive deliberation",
      evidenceCount: authoredTurns.length,
      state: getDimensionState(authoredTurns.length, 3),
      detail: "Ordered contributions made inside debates where another position can answer directly.",
    },
    {
      key: "initiative",
      label: "Civic initiative",
      evidenceCount: initiativeCount,
      state: getDimensionState(initiativeCount, 2),
      detail: "Debates, events, and petitions started to help a community move from attention to action.",
    },
    {
      key: "followThrough",
      label: "Follow-through",
      evidenceCount: followThroughCount,
      state: getDimensionState(followThroughCount, 2),
      detail: "Started work carried through to a completed debate, past event, or progressed petition.",
    },
    {
      key: "communityRegard",
      label: "Community regard",
      evidenceCount: acknowledgmentsReceived.length,
      state: getDimensionState(acknowledgmentsReceived.length, 3),
      detail: "Specific acknowledgments received from other participants for the civic value of a contribution.",
    },
  ];
  const stage = getStage(dimensions);

  return {
    stage,
    summary:
      stage === "Community steward"
        ? "A sustained record across informed participation, constructive disagreement, initiative, and follow-through."
        : stage === "Civic builder"
          ? "A growing record of turning informed participation into useful community work."
          : stage === "Active contributor"
            ? "Visible participation is forming into a civic record across more than one kind of contribution."
            : "The record begins with contextual participation and grows through work other residents can inspect.",
    dimensions,
    acknowledgments: acknowledgmentCounts.filter((entry) => entry.count > 0),
    evidence: activity.allItems.slice(0, 3),
    nextPractice: getNextPractice(dimensions),
  };
}
