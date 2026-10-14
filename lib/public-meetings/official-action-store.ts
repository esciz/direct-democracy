import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { getOfficials } from "@/lib/officials/store";
import { getPublicMeetingAdminDashboard } from "@/lib/public-meetings/public";
import { PUBLIC_MEETING_PATHS, absolutePublicMeetingPath, namesMatch } from "@/lib/public-meetings/shared";
import type {
  OfficialActionMatchReviewStatus,
  OfficialMeetingActionRecord,
  OfficialMeetingActionType,
  PublicBodyRecord,
  PublicMeetingItemRecord,
  PublicMeetingRecord,
} from "@/lib/public-meetings/types";

export type OfficialActionReviewStatus = OfficialActionMatchReviewStatus | "pending";

export type OfficialActionReviewOverride = {
  action_id: string;
  status: OfficialActionReviewStatus;
  official_id?: string | null;
  official_name_raw?: string | null;
  notes?: string | null;
  updated_at: string;
};

export type EnrichedOfficialMeetingAction = Omit<OfficialMeetingActionRecord, "review_status"> & {
  review_status: OfficialActionReviewStatus;
  matched_official_id: string | null;
  matched_official_name: string | null;
  meeting: PublicMeetingRecord | null;
  item: PublicMeetingItemRecord | null;
  body: PublicBodyRecord | null;
  priority: number;
  priority_reason: string;
  has_conflicting_outcome: boolean;
  public_visible: boolean;
};

async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const filePath = absolutePublicMeetingPath(relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function getOfficialActionReviewOverrides() {
  return readJsonFile<OfficialActionReviewOverride[]>(PUBLIC_MEETING_PATHS.officialActionReviewOverrides, []);
}

function isVoteType(actionType: OfficialMeetingActionType) {
  return actionType === "VOTE_YES" || actionType === "VOTE_NO" || actionType === "ABSTAIN" || actionType === "ABSENT";
}

export async function getEnrichedOfficialMeetingActions(): Promise<EnrichedOfficialMeetingAction[]> {
  const [dashboard, overrides, officials] = await Promise.all([
    getPublicMeetingAdminDashboard(),
    getOfficialActionReviewOverrides(),
    getOfficials().catch(() => []),
  ]);
  const overrideById = new Map(overrides.map((override) => [override.action_id, override]));
  const meetingById = new Map(dashboard.meetings.map((meeting) => [meeting.id, meeting]));
  const itemById = new Map(dashboard.meetingItems.map((item) => [item.id, item]));
  const bodyById = new Map(dashboard.publicBodies.map((body) => [body.id, body]));
  const actionsByItemAndName = new Map<string, OfficialMeetingActionRecord[]>();
  for (const action of dashboard.officialActions) {
    const key = `${action.topic_item_id}:${action.official_name_raw.toLowerCase()}`;
    actionsByItemAndName.set(key, [...(actionsByItemAndName.get(key) ?? []), action]);
  }

  return dashboard.officialActions.map((action) => {
    const override = overrideById.get(action.id);
    const officialName = override?.official_name_raw || action.official_name_raw;
    const item = itemById.get(action.topic_item_id) ?? null;
    const meeting = meetingById.get(action.meeting_id) ?? null;
    const body = meeting ? bodyById.get(meeting.public_body_id) ?? null : null;
    const resolvedOfficialId = override?.official_id ?? action.official_id ?? null;
    const matched = resolvedOfficialId
      ? officials.find((official) => official.id === resolvedOfficialId) ?? null
      : officials.find((official) => namesMatch(official.name, officialName)) ?? null;
    const related = actionsByItemAndName.get(`${action.topic_item_id}:${action.official_name_raw.toLowerCase()}`) ?? [];
    const hasConflict = related.some((candidate) => candidate.id !== action.id && isVoteType(candidate.action_type) && candidate.action_type !== action.action_type);
    const reviewStatus = override?.status ?? action.review_status ?? (action.needs_review ? "unmatched" : "approved");
    const unmatched = !resolvedOfficialId && !matched;
    const priority =
      item?.roll_call_status === "needs_roll_call_review"
        ? 1
        : action.confidence < 0.82
          ? 2
          : reviewStatus === "suggested_match" || unmatched
            ? 3
            : hasConflict
              ? 4
              : 9;
    const priorityReason =
      priority === 1
        ? "Vote/action language with named roll call pending review"
        : priority === 2
          ? "Low-confidence official name extraction"
          : priority === 3
            ? reviewStatus === "suggested_match"
              ? "Suggested official match needs approval"
              : "Official name is unmatched"
            : priority === 4
              ? "Conflicting outcome detected"
              : "Approved/high-confidence action";

    return {
      ...action,
      official_name_raw: officialName,
      official_id: resolvedOfficialId ?? matched?.id ?? null,
      review_status: reviewStatus,
      matched_official_id: matched?.id ?? resolvedOfficialId ?? null,
      matched_official_name: matched?.name ?? (resolvedOfficialId ? "Matched official pending roster detail" : null),
      meeting,
      item,
      body,
      priority,
      priority_reason: priorityReason,
      has_conflicting_outcome: hasConflict,
      public_visible:
        reviewStatus === "approved" &&
        !unmatched &&
        !hasConflict &&
        (action.confidence >= 0.82 || (action.match_confidence ?? 0) >= 0.88),
    };
  }).sort((left, right) => {
    if (left.priority !== right.priority) return left.priority - right.priority;
    return (Date.parse(right.meeting?.meeting_date ?? "") || 0) - (Date.parse(left.meeting?.meeting_date ?? "") || 0);
  });
}

export async function getOfficialMeetingActionsForProfile(officialId: string, officialName: string) {
  const actions = await getEnrichedOfficialMeetingActions();
  return actions.filter((action) => action.public_visible && (action.matched_official_id === officialId || namesMatch(action.official_name_raw, officialName)));
}
