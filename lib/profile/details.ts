import { cookies } from "next/headers";

import { seedUsers } from "@/lib/auth/mock-users";
import { getPublicEndorsementsForUser } from "@/lib/candidates/endorsements";
import { getCommunityById, getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
import { userContentMatchesCommunity } from "@/lib/community/membership";
import { getCommunityGroupsForUser } from "@/lib/community/groups";
import { getAllComments } from "@/lib/feed/comments";
import { getFeedPosts } from "@/lib/feed/posts";
import { getStoredVoteResponses } from "@/lib/feed/quick-votes";
import { getCanonicalIssueTextOrNull } from "@/lib/issues/utils";
import { mockVoteQuestions, mockVoteResponses } from "@/lib/mock-data";
import { isExternalLinkSummary, normalizeExternalLinks } from "@/lib/profile/external-links";
import { getUserReputationSignals } from "@/lib/profile/reputation";
import { getVisibilityOverrides } from "@/lib/profile/visibility";
import { FAVORITE_SPOT_CATEGORY_OPTIONS } from "@/lib/profile/options";
import { getFollowState } from "@/lib/social/follows";
import { getAllCreditBoosts, getCreditBalance } from "@/lib/engagement/credits";
import { getStudentModeState } from "@/lib/server/auth-verification";
import type {
  AuthUser,
  FavoriteSpotSummary,
  ProfileBackgroundSummary,
  ProfileTagSummary,
  PublicCitizenProfileSummary,
  RecentVoteSummary,
  StructuredProfileValueSummary,
  TopVoiceSummary,
  UserProfileContentSummary,
  VoteQuestionCategory,
  VoteQuestionScope,
  VoteResponseSummary,
} from "@/types/domain";

const USER_PROFILE_CONTENT_COOKIE = "dd_user_profile_content";

function entry(value: string, isCustom = false): StructuredProfileValueSummary {
  return { value, isCustom };
}

function tagEntry(
  category: ProfileTagSummary["category"],
  value: string,
  isPublic = false,
  isCustom = false,
): ProfileTagSummary {
  return { category, value, isPublic, isCustom };
}

function emptyBackground(): ProfileBackgroundSummary {
  return {
    profession: "",
    experience: "",
    professionPublic: false,
    experiencePublic: false,
    politicalAffiliation: "",
    politicalAffiliationPublic: false,
  };
}

function defaultProfileImageUrl(userId: string) {
  if (userId.includes("marco")) {
    return "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80";
  }

  if (userId.includes("hannah")) {
    return "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80";
  }

  if (userId.includes("alicia")) {
    return "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80";
  }

  if (userId.includes("miles")) {
    return "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80";
  }

  if (userId.includes("tiana")) {
    return "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80";
  }

  return "";
}

function defaultBannerImageUrl(userId: string) {
  if (userId.includes("carson") || userId.includes("owen") || userId.includes("marco") || userId.includes("elena")) {
    return "/community/cc.webp";
  }

  if (userId.includes("reno") || userId.includes("hannah") || userId.includes("miles") || userId.includes("tiana")) {
    return "/community/nevada.svg";
  }

  return "/community/united-states.svg";
}

const seededUserProfileContent: UserProfileContentSummary[] = [
  {
    userId: "user_citizen_alicia_hart",
    profileImageUrl: defaultProfileImageUrl("user_citizen_alicia_hart"),
    bannerImageUrl: defaultBannerImageUrl("user_citizen_alicia_hart"),
    primaryCommunityId: "carson-city",
    localIssues: [entry("Teacher retention", true), entry("Downtown growth", true), entry("Water planning", true)],
    stateIssues: [entry("Education funding"), entry("Campaign transparency", true), entry("Housing affordability")],
    nationalIssues: [entry("Housing costs", true), entry("Congressional stock trading", true), entry("Public trust in news", true)],
    favoriteSpots: [
      { id: "spot_alicia_1", name: "Sassafras Eclectic Food Joint", category: "restaurant", createdAt: "2026-03-01T08:00:00.000Z" },
      { id: "spot_alicia_2", name: "Kings Canyon Trail", category: "hikeOutdoor", createdAt: "2026-03-01T08:05:00.000Z" },
      { id: "spot_alicia_3", name: "Brewery Arts Center", category: "museumCulture", createdAt: "2026-03-01T08:10:00.000Z" },
    ],
    favoriteClasses: [],
    groupTags: [entry("Parent"), entry("Educator"), entry("Downtown", true)],
    background: {
      profession: "Teacher",
      experience: "Works with local students and families and follows school funding closely.",
      professionPublic: true,
      experiencePublic: false,
      politicalAffiliation: "",
      politicalAffiliationPublic: false,
    },
    identityTags: [tagEntry("profession", "Teacher", true), tagEntry("community", "Parent", true), tagEntry("interests", "Education")],
    externalLinks: [
      { platform: "website", url: "https://aliciahart.example.com" },
      { platform: "linkedin", url: "https://www.linkedin.com/in/alicia-hart" },
    ],
    campusCommunityIds: ["wnc-campus"],
    recentVotesPublic: false,
    bookmarkedScopes: ["local", "state"],
  },
  {
    userId: "user_citizen_miles_reed",
    profileImageUrl: defaultProfileImageUrl("user_citizen_miles_reed"),
    bannerImageUrl: defaultBannerImageUrl("user_citizen_miles_reed"),
    primaryCommunityId: "reno",
    localIssues: [entry("Transit reliability", true), entry("Wildfire readiness", true), entry("Neighborhood traffic", true)],
    stateIssues: [entry("Water resilience", true), entry("Housing affordability"), entry("Government transparency")],
    nationalIssues: [entry("Public lands", true), entry("Housing affordability"), entry("Campaign money", true)],
    favoriteSpots: [
      { id: "spot_miles_1", name: "Hub Coffee Roasters", category: "coffeeShop", createdAt: "2026-03-01T09:00:00.000Z" },
      { id: "spot_miles_2", name: "Hunter Creek Trail", category: "hikeOutdoor", createdAt: "2026-03-01T09:05:00.000Z" },
      { id: "spot_miles_3", name: "Idlewild Park", category: "park", createdAt: "2026-03-01T09:10:00.000Z" },
    ],
    favoriteClasses: [],
    groupTags: [entry("Outdoor Enthusiast"), entry("Small Business"), entry("Transit", true)],
    background: {
      profession: "Business owner",
      experience: "Runs a neighborhood service business and tracks transit reliability for staff and customers.",
      professionPublic: true,
      experiencePublic: true,
      politicalAffiliation: "",
      politicalAffiliationPublic: false,
    },
    identityTags: [tagEntry("profession", "Business owner", true), tagEntry("lifestyle", "Outdoor enthusiast", true)],
    externalLinks: [
      { platform: "website", url: "https://milesreed.example.com" },
      { platform: "instagram", url: "https://www.instagram.com/miles.reed" },
    ],
    campusCommunityIds: [],
    recentVotesPublic: true,
    bookmarkedScopes: ["local"],
  },
  {
    userId: "user_citizen_tiana_moore",
    profileImageUrl: defaultProfileImageUrl("user_citizen_tiana_moore"),
    bannerImageUrl: defaultBannerImageUrl("user_citizen_tiana_moore"),
    primaryCommunityId: "nevada",
    localIssues: [entry("Government transparency"), entry("Education funding"), entry("Public meeting access", true)],
    stateIssues: [entry("Campaign finance", true), entry("Teacher staffing", true), entry("Water planning", true)],
    nationalIssues: [entry("Taxes / cost of living"), entry("Money in politics", true), entry("National belonging", true)],
    favoriteSpots: [
      { id: "spot_tiana_1", name: "Midtown Reno", category: "bar", createdAt: "2026-03-01T10:00:00.000Z" },
      { id: "spot_tiana_2", name: "Avid Reader", category: "coffeeShop", createdAt: "2026-03-01T10:05:00.000Z" },
      { id: "spot_tiana_3", name: "Rancho San Rafael", category: "park", createdAt: "2026-03-01T10:10:00.000Z" },
    ],
    favoriteClasses: [entry("Political Science"), entry("Public Policy"), entry("Civic Media", true)],
    groupTags: [entry("Education", true), entry("Student"), entry("Civic Tech", true)],
    background: emptyBackground(),
    identityTags: [tagEntry("community", "Student", true), tagEntry("interests", "Civic tech", true, true)],
    externalLinks: [
      { platform: "x", url: "https://x.com/tianamoore" },
      { platform: "newsletter", url: "https://tianamoore.substack.com" },
    ],
    campusCommunityIds: ["unr-campus"],
    recentVotesPublic: true,
    bookmarkedScopes: ["state", "national"],
  },
  {
    userId: "user_trusted_citizen_marco_silva",
    profileImageUrl: defaultProfileImageUrl("user_trusted_citizen_marco_silva"),
    bannerImageUrl: defaultBannerImageUrl("user_trusted_citizen_marco_silva"),
    primaryCommunityId: "carson-city",
    localIssues: [entry("Budget clarity", true), entry("Meeting summaries", true), entry("School staffing", true)],
    stateIssues: [entry("Open records", true), entry("Government transparency"), entry("Water management", true)],
    nationalIssues: [entry("Housing affordability"), entry("Trust in institutions", true), entry("Public accountability", true)],
    favoriteSpots: [
      { id: "spot_marco_1", name: "Comma Coffee", category: "coffeeShop", createdAt: "2026-03-01T11:00:00.000Z" },
      { id: "spot_marco_2", name: "Nevada State Museum", category: "museumCulture", createdAt: "2026-03-01T11:05:00.000Z" },
      { id: "spot_marco_3", name: "Curry Street Café", category: "restaurant", createdAt: "2026-03-01T11:10:00.000Z" },
    ],
    favoriteClasses: [],
    groupTags: [entry("Parent"), entry("Budget Watch", true), entry("Volunteer")],
    background: {
      profession: "Budget analyst",
      experience: "Shares meeting notes and budget recaps for neighbors who want clearer local context.",
      professionPublic: true,
      experiencePublic: true,
      politicalAffiliation: "",
      politicalAffiliationPublic: false,
    },
    identityTags: [tagEntry("profession", "Budget analyst", true, true), tagEntry("community", "Parent", true), tagEntry("lifestyle", "Volunteer", true)],
    externalLinks: [
      { platform: "website", url: "https://marcosilva.example.com" },
      { platform: "youtube", url: "https://www.youtube.com/@marco-silva" },
    ],
    campusCommunityIds: [],
    recentVotesPublic: true,
    bookmarkedScopes: ["local", "state"],
  },
  {
    userId: "user_trusted_citizen_hannah_cho",
    profileImageUrl: defaultProfileImageUrl("user_trusted_citizen_hannah_cho"),
    bannerImageUrl: defaultBannerImageUrl("user_trusted_citizen_hannah_cho"),
    primaryCommunityId: "reno",
    localIssues: [entry("Growth planning", true), entry("Road safety", true), entry("Public meetings", true)],
    stateIssues: [entry("Water resilience", true), entry("Housing affordability"), entry("Transit funding", true)],
    nationalIssues: [entry("Housing affordability"), entry("Public trust", true), entry("Campaign money", true)],
    favoriteSpots: [
      { id: "spot_hannah_1", name: "Pine State Biscuits", category: "restaurant", createdAt: "2026-03-01T12:00:00.000Z" },
      { id: "spot_hannah_2", name: "Truckee River Walk", category: "park", createdAt: "2026-03-01T12:05:00.000Z" },
      { id: "spot_hannah_3", name: "Bibo Coffee", category: "coffeeShop", createdAt: "2026-03-01T12:10:00.000Z" },
    ],
    favoriteClasses: [],
    groupTags: [entry("Volunteer"), entry("Housing", true), entry("Neighborhoods", true)],
    background: {
      profession: "Urban planner",
      experience: "Works on neighborhood planning and is active in public meeting access conversations.",
      professionPublic: false,
      experiencePublic: true,
      politicalAffiliation: "",
      politicalAffiliationPublic: false,
    },
    identityTags: [tagEntry("profession", "Urban planner", false, true), tagEntry("interests", "Housing", true), tagEntry("community", "Neighborhoods", true)],
    externalLinks: [
      { platform: "linkedin", url: "https://www.linkedin.com/in/hannah-cho" },
      { platform: "instagram", url: "https://www.instagram.com/hannah.cho" },
    ],
    campusCommunityIds: ["unr-campus"],
    recentVotesPublic: true,
    bookmarkedScopes: ["local", "state"],
  },
  {
    userId: "user_candidate_sofia_bennett",
    profileImageUrl: defaultProfileImageUrl("user_candidate_sofia_bennett"),
    bannerImageUrl: defaultBannerImageUrl("user_candidate_sofia_bennett"),
    primaryCommunityId: "nevada",
    localIssues: [entry("Housing approvals", true), entry("Teacher support", true), entry("Water resilience", true)],
    stateIssues: [entry("Economic development"), entry("Government transparency"), entry("Wildfire readiness", true)],
    nationalIssues: [entry("Housing affordability"), entry("National trust", true), entry("Campaign finance", true)],
    favoriteSpots: [
      { id: "spot_sofia_1", name: "Maggie’s Peak", category: "hikeOutdoor", createdAt: "2026-03-01T13:00:00.000Z" },
      { id: "spot_sofia_2", name: "Old World Coffee Lab", category: "coffeeShop", createdAt: "2026-03-01T13:05:00.000Z" },
      { id: "spot_sofia_3", name: "Wingfield Park", category: "park", createdAt: "2026-03-01T13:10:00.000Z" },
    ],
    favoriteClasses: [],
    groupTags: [entry("Housing", true), entry("Education", true), entry("Volunteer")],
    background: emptyBackground(),
    identityTags: [],
    externalLinks: [
      { platform: "website", url: "https://campaign.example.com/sofia-bennett" },
      { platform: "facebook", url: "https://www.facebook.com/sofia-bennett" },
      { platform: "x", url: "https://x.com/sofia_bennett" },
    ],
    campusCommunityIds: [],
    recentVotesPublic: true,
    bookmarkedScopes: ["state", "national"],
  },
  {
    userId: "user_candidate_owen_castillo",
    profileImageUrl: defaultProfileImageUrl("user_candidate_owen_castillo"),
    bannerImageUrl: defaultBannerImageUrl("user_candidate_owen_castillo"),
    primaryCommunityId: "carson-city",
    localIssues: [entry("Teacher retention", true), entry("School facilities", true), entry("District budgets", true)],
    stateIssues: [entry("Education funding"), entry("Meeting access", true), entry("Youth services", true)],
    nationalIssues: [entry("Education funding"), entry("Taxes / cost of living"), entry("Belonging", true)],
    favoriteSpots: [
      { id: "spot_owen_1", name: "Shoe Tree Brewing", category: "bar", createdAt: "2026-03-01T14:00:00.000Z" },
      { id: "spot_owen_2", name: "Mills Park", category: "park", createdAt: "2026-03-01T14:05:00.000Z" },
      { id: "spot_owen_3", name: "Carson Coffee", category: "coffeeShop", createdAt: "2026-03-01T14:10:00.000Z" },
    ],
    favoriteClasses: [],
    groupTags: [entry("Parent"), entry("Educator"), entry("Coaches", true)],
    background: emptyBackground(),
    identityTags: [],
    externalLinks: [
      { platform: "website", url: "https://campaign.example.com/owen-castillo" },
      { platform: "facebook", url: "https://www.facebook.com/owen-castillo" },
    ],
    campusCommunityIds: ["wnc-campus"],
    recentVotesPublic: true,
    bookmarkedScopes: ["local", "state"],
  },
  {
    userId: "user_candidate_jasmine_kim",
    profileImageUrl: defaultProfileImageUrl("user_candidate_jasmine_kim"),
    bannerImageUrl: defaultBannerImageUrl("user_candidate_jasmine_kim"),
    primaryCommunityId: "unr-campus",
    localIssues: [entry("Late-night transit", true), entry("Campus housing", true), entry("Student budgets", true)],
    stateIssues: [entry("Education funding"), entry("Public meeting access", true), entry("Cost of living", true)],
    nationalIssues: [entry("Student debt", true), entry("Housing affordability"), entry("Public trust", true)],
    favoriteSpots: [
      { id: "spot_jasmine_1", name: "KC Plaza", category: "coffeeShop", createdAt: "2026-03-02T10:00:00.000Z" },
      { id: "spot_jasmine_2", name: "The Joe", category: "restaurant", createdAt: "2026-03-02T10:05:00.000Z" },
      { id: "spot_jasmine_3", name: "Manzanita Bowl", category: "park", createdAt: "2026-03-02T10:10:00.000Z" },
    ],
    favoriteClasses: [entry("Public Policy"), entry("Economics"), entry("Urban Planning", true)],
    groupTags: [entry("Student"), entry("Transit", true), entry("Affordability", true)],
    background: emptyBackground(),
    identityTags: [tagEntry("community", "Student", true), tagEntry("interests", "Transit", true)],
    externalLinks: [{ platform: "instagram", url: "https://www.instagram.com/jasminekim" }],
    campusCommunityIds: ["unr-campus"],
    recentVotesPublic: true,
    bookmarkedScopes: ["local", "state"],
  },
  {
    userId: "user_candidate_noah_brooks",
    profileImageUrl: defaultProfileImageUrl("user_candidate_noah_brooks"),
    bannerImageUrl: defaultBannerImageUrl("user_candidate_noah_brooks"),
    primaryCommunityId: "unr-campus",
    localIssues: [entry("Student org funding", true), entry("Campus safety", true), entry("Housing pressure", true)],
    stateIssues: [entry("Education funding"), entry("Government transparency", true), entry("Mental health access", true)],
    nationalIssues: [entry("Housing affordability"), entry("Belonging", true), entry("Public trust", true)],
    favoriteSpots: [
      { id: "spot_noah_1", name: "Knowledge Center", category: "museumCulture", createdAt: "2026-03-02T11:00:00.000Z" },
      { id: "spot_noah_2", name: "Hub Coffee", category: "coffeeShop", createdAt: "2026-03-02T11:05:00.000Z" },
      { id: "spot_noah_3", name: "Peccole Park", category: "activityEntertainment", createdAt: "2026-03-02T11:10:00.000Z" },
    ],
    favoriteClasses: [entry("Journalism"), entry("History"), entry("Student Leadership", true)],
    groupTags: [entry("Student"), entry("Campus Clubs", true), entry("Housing", true)],
    background: emptyBackground(),
    identityTags: [tagEntry("community", "Student", true), tagEntry("interests", "Housing", true)],
    externalLinks: [{ platform: "x", url: "https://x.com/noahbrooks" }],
    campusCommunityIds: ["unr-campus"],
    recentVotesPublic: true,
    bookmarkedScopes: ["local", "state"],
  },
  {
    userId: "user_official_elena_ramirez",
    profileImageUrl: defaultProfileImageUrl("user_official_elena_ramirez"),
    bannerImageUrl: defaultBannerImageUrl("user_official_elena_ramirez"),
    primaryCommunityId: "carson-city",
    localIssues: [entry("Downtown infrastructure", true), entry("Housing balance", true), entry("Budget clarity", true)],
    stateIssues: [entry("Water resilience", true), entry("Economic development"), entry("Tourism pressure", true)],
    nationalIssues: [entry("Infrastructure"), entry("Taxes / cost of living"), entry("Public trust", true)],
    favoriteSpots: [
      { id: "spot_elena_1", name: "Brewery Arts Center", category: "museumCulture", createdAt: "2026-03-01T15:00:00.000Z" },
      { id: "spot_elena_2", name: "The Fox Brewpub", category: "restaurant", createdAt: "2026-03-01T15:05:00.000Z" },
      { id: "spot_elena_3", name: "Kings Canyon Trail", category: "hikeOutdoor", createdAt: "2026-03-01T15:10:00.000Z" },
    ],
    favoriteClasses: [],
    groupTags: [entry("Volunteer"), entry("Housing", true), entry("City Government", true)],
    background: emptyBackground(),
    identityTags: [],
    externalLinks: [
      { platform: "website", url: "https://campaign.example.com/elena-ramirez" },
      { platform: "facebook", url: "https://www.facebook.com/elena.ramirez" },
    ],
    campusCommunityIds: [],
    recentVotesPublic: true,
    bookmarkedScopes: ["local", "state"],
  },
  {
    userId: "user_official_david_park",
    profileImageUrl: defaultProfileImageUrl("user_official_david_park"),
    bannerImageUrl: defaultBannerImageUrl("user_official_david_park"),
    primaryCommunityId: "reno",
    localIssues: [entry("Environment / land use"), entry("Roads", true), entry("Emergency readiness", true)],
    stateIssues: [entry("Water planning", true), entry("Wildfire response", true), entry("Infrastructure")],
    nationalIssues: [entry("Infrastructure"), entry("Public lands", true), entry("Taxes / cost of living")],
    favoriteSpots: [
      { id: "spot_david_1", name: "Galena Creek Trail", category: "hikeOutdoor", createdAt: "2026-03-01T16:00:00.000Z" },
      { id: "spot_david_2", name: "Coffeebar Reno", category: "coffeeShop", createdAt: "2026-03-01T16:05:00.000Z" },
      { id: "spot_david_3", name: "Crystal Peak Park", category: "park", createdAt: "2026-03-01T16:10:00.000Z" },
    ],
    groupTags: [entry("Volunteer"), entry("Growth", true), entry("Emergency Response", true)],
    background: emptyBackground(),
    identityTags: [],
    externalLinks: [
      { platform: "website", url: "https://campaign.example.com/david-park" },
      { platform: "linkedin", url: "https://www.linkedin.com/in/david-park" },
    ],
    campusCommunityIds: [],
    recentVotesPublic: true,
    bookmarkedScopes: ["local", "state"],
  },
  {
    userId: "user_admin_riley_morgan",
    profileImageUrl: defaultProfileImageUrl("user_admin_riley_morgan"),
    bannerImageUrl: defaultBannerImageUrl("user_admin_riley_morgan"),
    primaryCommunityId: "nevada",
    localIssues: [entry("Platform integrity", true), entry("Safer civic discourse", true), entry("Trust signals", true)],
    stateIssues: [entry("Election visibility", true), entry("Petition access", true), entry("Public clarity", true)],
    nationalIssues: [entry("Civic trust", true), entry("Transparency", true), entry("Information quality", true)],
    favoriteSpots: [
      { id: "spot_riley_1", name: "The Roost", category: "coffeeShop", createdAt: "2026-03-01T17:00:00.000Z" },
      { id: "spot_riley_2", name: "Idlewild Park", category: "park", createdAt: "2026-03-01T17:05:00.000Z" },
      { id: "spot_riley_3", name: "Great Basin Brewing", category: "bar", createdAt: "2026-03-01T17:10:00.000Z" },
    ],
    groupTags: [entry("Volunteer"), entry("Moderation", true), entry("Civic Tech", true)],
    background: emptyBackground(),
    identityTags: [],
    externalLinks: [{ platform: "website", url: "https://rileymorgan.example.com" }],
    campusCommunityIds: [],
    recentVotesPublic: false,
    bookmarkedScopes: ["local", "state", "national"],
  },
];

function isFavoriteSpot(value: unknown): value is FavoriteSpotSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const spot = value as Record<string, unknown>;

  return (
    typeof spot.name === "string" &&
    typeof spot.category === "string" &&
    FAVORITE_SPOT_CATEGORY_OPTIONS.some((option) => option.value === spot.category)
  );
}

function isStructuredProfileValue(value: unknown): value is StructuredProfileValueSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return typeof entry.value === "string" && typeof entry.isCustom === "boolean";
}

function isProfileBackground(value: unknown): value is ProfileBackgroundSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const background = value as Record<string, unknown>;
    return (
      typeof background.profession === "string" &&
      typeof background.experience === "string" &&
      typeof background.professionPublic === "boolean" &&
      typeof background.experiencePublic === "boolean" &&
      typeof background.politicalAffiliation === "string" &&
      typeof background.politicalAffiliationPublic === "boolean"
    );
}

function isProfileTag(value: unknown): value is ProfileTagSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const tag = value as Record<string, unknown>;
  return (
    typeof tag.value === "string" &&
    typeof tag.category === "string" &&
    typeof tag.isCustom === "boolean" &&
    typeof tag.isPublic === "boolean"
  );
}

function isProfileContent(value: unknown): value is UserProfileContentSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Record<string, unknown>;
  return (
    typeof profile.userId === "string" &&
    typeof profile.profileImageUrl === "string" &&
    typeof profile.bannerImageUrl === "string" &&
    typeof profile.primaryCommunityId === "string" &&
    Array.isArray(profile.localIssues) &&
    Array.isArray(profile.stateIssues) &&
    Array.isArray(profile.nationalIssues) &&
    (typeof profile.favoriteClasses === "undefined" ||
      (Array.isArray(profile.favoriteClasses) && (profile.favoriteClasses as unknown[]).every(isStructuredProfileValue))) &&
    Array.isArray(profile.groupTags) &&
    isProfileBackground(profile.background) &&
    Array.isArray(profile.identityTags) &&
    (typeof profile.externalLinks === "undefined" || Array.isArray(profile.externalLinks)) &&
    Array.isArray(profile.campusCommunityIds) &&
    typeof profile.recentVotesPublic === "boolean" &&
    Array.isArray(profile.bookmarkedScopes) &&
    Array.isArray(profile.favoriteSpots) &&
    (profile.favoriteSpots as unknown[]).every(isFavoriteSpot) &&
    (profile.localIssues as unknown[]).every(isStructuredProfileValue) &&
    (profile.stateIssues as unknown[]).every(isStructuredProfileValue) &&
    (profile.nationalIssues as unknown[]).every(isStructuredProfileValue) &&
    (profile.groupTags as unknown[]).every(isStructuredProfileValue) &&
    (profile.identityTags as unknown[]).every(isProfileTag) &&
    (typeof profile.externalLinks === "undefined" || (profile.externalLinks as unknown[]).every(isExternalLinkSummary))
  );
}

export function getStructuredValueText(entry: StructuredProfileValueSummary) {
  return entry.value.trim();
}

function canonicalizeIssueEntries(entries: StructuredProfileValueSummary[]) {
  const seen = new Set<string>();

  return entries
    .flatMap((entry) => {
      const canonical = getCanonicalIssueTextOrNull(entry.value);

      if (!canonical) {
        return [];
      }

      return [{ value: canonical, isCustom: false } satisfies StructuredProfileValueSummary];
    })
    .filter((entry) => {
      const key = entry.value.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

function canonicalizeProfileContent(content: UserProfileContentSummary): UserProfileContentSummary {
  return {
    ...content,
    localIssues: canonicalizeIssueEntries(content.localIssues),
    stateIssues: canonicalizeIssueEntries(content.stateIssues),
    nationalIssues: canonicalizeIssueEntries(content.nationalIssues),
    externalLinks: normalizeExternalLinks(content.externalLinks ?? []),
  };
}

function mergeVoteResponses(storedResponses: VoteResponseSummary[]) {
  const merged = new Map<string, VoteResponseSummary>();

  for (const response of mockVoteResponses) {
    merged.set(`${response.questionId}:${response.userId}`, response);
  }

  for (const response of storedResponses) {
    merged.set(`${response.questionId}:${response.userId}`, response);
  }

  return [...merged.values()];
}

export async function getStoredUserProfileContent() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(USER_PROFILE_CONTENT_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isProfileContent) : [];
  } catch {
    return [];
  }
}

export async function setStoredUserProfileContent(content: UserProfileContentSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(USER_PROFILE_CONTENT_COOKIE, JSON.stringify(content.slice(0, 50)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getUserProfileContent(userId: string): Promise<UserProfileContentSummary> {
  const stored = await getStoredUserProfileContent();
  const merged = new Map<string, UserProfileContentSummary>();

  for (const entry of seededUserProfileContent) {
    merged.set(entry.userId, entry);
  }

  for (const entry of stored) {
    merged.set(entry.userId, entry);
  }

  return canonicalizeProfileContent(
    merged.get(userId) ?? {
      userId,
      profileImageUrl: defaultProfileImageUrl(userId),
      bannerImageUrl: defaultBannerImageUrl(userId),
      primaryCommunityId: getDefaultCommunityForJurisdiction(seedUsers.find((entry) => entry.id === userId)?.jurisdictionName ?? "Carson City, Nevada").id,
      localIssues: [],
      stateIssues: [],
      nationalIssues: [],
      favoriteSpots: [],
      favoriteClasses: [],
      groupTags: [],
      background: emptyBackground(),
      identityTags: [],
      externalLinks: [],
      campusCommunityIds: [],
      recentVotesPublic: false,
      bookmarkedScopes: ["local"],
    },
  );
}

export async function updateUserProfileContent(
  userId: string,
  nextContent: Omit<UserProfileContentSummary, "userId">,
) {
  const stored = await getStoredUserProfileContent();
  const merged = [
    canonicalizeProfileContent({
      userId,
      ...nextContent,
    }),
    ...stored.filter((entry) => entry.userId !== userId),
  ];

  await setStoredUserProfileContent(merged);
}

function scopeMatches(scope: VoteQuestionScope, selectedScope: VoteQuestionScope) {
  if (selectedScope === "national") {
    return scope === "national";
  }

  if (selectedScope === "state") {
    return scope === "state";
  }

  return scope === "local";
}

function normalizeTopic(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !["the", "and", "for", "with", "from", "into"].includes(token));
}

function matchesIssueFocus(issueText: string, candidateIssues: string[]) {
  const issueTokens = new Set(normalizeTopic(issueText));

  if (issueTokens.size === 0) {
    return false;
  }

  return candidateIssues.some((candidateIssue) => {
    const candidateTokens = normalizeTopic(candidateIssue);
    const overlap = candidateTokens.filter((token) => issueTokens.has(token));
    return overlap.length > 0;
  });
}

function rotateVoiceWindow<T>(voices: T[], seed: string) {
  if (voices.length <= 2) {
    return voices;
  }

  const featuredWindow = voices.slice(0, Math.min(6, voices.length));
  const remainder = voices.slice(featuredWindow.length);
  const daySeed = new Date().toISOString().slice(0, 10);
  const offset =
    `${seed}:${daySeed}`
      .split("")
      .reduce((total, character) => total + character.charCodeAt(0), 0) % featuredWindow.length;

  return [...featuredWindow.slice(offset), ...featuredWindow.slice(0, offset), ...remainder];
}

export async function getRecentVotesForUser(userId: string, limit = 5): Promise<RecentVoteSummary[]> {
  const storedResponses = await getStoredVoteResponses();
  const responses = mergeVoteResponses(storedResponses)
    .filter((response) => response.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit);

  return responses.flatMap((response) => {
    const question = mockVoteQuestions.find((entry) => entry.id === response.questionId);

    if (!question) {
      return [];
    }

    return [
      {
        questionId: question.id,
        questionText: question.questionText,
        answer: response.answer,
        scope: question.scope,
        jurisdictionName: question.jurisdictionName,
        createdAt: response.createdAt,
      },
    ];
  });
}

export async function getPublicCitizenProfileDetail(viewer: AuthUser, userId: string): Promise<PublicCitizenProfileSummary | null> {
  const user = seedUsers.find((entry) => entry.id === userId);

  if (!user || user.role === "admin") {
    return null;
  }

  const content = await getUserProfileContent(user.id);
  const [followState, recentVotes, creditBalance, publicEndorsements] = await Promise.all([
    getFollowState(viewer.id, user.id, user.followerCount),
    getRecentVotesForUser(user.id),
    getCreditBalance(user.id),
    getPublicEndorsementsForUser(user.id),
  ]);
  const studentMode = await getStudentModeState(user.id);
  const reputation = await getUserReputationSignals(user.id, { baseFollowerCount: user.followerCount });
  const localIssueValues = content.localIssues.map(getStructuredValueText);
  const stateIssueValues = content.stateIssues.map(getStructuredValueText);
  const nationalIssueValues = content.nationalIssues.map(getStructuredValueText);
  const groupTagValues = content.groupTags.map(getStructuredValueText);
  const publicIdentityTags = content.identityTags.filter((tag) => tag.isPublic);

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    bio: user.bio,
    profileImageUrl: content.profileImageUrl || null,
    bannerImageUrl: content.bannerImageUrl || null,
    jurisdictionName: user.jurisdictionName,
    followerCount: followState.followerCount,
    followingCount: followState.followingCount,
    trustLevel: reputation.trustLevel,
    influenceLevel: reputation.influenceLevel,
    viewerIsFollowing: followState.viewerIsFollowing,
    viewerCanFollow: followState.viewerCanFollow,
    publicOpinionSummary: {
      totalVotes: recentVotes.length,
      categoryCounts: recentVotes.reduce<Record<VoteQuestionCategory, number>>(
        (counts, vote) => {
          const question = mockVoteQuestions.find((entry) => entry.id === vote.questionId);

          if (question) {
            counts[question.category] += 1;
          }

          return counts;
        },
        { civic: 0, lifestyle: 0, identity: 0 },
      ),
    },
    topIssuesByScope: {
      local: localIssueValues,
      state: stateIssueValues,
      national: nationalIssueValues,
    },
    topIssuesPreview: [...localIssueValues.slice(0, 1), ...stateIssueValues.slice(0, 1)],
    favoriteSpots: content.favoriteSpots,
    studentProfile:
      studentMode?.enabled && studentMode.verified
        ? {
            studentVerified: true,
            campusName: getCommunityById(studentMode.campusCommunityId ?? content.campusCommunityIds[0] ?? "")?.name ?? null,
            favoriteClasses: (content.favoriteClasses ?? []).map(getStructuredValueText),
          }
        : null,
    groupTags: groupTagValues,
    groupAffiliations: getCommunityGroupsForUser(user.id),
    campusCommunityIds: content.campusCommunityIds,
    background: {
      profession: content.background.professionPublic ? content.background.profession || null : null,
      experience: content.background.experiencePublic ? content.background.experience || null : null,
      politicalAffiliation: content.background.politicalAffiliationPublic ? content.background.politicalAffiliation || null : null,
    },
    publicIdentityTags,
    recentVotesPublic: content.recentVotesPublic,
    recentVotes: content.recentVotesPublic ? recentVotes : [],
    publicEndorsements,
    creditBalance,
    bookmarkedScopes: content.bookmarkedScopes,
  };
}

export async function getTopVoices(
  viewer: AuthUser,
  communityId: string,
  selectedScope: VoteQuestionScope,
  groupTag?: string,
  options?: {
    issueText?: string;
    limit?: number;
  },
) {
  const storedResponses = await getStoredVoteResponses();
  const mergedResponses = mergeVoteResponses(storedResponses);
  const [boosts, visibilityOverrides, feedPosts, comments] = await Promise.all([
    getAllCreditBoosts(),
    getVisibilityOverrides(),
    getFeedPosts("forYou", viewer.id),
    getAllComments(),
  ]);
  const visibleUsers = seedUsers.filter((user) => {
    if (user.role === "admin") {
      return false;
    }

    const isAnonymousPublic =
      user.role === "citizen" || user.role === "trustedCitizen"
        ? typeof visibilityOverrides[user.id] === "boolean"
          ? !visibilityOverrides[user.id]
          : user.isAnonymousPublic
        : user.isAnonymousPublic;

    if ((user.role === "citizen" || user.role === "trustedCitizen") && isAnonymousPublic) {
      return false;
    }

    return true;
  });

  const voices = await Promise.all(
    visibleUsers.map(async (user) => {
      const content = await getUserProfileContent(user.id);

      if (!userContentMatchesCommunity(communityId, user, content)) {
        return null;
      }

      const followState = await getFollowState(viewer.id, user.id, user.followerCount);
      const reputation = await getUserReputationSignals(user.id, {
        baseFollowerCount: user.followerCount,
        posts: feedPosts,
        comments,
      });
      const recentVoteCount = mergedResponses.filter(
        (response) =>
          response.userId === user.id &&
          scopeMatches(
            mockVoteQuestions.find((question) => question.id === response.questionId)?.scope ?? "local",
            selectedScope,
          ),
      ).length;
      const boostCount = boosts.filter((boost) => boost.targetType === "voice" && boost.targetId === user.id).length;
      const scopedIssues =
        selectedScope === "local"
          ? content.localIssues.map(getStructuredValueText)
          : selectedScope === "state"
            ? content.stateIssues.map(getStructuredValueText)
            : content.nationalIssues.map(getStructuredValueText);
      const topIssuesPreview = scopedIssues.slice(0, 2);
      const groupTagValues = content.groupTags.map(getStructuredValueText);
      const groupAffiliations = getCommunityGroupsForUser(user.id, communityId);
      const issueMatch = options?.issueText ? matchesIssueFocus(options.issueText, scopedIssues) : false;
      const influenceScore =
        reputation.trustRank * 5.5 +
        reputation.influenceRank * 1.8 +
        Math.min(recentVoteCount / 6, 1) * 0.5 +
        (issueMatch ? 0.9 : 0);
      const featuredReason = options?.issueText
        ? issueMatch
          ? `Featured on ${options.issueText} for ${reputation.trustLevel.toLowerCase()} and ${reputation.influenceLevel.toLowerCase()} community presence.`
          : `Visible in ${user.jurisdictionName} with ${reputation.trustLevel.toLowerCase()} and ${reputation.influenceLevel.toLowerCase()} signals.`
        : `Featured for ${reputation.trustLevel.toLowerCase()} and ${reputation.influenceLevel.toLowerCase()} in this community.`;

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        jurisdictionName: user.jurisdictionName,
        profileImageUrl: content.profileImageUrl || null,
        bio: user.bio,
        followerCount: followState.followerCount,
        viewerIsFollowing: followState.viewerIsFollowing,
        viewerCanFollow: followState.viewerCanFollow,
        recentVoteCount,
        topIssuesPreview,
        groupTags: groupTagValues,
        groupAffiliations,
        campusCommunityIds: content.campusCommunityIds,
        boostCount,
        badgeLabel: options?.issueText ? "Top Voice (Issue)" : "Top Voice (Local)",
        featuredReason,
        trustLevel: reputation.trustLevel,
        influenceLevel: reputation.influenceLevel,
        creditBoostedByViewer: boosts.some(
          (boost) => boost.userId === viewer.id && boost.targetType === "voice" && boost.targetId === user.id,
        ),
        _influenceScore: influenceScore,
        _issueMatch: issueMatch,
      } satisfies TopVoiceSummary & { _influenceScore: number; _issueMatch: boolean };
    }),
  );

  const baseFilteredVoices = voices.filter((voice): voice is NonNullable<typeof voice> => {
    if (!voice) {
      return false;
    }

    return groupTag ? voice.groupTags.includes(groupTag) || voice.groupAffiliations.some((group) => group.name === groupTag) : true;
  });
  const issueMatchedVoices = options?.issueText ? baseFilteredVoices.filter((voice) => voice._issueMatch) : baseFilteredVoices;
  const filteredVoices = (options?.issueText && issueMatchedVoices.length > 0 ? issueMatchedVoices : baseFilteredVoices)
    .sort((a, b) => {
      if (options?.issueText && a._issueMatch !== b._issueMatch) {
        return Number(b._issueMatch) - Number(a._issueMatch);
      }

      if (b._influenceScore !== a._influenceScore) {
        return b._influenceScore - a._influenceScore;
      }

      return b.followerCount - a.followerCount;
    });

  const rotated = rotateVoiceWindow(filteredVoices, `${communityId}:${selectedScope}:${options?.issueText ?? groupTag ?? "all"}`);

  return rotated
    .slice(0, options?.limit ?? 10)
    .map(({ _influenceScore: _score, _issueMatch: _issueMatch, ...voice }) => voice);
}

export function parseFavoriteSpots(input: string): FavoriteSpotSummary[] {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter(isFavoriteSpot).slice(0, 7) : [];
  } catch {
    return [];
  }
}

export function parseGroupTags(input: string): StructuredProfileValueSummary[] {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter(isStructuredProfileValue).slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function parseProfileTags(input: string): ProfileTagSummary[] {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter(isProfileTag).slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function parseIssueTextarea(input: string): StructuredProfileValueSummary[] {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter(isStructuredProfileValue).slice(0, 3) : [];
  } catch {
    return [];
  }
}
