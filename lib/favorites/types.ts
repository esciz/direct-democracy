export const FAVORITE_TARGET_TYPES = [
  "community",
  "issue",
  "person",
  "candidate",
  "official",
  "petition",
  "case",
  "event",
  "election",
  "organization",
  "decision",
  "project",
] as const;

export type FavoriteTargetType = (typeof FAVORITE_TARGET_TYPES)[number];

export const ISSUE_FOLLOW_STANCES = ["tracking", "support", "concerned", "oppose"] as const;

export type IssueFollowStance = (typeof ISSUE_FOLLOW_STANCES)[number];

export type FavoriteRecord = {
  userId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
  stance?: IssueFollowStance;
};

export function isFavoriteTargetType(value: string): value is FavoriteTargetType {
  return FAVORITE_TARGET_TYPES.includes(value as FavoriteTargetType);
}

export function isIssueFollowStance(value: string): value is IssueFollowStance {
  return ISSUE_FOLLOW_STANCES.includes(value as IssueFollowStance);
}
