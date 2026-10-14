import type { FavoriteSpotType } from "@/types/domain";

type VisualToken = {
  icon: string;
  label: string;
  isCustom: boolean;
};

const ISSUE_ICON_MAP: Record<string, string> = {
  "Housing affordability": "🏠",
  "Education funding": "📚",
  "Public safety": "🛡️",
  Infrastructure: "🛣️",
  "Healthcare access": "🩺",
  "Taxes / cost of living": "💵",
  "Government transparency": "🔎",
  "Environment / land use": "🌿",
  "Economic development": "📈",
};

const ISSUE_KEYWORD_MAP: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ["housing", "rent", "zoning", "development"], icon: "🏠" },
  { keywords: ["teacher", "school", "classroom", "education", "student", "literacy"], icon: "📚" },
  { keywords: ["road", "roads", "transit", "infrastructure", "traffic", "street"], icon: "🛣️" },
  { keywords: ["safety", "sheriff", "crime", "emergency", "wildfire"], icon: "🛡️" },
  { keywords: ["water", "environment", "land", "flood", "conservation", "parks"], icon: "🌿" },
  { keywords: ["budget", "finance", "transparency", "meeting", "disclosure", "records"], icon: "🔎" },
  { keywords: ["health", "healthcare", "mental"], icon: "🩺" },
  { keywords: ["tax", "cost of living", "prices"], icon: "💵" },
  { keywords: ["jobs", "business", "economy", "small business", "tourism"], icon: "📈" },
];

const TAG_ICON_MAP: Record<string, string> = {
  "Small Business": "🏪",
  Parent: "👨‍👩‍👧",
  Veteran: "🎖️",
  Educator: "🧑‍🏫",
  "Healthcare Worker": "🩺",
  "Outdoor Enthusiast": "🥾",
  Student: "🎓",
  Investor: "📊",
  Retired: "🌤️",
  Volunteer: "🤝",
};

const TAG_KEYWORD_MAP: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ["housing", "neighborhood", "downtown"], icon: "🏘️" },
  { keywords: ["budget", "finance", "watch"], icon: "📒" },
  { keywords: ["education", "teacher", "coach"], icon: "🧑‍🏫" },
  { keywords: ["transit"], icon: "🚌" },
  { keywords: ["civic", "government", "moderation"], icon: "🏛️" },
  { keywords: ["outdoor", "trail", "hike"], icon: "🥾" },
  { keywords: ["emergency"], icon: "🚨" },
  { keywords: ["growth"], icon: "📈" },
];

const PLACE_ICON_MAP: Record<FavoriteSpotType | "activity", string> = {
  restaurant: "🍽️",
  bar: "🍸",
  coffeeShop: "☕",
  park: "🌳",
  hikeOutdoor: "🥾",
  museumCulture: "🏛️",
  activityEntertainment: "🎟️",
  activity: "✨",
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function findByKeywords(value: string, definitions: Array<{ keywords: string[]; icon: string }>) {
  const normalized = normalize(value);
  return definitions.find((definition) => definition.keywords.some((keyword) => normalized.includes(keyword)))?.icon ?? null;
}

export function getIssueVisualToken(value: string): VisualToken {
  const direct = ISSUE_ICON_MAP[value];
  const inferred = findByKeywords(value, ISSUE_KEYWORD_MAP);

  return {
    icon: direct ?? inferred ?? "🗳️",
    label: value,
    isCustom: !direct,
  };
}

export function getTagVisualToken(value: string): VisualToken {
  const direct = TAG_ICON_MAP[value];
  const inferred = findByKeywords(value, TAG_KEYWORD_MAP);

  return {
    icon: direct ?? inferred ?? "🏷️",
    label: value,
    isCustom: !direct,
  };
}

export function getPlaceVisualToken(value: FavoriteSpotType | "activity", label: string): VisualToken {
  return {
    icon: PLACE_ICON_MAP[value] ?? "📍",
    label,
    isCustom: false,
  };
}

export function getMatchStatusVisual(score: -1 | 0 | 1) {
  if (score === 1) {
    return { icon: "✓", label: "Aligned" };
  }

  if (score === -1) {
    return { icon: "✕", label: "Different" };
  }

  return { icon: "•", label: "Unknown" };
}
