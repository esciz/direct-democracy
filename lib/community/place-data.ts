import { seedUsers } from "@/lib/auth/mock-users";
import { getCommunityById } from "@/lib/community/communities";
import { userContentMatchesCommunity } from "@/lib/community/membership";
import { getUserProfileContent } from "@/lib/profile/details";
import type { CommunityFavoritePlaceSummary, CommunityHeroSummary } from "@/types/domain";

export function getCommunityHero(communityId: string): CommunityHeroSummary {
  const community = getCommunityById(communityId);

  return {
    name: community?.name ?? "Community",
    descriptor: community?.descriptor ?? "A living local view of the people, places, and issues shaping everyday community life.",
    imagePath: community?.imagePath ?? "/community/carson-city.svg",
    communityType: community?.communityType ?? "geographic",
    locationLabel: community?.locationLabel ?? null,
    institutionType: community?.institutionType ?? null,
    enrollmentSize: community?.enrollmentSize ?? null,
  };
}

export async function getCommunityFavoritePlaces(communityId: string): Promise<CommunityFavoritePlaceSummary[]> {
  const placeMap = new Map<string, CommunityFavoritePlaceSummary>();

  for (const user of seedUsers) {
    const content = await getUserProfileContent(user.id);

    if (!userContentMatchesCommunity(communityId, user, content)) {
      continue;
    }

    for (const spot of content.favoriteSpots) {
      const key = `${spot.name}:${spot.category}`;
      const existing = placeMap.get(key);

      if (existing) {
        existing.popularityCount += 1;
        if (!existing.contributorNames.includes(user.name)) {
          existing.contributorNames.push(user.name);
        }
      } else {
        placeMap.set(key, {
          name: spot.name,
          type: spot.category,
          popularityCount: 1,
          contributorNames: [user.name],
        });
      }
    }
  }

  return [...placeMap.values()]
    .sort((a, b) => {
      if (b.popularityCount !== a.popularityCount) {
        return b.popularityCount - a.popularityCount;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, 6);
}
