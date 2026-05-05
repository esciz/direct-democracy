import type { IssueSnapshotSummary, IssueTrendSummary, VoteQuestionScope } from "@/types/domain";

const mockIssueSnapshots: IssueSnapshotSummary[] = [
  { id: "snapshot_1", communityId: "carson-city", scope: "local", issue: "Education funding", percentage: 28, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_2", communityId: "carson-city", scope: "local", issue: "Government transparency", percentage: 18, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_3", communityId: "carson-city", scope: "local", issue: "Housing affordability", percentage: 22, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_4", communityId: "carson-city", scope: "local", issue: "Infrastructure", percentage: 19, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_5", communityId: "carson-city", scope: "local", issue: "Education funding", percentage: 31, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_6", communityId: "carson-city", scope: "local", issue: "Government transparency", percentage: 24, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_7", communityId: "carson-city", scope: "local", issue: "Housing affordability", percentage: 20, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_8", communityId: "carson-city", scope: "local", issue: "Infrastructure", percentage: 17, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_9", communityId: "carson-city", scope: "local", issue: "Education funding", percentage: 36, date: "2026-04-01T00:00:00.000Z" },
  { id: "snapshot_10", communityId: "carson-city", scope: "local", issue: "Government transparency", percentage: 29, date: "2026-04-01T00:00:00.000Z" },
  { id: "snapshot_11", communityId: "carson-city", scope: "local", issue: "Housing affordability", percentage: 18, date: "2026-04-01T00:00:00.000Z" },
  { id: "snapshot_12", communityId: "carson-city", scope: "local", issue: "Infrastructure", percentage: 16, date: "2026-04-01T00:00:00.000Z" },

  { id: "snapshot_13", communityId: "nevada", scope: "state", issue: "Housing affordability", percentage: 34, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_14", communityId: "nevada", scope: "state", issue: "Education funding", percentage: 23, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_15", communityId: "nevada", scope: "state", issue: "Government transparency", percentage: 21, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_16", communityId: "nevada", scope: "state", issue: "Economic development", percentage: 17, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_17", communityId: "nevada", scope: "state", issue: "Housing affordability", percentage: 36, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_18", communityId: "nevada", scope: "state", issue: "Education funding", percentage: 24, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_19", communityId: "nevada", scope: "state", issue: "Government transparency", percentage: 25, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_20", communityId: "nevada", scope: "state", issue: "Economic development", percentage: 15, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_21", communityId: "nevada", scope: "state", issue: "Housing affordability", percentage: 37, date: "2026-04-01T00:00:00.000Z" },
  { id: "snapshot_22", communityId: "nevada", scope: "state", issue: "Education funding", percentage: 27, date: "2026-04-01T00:00:00.000Z" },
  { id: "snapshot_23", communityId: "nevada", scope: "state", issue: "Government transparency", percentage: 28, date: "2026-04-01T00:00:00.000Z" },
  { id: "snapshot_24", communityId: "nevada", scope: "state", issue: "Economic development", percentage: 13, date: "2026-04-01T00:00:00.000Z" },

  { id: "snapshot_25", communityId: "united-states", scope: "national", issue: "Taxes / cost of living", percentage: 33, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_26", communityId: "united-states", scope: "national", issue: "Healthcare access", percentage: 24, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_27", communityId: "united-states", scope: "national", issue: "Government transparency", percentage: 18, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_28", communityId: "united-states", scope: "national", issue: "Housing affordability", percentage: 21, date: "2026-03-02T00:00:00.000Z" },
  { id: "snapshot_29", communityId: "united-states", scope: "national", issue: "Taxes / cost of living", percentage: 35, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_30", communityId: "united-states", scope: "national", issue: "Healthcare access", percentage: 22, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_31", communityId: "united-states", scope: "national", issue: "Government transparency", percentage: 20, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_32", communityId: "united-states", scope: "national", issue: "Housing affordability", percentage: 23, date: "2026-03-25T00:00:00.000Z" },
  { id: "snapshot_33", communityId: "united-states", scope: "national", issue: "Taxes / cost of living", percentage: 36, date: "2026-04-01T00:00:00.000Z" },
  { id: "snapshot_34", communityId: "united-states", scope: "national", issue: "Healthcare access", percentage: 20, date: "2026-04-01T00:00:00.000Z" },
  { id: "snapshot_35", communityId: "united-states", scope: "national", issue: "Government transparency", percentage: 22, date: "2026-04-01T00:00:00.000Z" },
  { id: "snapshot_36", communityId: "united-states", scope: "national", issue: "Housing affordability", percentage: 24, date: "2026-04-01T00:00:00.000Z" },
];

export function getIssueTrendData(communityId: string, scope: VoteQuestionScope, window: "7d" | "30d" = "7d") {
  const relevant = mockIssueSnapshots
    .filter((snapshot) => snapshot.communityId === communityId && snapshot.scope === scope)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));

  const latestDate = relevant.at(-1)?.date;

  if (!latestDate) {
    return [];
  }

  const previousDate = window === "7d" ? relevant.at(-5)?.date ?? relevant.at(-2)?.date : relevant.at(0)?.date;

  if (!previousDate) {
    return [];
  }

  const latestSnapshots = relevant.filter((snapshot) => snapshot.date === latestDate);
  const previousSnapshots = relevant.filter((snapshot) => snapshot.date === previousDate);
  const issueNames = [...new Set(relevant.map((snapshot) => snapshot.issue))];

  const trends: IssueTrendSummary[] = issueNames.map((issue) => {
    const currentPercentage = latestSnapshots.find((snapshot) => snapshot.issue === issue)?.percentage ?? 0;
    const previousPercentage = previousSnapshots.find((snapshot) => snapshot.issue === issue)?.percentage ?? 0;
    const change = currentPercentage - previousPercentage;
    const direction = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const snapshots = relevant.filter((snapshot) => snapshot.issue === issue).map((snapshot) => snapshot.percentage);

    return {
      issue,
      currentPercentage,
      previousPercentage,
      change,
      direction,
      snapshots,
    };
  });

  return trends
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 6);
}
