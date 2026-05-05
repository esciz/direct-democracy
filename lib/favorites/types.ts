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
] as const;

export type FavoriteTargetType = (typeof FAVORITE_TARGET_TYPES)[number];

export type FavoriteRecord = {
  userId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  createdAt: string;
};

export function isFavoriteTargetType(value: string): value is FavoriteTargetType {
  return FAVORITE_TARGET_TYPES.includes(value as FavoriteTargetType);
}
