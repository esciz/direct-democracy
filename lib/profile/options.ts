import { getCanonicalIssueTitles } from "@/lib/issues/utils";
import type { FavoriteSpotType, ProfileTagCategory, VoteQuestionScope } from "@/types/domain";

export const FAVORITE_SPOT_CATEGORY_OPTIONS: Array<{ value: FavoriteSpotType; label: string }> = [
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar" },
  { value: "coffeeShop", label: "Coffee Shop" },
  { value: "park", label: "Park" },
  { value: "hikeOutdoor", label: "Hike / Outdoor" },
  { value: "museumCulture", label: "Museum / Culture" },
  { value: "activityEntertainment", label: "Activity / Entertainment" },
];

const CANONICAL_ISSUE_OPTIONS = getCanonicalIssueTitles();

export const PREDEFINED_ISSUE_OPTIONS: Record<VoteQuestionScope, string[]> = {
  local: [...CANONICAL_ISSUE_OPTIONS],
  state: [...CANONICAL_ISSUE_OPTIONS],
  national: [...CANONICAL_ISSUE_OPTIONS],
};

export const PREDEFINED_GROUP_TAG_OPTIONS = [
  "Small Business",
  "Parent",
  "Veteran",
  "Educator",
  "Healthcare Worker",
  "Outdoor Enthusiast",
  "Student",
  "Investor",
  "Retired",
  "Volunteer",
] as const;

export const FAVORITE_CLASS_OPTIONS = [
  "Political Science",
  "Economics",
  "Journalism",
  "Environmental Science",
  "Computer Science",
  "Public Policy",
  "Biology",
  "History",
  "Psychology",
  "Engineering",
] as const;

export const PROFILE_TAG_CATEGORY_OPTIONS: Array<{ value: ProfileTagCategory; label: string }> = [
  { value: "religion", label: "Religion" },
  { value: "sexualOrientation", label: "Sexual orientation" },
  { value: "genderIdentity", label: "Gender identity" },
  { value: "profession", label: "Profession" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "interests", label: "Interests" },
  { value: "community", label: "Community" },
];

export const PREDEFINED_PROFILE_TAG_OPTIONS: Record<ProfileTagCategory, readonly string[]> = {
  religion: ["Christian", "Jewish", "Muslim", "Hindu", "Buddhist", "Secular"],
  sexualOrientation: ["Straight", "Gay", "Lesbian", "Bisexual", "Asexual", "Queer"],
  genderIdentity: ["Woman", "Man", "Nonbinary", "Transgender", "Agender"],
  profession: ["Teacher", "Business owner", "Healthcare worker", "Engineer", "Public servant", "Student"],
  lifestyle: ["Parent", "Volunteer", "Outdoor enthusiast", "Small business supporter", "Remote worker", "Caregiver"],
  interests: ["Education", "Housing", "Public transit", "Local arts", "Environment", "Civic tech"],
  community: ["Neighborhood association", "Faith community", "PTA", "Veterans community", "Professional network", "Mutual aid"],
};

export function getFavoriteSpotCategoryLabel(category: FavoriteSpotType) {
  return FAVORITE_SPOT_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

export function getStructuredValueLabel(value: string) {
  return value.trim();
}

export function getProfileTagCategoryLabel(category: ProfileTagCategory) {
  return PROFILE_TAG_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}
