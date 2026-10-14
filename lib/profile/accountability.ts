import type {
  CampaignPromiseSummary,
  OfficialActionSummary,
  PublicActionAlignment,
} from "@/types/domain";

type PublicReliabilityInputs = {
  promiseCount: number;
  promiseStatuses?: Array<CampaignPromiseSummary["status"] | null | undefined>;
  alignedCount?: number;
  mixedCount?: number;
  againstCount?: number;
  responsivenessCompletedCount?: number;
  responsivenessAcceptedCount?: number;
  baseScore?: number | null;
};

export type ActionAlignmentSummary = {
  alignedCount: number;
  mixedCount: number;
  againstCount: number;
  totalCount: number;
  summary: string;
};

export type PartyAlignmentSummary = {
  withPartyCount: number;
  mixedPartyCount: number;
  againstPartyCount: number;
  relevantCount: number;
  summary: string;
};

export type OfficialActionTypeSummary = {
  voteCount: number;
  statementCount: number;
  sponsorshipCount: number;
  implementationCount: number;
};

function scorePromiseStatus(status: CampaignPromiseSummary["status"] | null | undefined) {
  if (status === "Achieved") return 100;
  if (status === "In Progress") return 65;
  if (status === "Reversed") return 20;
  return 55;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summarizeOfficialActionAlignment(actions: OfficialActionSummary[]): ActionAlignmentSummary {
  const summary = actions.reduce(
    (totals, action) => {
      const alignment = action.accountabilityAlignment ?? "mixed";

      if (alignment === "aligned") totals.alignedCount += 1;
      if (alignment === "mixed") totals.mixedCount += 1;
      if (alignment === "against") totals.againstCount += 1;

      return totals;
    },
    {
      alignedCount: 0,
      mixedCount: 0,
      againstCount: 0,
    },
  );

  const totalCount = actions.length;
  const fragments = [
    summary.alignedCount ? `${summary.alignedCount} aligned with stated promises or platform` : null,
    summary.againstCount ? `${summary.againstCount} in tension with stated promises or platform` : null,
    summary.mixedCount ? `${summary.mixedCount} mixed or still unclear` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    ...summary,
    totalCount,
    summary: fragments.length ? fragments.join(" · ") : "No visible actions have been classified yet.",
  };
}

export function summarizeOfficialPartyAlignment(actions: OfficialActionSummary[]): PartyAlignmentSummary {
  const summary = actions.reduce(
    (totals, action) => {
      if (!action.partyAlignment) {
        return totals;
      }

      if (action.partyAlignment === "aligned") totals.withPartyCount += 1;
      if (action.partyAlignment === "mixed") totals.mixedPartyCount += 1;
      if (action.partyAlignment === "against") totals.againstPartyCount += 1;

      return totals;
    },
    {
      withPartyCount: 0,
      mixedPartyCount: 0,
      againstPartyCount: 0,
    },
  );

  const relevantCount = summary.withPartyCount + summary.mixedPartyCount + summary.againstPartyCount;
  const fragments = [
    summary.withPartyCount ? `${summary.withPartyCount} with party-position context` : null,
    summary.againstPartyCount ? `${summary.againstPartyCount} against party-position context` : null,
    summary.mixedPartyCount ? `${summary.mixedPartyCount} mixed or unclear on party-position context` : null,
  ].filter((value): value is string => Boolean(value));

  return {
    ...summary,
    relevantCount,
    summary: fragments.length ? fragments.join(" · ") : "No clear party-position comparisons are available yet.",
  };
}

export function summarizeOfficialActionTypes(actions: OfficialActionSummary[]): OfficialActionTypeSummary {
  return actions.reduce(
    (totals, action) => {
      if (action.actionType === "voteCast") {
        totals.voteCount += 1;
        return totals;
      }

      if (action.actionType === "billSponsored" || action.actionType === "billCoSponsored") {
        totals.sponsorshipCount += 1;
        return totals;
      }

      if (action.actionType === "publicStatement" || action.actionType === "policyAnnouncement" || action.actionType === "meetingHeld") {
        totals.statementCount += 1;
        return totals;
      }

      totals.implementationCount += 1;
      return totals;
    },
    {
      voteCount: 0,
      statementCount: 0,
      sponsorshipCount: 0,
      implementationCount: 0,
    },
  );
}

export function supportsPartyAlignmentLens(party: string | null | undefined) {
  const normalized = (party ?? "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return !normalized.includes("nonpartisan") && !normalized.includes("independent");
}

export function buildPublicReliabilityScore({
  promiseCount,
  promiseStatuses = [],
  alignedCount = 0,
  mixedCount = 0,
  againstCount = 0,
  responsivenessCompletedCount = 0,
  responsivenessAcceptedCount = 0,
  baseScore = null,
}: PublicReliabilityInputs) {
  const promiseStatusAverage = average(promiseStatuses.map((status) => scorePromiseStatus(status)));
  const totalActions = alignedCount + mixedCount + againstCount;
  const actionAlignmentScore =
    totalActions > 0
      ? Math.max(0, Math.min(100, Math.round(((alignedCount + mixedCount * 0.5) / totalActions) * 100 - againstCount * 6)))
      : null;
  const promisePresenceScore = Math.min(100, 45 + promiseCount * 8);
  const responsivenessScore = Math.min(100, 42 + responsivenessCompletedCount * 12 + responsivenessAcceptedCount * 5);

  const weightedSources = [
    typeof baseScore === "number" ? baseScore * 0.28 : null,
    promiseStatusAverage !== null ? promiseStatusAverage * 0.3 : null,
    actionAlignmentScore !== null ? actionAlignmentScore * 0.28 : null,
    responsivenessScore * 0.14,
    promiseStatusAverage === null && actionAlignmentScore === null ? promisePresenceScore * 0.18 : null,
  ].filter((value): value is number => typeof value === "number");

  if (!weightedSources.length) {
    return 52;
  }

  return Math.max(0, Math.min(100, Math.round(weightedSources.reduce((sum, value) => sum + value, 0))));
}
