import { getCommunityById, seededCommunities } from "@/lib/community/communities";
import { normalizeWhitespace, slugify } from "@/lib/public-meetings/shared";
import type { PublicMeetingRecord } from "@/lib/public-meetings/types";

export type AccountabilityGraphNodeType =
  | "community"
  | "meeting"
  | "agenda_item"
  | "decision"
  | "vote"
  | "attendance"
  | "official"
  | "outcome"
  | "spending"
  | "project"
  | "issue"
  | "source";

export type AccountabilityGraphNode = {
  id: string;
  type: AccountabilityGraphNodeType;
  label: string;
  href: string | null;
  metadata?: Record<string, unknown>;
};

export type AccountabilityGraphEdge = {
  from: string;
  to: string;
  type: string;
  confidence: number;
  sourceReferenceIds: string[];
};

export type AccountabilityGraph = {
  generatedAt: string;
  sourceArtifacts: string[];
  totals: {
    nodes: number;
    edges: number;
    communities: number;
    decisions: number;
    projects: number;
    spendingNodes: number;
  };
  nodes: AccountabilityGraphNode[];
  edges: AccountabilityGraphEdge[];
  communitySummaries: Record<
    string,
    {
      communityName: string;
      decisions: number;
      projects: number;
      spendingApproved: number;
      officialsInvolved: number;
      votesParsed: number;
      lastActivityAt: string | null;
    }
  >;
};

type VotingCardRecord = {
  id: string;
  agendaItemId: string;
  meetingId: string;
  title: string;
  jurisdiction: string;
  voteOutcome: string;
  voteCount: { totalKnown: number; display: string };
  financialImpact: { estimatedAmount: number | null; description: string | null; raw: string | null };
  relatedIssues: string[];
  relatedOfficials: Array<{ id: string | null; name: string; actionType: string; actionText: string }>;
  sourceReferences: Array<{ label: string; url: string | null; path: string | null; snippet: string | null }>;
  confidence: number;
  meeting: { id: string; title: string; date: string | null; href: string };
};

type ProjectRecord = {
  id: string;
  name: string;
  status: string;
  jurisdiction: string;
  budget: number | null;
  sourceMeetings: Array<{ id: string; title: string; date: string | null; href: string }>;
  relatedVotes: string[];
  relatedIssues: string[];
  sourceReferences: Array<{ label: string; url: string | null; path: string | null; snippet: string | null }>;
  confidence: number;
};

type AttendanceRecord = {
  id: string;
  meetingId: string;
  personName: string;
  matchedOfficialId: string | null;
  attendanceStatus: string;
  votingEligibility: string;
  sourceSnippet: string;
  sourceDocument: string | null;
  confidence: number;
};

export type BuildAccountabilityGraphInput = {
  generatedAt?: string;
  meetings: PublicMeetingRecord[];
  votingCards: VotingCardRecord[];
  projects: ProjectRecord[];
  attendance?: AttendanceRecord[];
};

function normalize(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\bnv\b/g, "nevada")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function communityForJurisdiction(jurisdiction: string) {
  const normalized = normalize(jurisdiction);
  return (
    seededCommunities.find((community) => community.jurisdictionMatches.some((match) => normalize(match) === normalized)) ??
    seededCommunities.find((community) => community.jurisdictionMatches.some((match) => normalized.includes(normalize(match)) || normalize(match).includes(normalized))) ??
    getCommunityById("nevada")
  );
}

function addNode(nodes: Map<string, AccountabilityGraphNode>, node: AccountabilityGraphNode) {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function addEdge(edges: Map<string, AccountabilityGraphEdge>, edge: AccountabilityGraphEdge) {
  const key = `${edge.from}->${edge.to}:${edge.type}`;
  if (!edges.has(key)) edges.set(key, edge);
}

function sourceIdFor(cardId: string, index: number) {
  return `source:${cardId}:${index}`;
}

export function buildAccountabilityGraph(input: BuildAccountabilityGraphInput): AccountabilityGraph {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const nodes = new Map<string, AccountabilityGraphNode>();
  const edges = new Map<string, AccountabilityGraphEdge>();
  const meetingsById = new Map(input.meetings.map((meeting) => [meeting.id, meeting]));
  const attendanceByMeetingId = new Map<string, AttendanceRecord[]>();
  for (const attendance of input.attendance ?? []) {
    attendanceByMeetingId.set(attendance.meetingId, [...(attendanceByMeetingId.get(attendance.meetingId) ?? []), attendance]);
  }
  const projectsByVoteId = new Map<string, ProjectRecord[]>();
  for (const project of input.projects) {
    for (const voteId of project.relatedVotes) {
      projectsByVoteId.set(voteId, [...(projectsByVoteId.get(voteId) ?? []), project]);
    }
  }

  for (const card of input.votingCards) {
    const community = communityForJurisdiction(card.jurisdiction);
    const communityId = `community:${community?.id ?? "nevada"}`;
    const meeting = meetingsById.get(card.meetingId);
    const meetingId = `meeting:${card.meetingId}`;
    const agendaItemId = `agenda_item:${card.agendaItemId}`;
    const decisionId = `decision:${card.id}`;
    const voteId = `vote:${card.id}`;
    const outcomeId = `outcome:${card.id}:${card.voteOutcome}`;
    const sourceIds = card.sourceReferences.map((_, index) => sourceIdFor(card.id, index));

    addNode(nodes, {
      id: communityId,
      type: "community",
      label: community?.name ?? card.jurisdiction,
      href: community ? `/community/${community.id}` : null,
    });
    addNode(nodes, {
      id: meetingId,
      type: "meeting",
      label: meeting?.title ?? card.meeting.title,
      href: card.meeting.href || `/events/${card.meetingId}`,
      metadata: { date: card.meeting.date, jurisdiction: card.jurisdiction },
    });
    addNode(nodes, {
      id: agendaItemId,
      type: "agenda_item",
      label: `Agenda item for ${card.title}`,
      href: `${card.meeting.href || `/events/${card.meetingId}`}#${card.agendaItemId}`,
      metadata: { agendaItemId: card.agendaItemId },
    });
    addNode(nodes, {
      id: decisionId,
      type: "decision",
      label: card.title,
      href: `/voting/all?decision=${encodeURIComponent(card.id)}`,
      metadata: { confidence: card.confidence, jurisdiction: card.jurisdiction },
    });
    addNode(nodes, {
      id: voteId,
      type: "vote",
      label: card.voteCount.display,
      href: card.meeting.href || `/events/${card.meetingId}`,
      metadata: { totalKnown: card.voteCount.totalKnown, officials: card.relatedOfficials },
    });
    addNode(nodes, {
      id: outcomeId,
      type: "outcome",
      label: card.voteOutcome,
      href: card.meeting.href || `/events/${card.meetingId}`,
    });

    for (const [index, source] of card.sourceReferences.entries()) {
      const sourceId = sourceIds[index];
      addNode(nodes, {
        id: sourceId,
        type: "source",
        label: source.label,
        href: source.url,
        metadata: { path: source.path, snippet: source.snippet },
      });
      addEdge(edges, { from: decisionId, to: sourceId, type: "supported_by_source", confidence: card.confidence, sourceReferenceIds: [sourceId] });
    }

    addEdge(edges, { from: communityId, to: meetingId, type: "has_meeting", confidence: card.confidence, sourceReferenceIds: sourceIds });
    addEdge(edges, { from: meetingId, to: agendaItemId, type: "has_agenda_item", confidence: card.confidence, sourceReferenceIds: sourceIds });
    addEdge(edges, { from: agendaItemId, to: decisionId, type: "translated_to_decision", confidence: card.confidence, sourceReferenceIds: sourceIds });
    addEdge(edges, { from: decisionId, to: voteId, type: "has_vote", confidence: card.confidence, sourceReferenceIds: sourceIds });
    addEdge(edges, { from: voteId, to: outcomeId, type: "produced_outcome", confidence: card.confidence, sourceReferenceIds: sourceIds });

    for (const attendance of attendanceByMeetingId.get(card.meetingId) ?? []) {
      const attendanceId = `attendance:${attendance.id}`;
      const officialId = `official:${attendance.matchedOfficialId ?? slugify(attendance.personName)}`;
      addNode(nodes, {
        id: attendanceId,
        type: "attendance",
        label: `${attendance.personName} · ${attendance.attendanceStatus}`,
        href: card.meeting.href || `/events/${card.meetingId}`,
        metadata: {
          meetingId: attendance.meetingId,
          votingEligibility: attendance.votingEligibility,
          sourceSnippet: attendance.sourceSnippet,
          sourceDocument: attendance.sourceDocument,
        },
      });
      addNode(nodes, {
        id: officialId,
        type: "official",
        label: attendance.personName,
        href: attendance.matchedOfficialId ? `/officials/${attendance.matchedOfficialId}` : null,
        metadata: { matchedOfficialId: attendance.matchedOfficialId, matchStatus: attendance.matchedOfficialId ? "matched" : "unmatched" },
      });
      addEdge(edges, { from: meetingId, to: attendanceId, type: "has_attendance", confidence: attendance.confidence, sourceReferenceIds: sourceIds });
      addEdge(edges, { from: attendanceId, to: officialId, type: attendance.matchedOfficialId ? "attendance_matches_official" : "attendance_mentions_unmatched_person", confidence: attendance.confidence, sourceReferenceIds: sourceIds });
    }

    if (card.financialImpact.estimatedAmount || card.financialImpact.raw || card.financialImpact.description) {
      const spendingId = `spending:${card.id}`;
      addNode(nodes, {
        id: spendingId,
        type: "spending",
        label: card.financialImpact.description ?? card.financialImpact.raw ?? "Financial impact",
        href: card.meeting.href || `/events/${card.meetingId}`,
        metadata: { amount: card.financialImpact.estimatedAmount, raw: card.financialImpact.raw },
      });
      addEdge(edges, { from: outcomeId, to: spendingId, type: "may_authorize_spending", confidence: card.confidence, sourceReferenceIds: sourceIds });
    }

    for (const issue of card.relatedIssues) {
      const issueId = `issue:${slugify(issue)}`;
      addNode(nodes, {
        id: issueId,
        type: "issue",
        label: issue,
        href: `/issues/${slugify(issue)}`,
      });
      addEdge(edges, { from: decisionId, to: issueId, type: "connects_to_issue", confidence: card.confidence, sourceReferenceIds: sourceIds });
    }

    for (const project of projectsByVoteId.get(card.id) ?? []) {
      const projectId = `project:${project.id}`;
      addNode(nodes, {
        id: projectId,
        type: "project",
        label: project.name,
        href: `/projects/${project.id}`,
        metadata: { budget: project.budget, status: project.status },
      });
      addEdge(edges, { from: outcomeId, to: projectId, type: "advances_project", confidence: Math.min(card.confidence, project.confidence), sourceReferenceIds: sourceIds });
    }
  }

  const communitySummaries: AccountabilityGraph["communitySummaries"] = {};
  for (const community of seededCommunities) {
    const communityCards = input.votingCards.filter((card) => communityForJurisdiction(card.jurisdiction)?.id === community.id);
    const cardIds = new Set(communityCards.map((card) => card.id));
    const communityProjects = input.projects.filter((project) => project.relatedVotes.some((voteId) => cardIds.has(voteId)));
    const officialNames = new Set<string>();
    for (const card of communityCards) {
      for (const official of card.relatedOfficials) officialNames.add(official.name);
    }
    const spendingApproved = communityCards.reduce((sum, card) => {
      const amount = card.financialImpact.estimatedAmount ?? 0;
      return sum + (Number.isFinite(amount) && ["approved", "unknown"].includes(card.voteOutcome) ? amount : 0);
    }, 0);
    const votesParsed = communityCards.reduce((sum, card) => sum + card.voteCount.totalKnown, 0);
    const lastActivityAt =
      communityCards
        .map((card) => card.meeting.date)
        .filter((date): date is string => Boolean(date))
        .sort((left, right) => (Date.parse(right) || 0) - (Date.parse(left) || 0))[0] ?? null;

    communitySummaries[community.id] = {
      communityName: community.name,
      decisions: communityCards.length,
      projects: communityProjects.length,
      spendingApproved,
      officialsInvolved: officialNames.size,
      votesParsed,
      lastActivityAt,
    };
  }

  const nodeList = [...nodes.values()];
  const edgeList = [...edges.values()];
  return {
    generatedAt,
    sourceArtifacts: ["data/generated/public-meetings.json", "data/generated/voting-cards.json", "data/generated/projects-runtime.json", "data/generated/public-meeting-attendance.json"],
    totals: {
      nodes: nodeList.length,
      edges: edgeList.length,
      communities: nodeList.filter((node) => node.type === "community").length,
      decisions: nodeList.filter((node) => node.type === "decision").length,
      projects: nodeList.filter((node) => node.type === "project").length,
      spendingNodes: nodeList.filter((node) => node.type === "spending").length,
    },
    nodes: nodeList,
    edges: edgeList,
    communitySummaries,
  };
}
