"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/server/auth-session";
import { getCampusCommunities, getGeographicCommunities, getDefaultCommunityForJurisdiction } from "@/lib/community/communities";
import { getCanonicalIssueTextOrNull } from "@/lib/issues/utils";
import { EXTERNAL_LINK_FIELDS, normalizeExternalLinkUrl } from "@/lib/profile/external-links";
import {
  getUserProfileContent,
  parseFavoriteSpots,
  parseGroupTags,
  parseIssueTextarea,
  parseProfileTags,
  updateUserProfileContent,
} from "@/lib/profile/details";
import { getVisibilityOverrides, setVisibilityOverrides } from "@/lib/profile/visibility";
import type { PoliticalAffiliation, VoteQuestionScope } from "@/types/domain";

const POLITICAL_AFFILIATION_VALUES: PoliticalAffiliation[] = ["Democrat", "Republican", "Independent", "Other", "Prefer not to say"];

function dedupeStructuredValues(values: ReturnType<typeof parseIssueTextarea>, limit: number) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = value.value.trim().toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).slice(0, limit);
}

function dedupeCanonicalIssueValues(values: ReturnType<typeof parseIssueTextarea>, limit: number) {
  const seen = new Set<string>();

  return values
    .flatMap((value) => {
      const canonical = getCanonicalIssueTextOrNull(value.value);

      if (!canonical) {
        return [];
      }

      return [{ value: canonical, isCustom: false }];
    })
    .filter((value) => {
      const key = value.value.trim().toLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function dedupeFavoriteSpotsByCategory(values: ReturnType<typeof parseFavoriteSpots>) {
  const byCategory = new Map<string, (typeof values)[number]>();

  for (const value of values) {
    byCategory.set(value.category, value);
  }

  return [...byCategory.values()].slice(0, 7);
}

function dedupeProfileTags(values: ReturnType<typeof parseProfileTags>) {
  const seen = new Set<string>();

  return values
    .filter((tag) => {
      const key = `${tag.category}:${tag.value.trim().toLowerCase()}`;

      if (!tag.value.trim() || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function parseExternalLinks(formData: FormData) {
  const invalidLabels: string[] = [];
  const links = EXTERNAL_LINK_FIELDS.flatMap((field) => {
    const rawValue = formData.get(field.inputName);

    if (typeof rawValue !== "string" || !rawValue.trim()) {
      return [];
    }

    const normalizedUrl = normalizeExternalLinkUrl(rawValue);

    if (!normalizedUrl) {
      invalidLabels.push(field.label);
      return [];
    }

    return [{ platform: field.platform, url: normalizedUrl }];
  });

  return { links, invalidLabels };
}

export async function togglePublicCitizenVisibility(formData: FormData) {
  const currentUser = await getCurrentUser();
  const nextVisible = formData.get("nextVisible");

  if (typeof nextVisible !== "string") {
    redirect("/profile");
  }

  const overrides = await getVisibilityOverrides();
  overrides[currentUser.id] = nextVisible === "true";
  await setVisibilityOverrides(overrides);

  redirect("/profile?visibility=updated");
}

export async function updateProfileDetails(formData: FormData) {
  const currentUser = await getCurrentUser();
  const localIssues = formData.get("localIssues");
  const stateIssues = formData.get("stateIssues");
  const nationalIssues = formData.get("nationalIssues");
  const favoriteSpots = formData.get("favoriteSpots");
  const groupTags = formData.get("groupTags");
  const favoriteClasses = formData.get("favoriteClasses");
  const identityTags = formData.get("identityTags");
  const currentContent = await getUserProfileContent(currentUser.id);
  const parsedLocalIssues = typeof localIssues === "string" ? dedupeCanonicalIssueValues(parseIssueTextarea(localIssues), 3) : currentContent.localIssues;
  const parsedStateIssues = typeof stateIssues === "string" ? dedupeCanonicalIssueValues(parseIssueTextarea(stateIssues), 3) : currentContent.stateIssues;
  const parsedNationalIssues =
    typeof nationalIssues === "string" ? dedupeCanonicalIssueValues(parseIssueTextarea(nationalIssues), 3) : currentContent.nationalIssues;
  const parsedFavoriteSpots =
    typeof favoriteSpots === "string" ? dedupeFavoriteSpotsByCategory(parseFavoriteSpots(favoriteSpots)) : currentContent.favoriteSpots;
  const parsedGroupTags = typeof groupTags === "string" ? dedupeStructuredValues(parseGroupTags(groupTags), 6) : currentContent.groupTags;
  const parsedFavoriteClasses =
    typeof favoriteClasses === "string" ? dedupeStructuredValues(parseGroupTags(favoriteClasses), 5) : currentContent.favoriteClasses ?? [];
  const parsedIdentityTags =
    typeof identityTags === "string" ? dedupeProfileTags(parseProfileTags(identityTags)) : currentContent.identityTags;
  const { links: parsedExternalLinks, invalidLabels } = parseExternalLinks(formData);
  const requestedPrimaryCommunityId =
    typeof formData.get("primaryCommunityId") === "string" ? String(formData.get("primaryCommunityId")).trim() : currentContent.primaryCommunityId;
  const requestedCampusCommunityId =
    typeof formData.get("campusCommunityId") === "string" ? String(formData.get("campusCommunityId")).trim() : "";
  const validPrimaryCommunityId =
    getGeographicCommunities().some((community) => community.id === requestedPrimaryCommunityId)
      ? requestedPrimaryCommunityId
      : currentContent.primaryCommunityId || getDefaultCommunityForJurisdiction(currentUser.jurisdictionName).id;
  const canAssociateCampusCommunity = Boolean(currentUser.studentModeEnabled && currentUser.studentVerified);
  const validCampusCommunityIds =
    canAssociateCampusCommunity && getCampusCommunities().some((community) => community.id === requestedCampusCommunityId)
      ? [requestedCampusCommunityId]
      : [];

  await updateUserProfileContent(currentUser.id, {
    profileImageUrl:
      typeof formData.get("profileImageUrl") === "string" ? String(formData.get("profileImageUrl")).trim() : currentContent.profileImageUrl,
    bannerImageUrl:
      typeof formData.get("bannerImageUrl") === "string" ? String(formData.get("bannerImageUrl")).trim() : currentContent.bannerImageUrl,
    primaryCommunityId: validPrimaryCommunityId,
    localIssues: parsedLocalIssues,
    stateIssues: parsedStateIssues,
    nationalIssues: parsedNationalIssues,
    favoriteSpots: parsedFavoriteSpots,
    favoriteClasses: parsedFavoriteClasses,
    groupTags: parsedGroupTags,
    background: {
      profession: typeof formData.get("profession") === "string" ? String(formData.get("profession")).trim() : currentContent.background.profession,
      experience: typeof formData.get("experience") === "string" ? String(formData.get("experience")).trim() : currentContent.background.experience,
      professionPublic: formData.get("professionPublic") === "on",
      experiencePublic: formData.get("experiencePublic") === "on",
      politicalAffiliation:
        typeof formData.get("politicalAffiliation") === "string" &&
        POLITICAL_AFFILIATION_VALUES.includes(String(formData.get("politicalAffiliation")).trim() as PoliticalAffiliation)
          ? (String(formData.get("politicalAffiliation")).trim() as PoliticalAffiliation)
          : "",
      politicalAffiliationPublic: formData.get("politicalAffiliationPublic") === "on",
    },
    identityTags: parsedIdentityTags,
    externalLinks: parsedExternalLinks,
    campusCommunityIds: validCampusCommunityIds,
    recentVotesPublic: formData.get("recentVotesPublic") === "on",
    bookmarkedScopes: currentContent.bookmarkedScopes,
  });

  redirect(invalidLabels.length ? "/profile?details=updated&externalLinks=invalid" : "/profile?details=updated");
}

export async function toggleBookmarkedScope(formData: FormData) {
  const currentUser = await getCurrentUser();
  const scope = formData.get("scope");
  const returnPath = formData.get("returnPath");

  if (typeof scope !== "string" || typeof returnPath !== "string") {
    redirect("/my-community");
  }

  const normalizedScope: VoteQuestionScope = scope === "state" || scope === "national" ? scope : "local";
  const currentContent = await getUserProfileContent(currentUser.id);
  const nextBookmarkedScopes = currentContent.bookmarkedScopes.includes(normalizedScope)
    ? currentContent.bookmarkedScopes.filter((entry) => entry !== normalizedScope)
    : [...currentContent.bookmarkedScopes, normalizedScope];

  await updateUserProfileContent(currentUser.id, {
    profileImageUrl: currentContent.profileImageUrl,
    bannerImageUrl: currentContent.bannerImageUrl,
    primaryCommunityId: currentContent.primaryCommunityId,
    localIssues: currentContent.localIssues,
    stateIssues: currentContent.stateIssues,
    nationalIssues: currentContent.nationalIssues,
    favoriteSpots: currentContent.favoriteSpots,
    favoriteClasses: currentContent.favoriteClasses ?? [],
    groupTags: currentContent.groupTags,
    background: currentContent.background,
    identityTags: currentContent.identityTags,
    externalLinks: currentContent.externalLinks,
    campusCommunityIds: currentContent.campusCommunityIds,
    recentVotesPublic: currentContent.recentVotesPublic,
    bookmarkedScopes: nextBookmarkedScopes,
  });

  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}community=bookmarked`);
}
