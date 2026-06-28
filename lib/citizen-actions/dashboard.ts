import "server-only";

import { getAllCases } from "@/lib/cases/store";
import { getDecisionCards } from "@/lib/civic/decision-pages";
import { seededCommunities } from "@/lib/community/communities";
import { getDiscoverableEventsForUser } from "@/lib/community/event-discovery";
import { getCommunityHubProjects } from "@/lib/community/product-hub";
import type { FavoriteTargetType } from "@/lib/favorites/types";
import { getAllOrganizations } from "@/lib/organizations/store";
import { getAllPetitions } from "@/lib/petitions/store";
import { getOfficials } from "@/lib/officials/store";
import { getPublicPeopleDirectory } from "@/lib/profile/discovery";
import { getFavoritesForUser } from "@/lib/server/favorites";
import { getCandidateProfiles, getElectionSummaries } from "@/lib/server/elections-context";
import { getIssueDirectoryForUser } from "@/lib/server/issues";
import type { AuthUser } from "@/types/domain";

export type CitizenActionItem = {
  id: string;
  targetType: FavoriteTargetType;
  targetId: string;
  label: string;
  title: string;
  summary: string;
  href: string;
  sourceBacked: boolean;
  updateTrigger: string;
  nextActionLabel: string;
  createdAt: string;
};

export type CitizenActionDashboard = {
  generatedAt: string;
  userId: string;
  items: CitizenActionItem[];
  totals: {
    followedItems: number;
    sourceBackedItems: number;
    updateEligibleItems: number;
    decisionsFollowed: number;
    projectsFollowed: number;
  };
};

function clipText(value: string | null | undefined, max = 130) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}...`;
}

function labelForTarget(targetType: FavoriteTargetType) {
  switch (targetType) {
    case "community":
      return "Community";
    case "issue":
      return "Issue";
    case "person":
      return "Citizen";
    case "candidate":
      return "Candidate";
    case "official":
      return "Official";
    case "petition":
      return "Petition";
    case "case":
      return "Case";
    case "event":
      return "Meeting / event";
    case "election":
      return "Election";
    case "organization":
      return "Organization";
    case "decision":
      return "Decision";
    case "project":
      return "Project";
  }
}

function updateTriggerForTarget(targetType: FavoriteTargetType) {
  switch (targetType) {
    case "decision":
      return "Notify when vote attribution, source review, linked projects, or related issues change.";
    case "project":
      return "Notify when status, budget, responsible body, milestone, or related decision links change.";
    case "community":
      return "Notify when new meetings, decisions, projects, issues, or official updates are linked.";
    case "event":
      return "Notify when agenda, minutes, actions, or vote extraction updates are available.";
    case "issue":
      return "Notify when new decisions, cases, meetings, or public summaries connect to this issue.";
    case "case":
      return "Notify when reviewed source records or public summaries change.";
    case "election":
      return "Notify when deadlines, candidates, ballot items, or source records change.";
    default:
      return "Notify when source-backed civic activity changes.";
  }
}

function nextActionForTarget(targetType: FavoriteTargetType) {
  switch (targetType) {
    case "decision":
      return "Review outcome";
    case "project":
      return "Track status";
    case "community":
      return "Open hub";
    case "event":
      return "Open meeting";
    case "issue":
      return "Watch issue";
    case "case":
      return "Review case";
    case "election":
      return "Check deadlines";
    default:
      return "View";
  }
}

export async function getCitizenActionDashboard(user: AuthUser): Promise<CitizenActionDashboard> {
  const [
    favorites,
    decisions,
    projects,
    cases,
    events,
    issues,
    people,
    candidates,
    officials,
    petitions,
    elections,
    organizations,
  ] = await Promise.all([
    getFavoritesForUser(user.id),
    getDecisionCards(),
    getCommunityHubProjects(),
    getAllCases(),
    getDiscoverableEventsForUser(user, { limit: 100 }),
    getIssueDirectoryForUser(user),
    getPublicPeopleDirectory(user),
    getCandidateProfiles(),
    getOfficials(),
    getAllPetitions(),
    getElectionSummaries(),
    getAllOrganizations(user),
  ]);

  const items = favorites.flatMap((favorite): CitizenActionItem[] => {
    const base = {
      id: `${favorite.targetType}-${favorite.targetId}`,
      targetType: favorite.targetType,
      targetId: favorite.targetId,
      label: labelForTarget(favorite.targetType),
      updateTrigger: updateTriggerForTarget(favorite.targetType),
      nextActionLabel: nextActionForTarget(favorite.targetType),
      createdAt: favorite.createdAt,
    };

    switch (favorite.targetType) {
      case "community": {
        const community = seededCommunities.find((entry) => entry.id === favorite.targetId);
        return community ? [{ ...base, title: community.name, summary: community.descriptor, href: `/community/${community.id}`, sourceBacked: true }] : [];
      }
      case "decision": {
        const decision = decisions.find((entry) => entry.id === favorite.targetId);
        return decision ? [{ ...base, title: decision.title, summary: `${decision.voteOutcome} · ${decision.voteCount.display}. ${clipText(decision.whyItMatters)}`, href: `/decisions/${decision.id}`, sourceBacked: decision.sourceReferences.length > 0 }] : [];
      }
      case "project": {
        const project = projects.find((entry) => entry.id === favorite.targetId);
        return project ? [{ ...base, title: project.name ?? project.project_title ?? project.title, summary: `${project.status}. ${clipText(project.lastPublicAction ?? project.summary ?? project.description)}`, href: `/projects/${project.id}`, sourceBacked: Boolean(project.source_url || project.sourceMeetings?.length || project.relatedMeetingIds.length) }] : [];
      }
      case "issue": {
        const issue = issues.find((entry) => entry.id === favorite.targetId);
        return issue ? [{ ...base, title: issue.issueText, summary: `${issue.jurisdictionName} · ${issue.upvoteCount} people elevating this issue`, href: `/issues/${issue.id}`, sourceBacked: true }] : [];
      }
      case "person": {
        const person = people.find((entry) => entry.id === favorite.targetId);
        return person ? [{ ...base, title: person.name, summary: `${person.jurisdictionName} · ${clipText(person.bio)}`, href: `/citizens/${person.id}`, sourceBacked: false }] : [];
      }
      case "candidate": {
        const candidate = candidates.find((entry) => entry.id === favorite.targetId);
        return candidate ? [{ ...base, title: candidate.name, summary: `${candidate.partyText ?? "Candidate"} · ${candidate.jurisdictionName}`, href: `/candidates/${candidate.id}`, sourceBacked: Boolean(candidate.sourceUrl) }] : [];
      }
      case "official": {
        const official = officials.find((entry) => entry.id === favorite.targetId);
        return official ? [{ ...base, title: official.name, summary: `${official.officeTitle ?? "Official"} · ${official.jurisdictionName}`, href: `/officials/${official.id}`, sourceBacked: Boolean(official.sourceUrl) }] : [];
      }
      case "petition": {
        const petition = petitions.find((entry) => entry.id === favorite.targetId);
        return petition ? [{ ...base, title: petition.title, summary: `${petition.signatureCount} signatures · ${petition.jurisdictionName}`, href: `/petitions/${petition.id}`, sourceBacked: false }] : [];
      }
      case "case": {
        const caseItem = cases.find((entry) => entry.id === favorite.targetId);
        return caseItem ? [{ ...base, title: caseItem.title, summary: `${caseItem.jurisdictionName} · ${clipText(caseItem.summary)}`, href: `/cases/${caseItem.id}`, sourceBacked: true }] : [];
      }
      case "event": {
        const event = events.find((entry) => entry.id === favorite.targetId);
        return event ? [{ ...base, title: event.title, summary: `${event.distanceLabel} · ${clipText(event.description)}`, href: `/events/${event.id}`, sourceBacked: true }] : [];
      }
      case "election": {
        const election = elections.find((entry) => entry.id === favorite.targetId);
        return election ? [{ ...base, title: election.title, summary: `${election.jurisdictionName} · ${election.officeTitle}`, href: `/elections/${election.id}`, sourceBacked: Boolean(election.sourceLabel) }] : [];
      }
      case "organization": {
        const organization = organizations.find((entry) => entry.id === favorite.targetId);
        return organization ? [{ ...base, title: organization.name, summary: `${organization.jurisdictionName} · ${clipText(organization.description)}`, href: `/organizations/${organization.id}`, sourceBacked: true }] : [];
      }
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    userId: user.id,
    items,
    totals: {
      followedItems: items.length,
      sourceBackedItems: items.filter((item) => item.sourceBacked).length,
      updateEligibleItems: items.filter((item) => item.updateTrigger.length > 0).length,
      decisionsFollowed: items.filter((item) => item.targetType === "decision").length,
      projectsFollowed: items.filter((item) => item.targetType === "project").length,
    },
  };
}
