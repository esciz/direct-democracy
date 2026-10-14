import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserProfileContentSummary } from "@/types/domain";

type ProfileDatabase = Pick<PrismaClient, "identityAccount" | "user" | "userProfileContent" | "$transaction">;

export function createDurableProfileContentService(database: ProfileDatabase = prisma) {
  async function resolveUserId(profileUserId: string) {
    if (profileUserId.startsWith("identity_")) {
      const account = await database.identityAccount.findUnique({ where: { id: profileUserId }, select: { userId: true } });
      // Migrated identity accounts can authenticate without a public User record.
      // Missing optional profile content must not prevent login or MFA rendering.
      return account?.userId ?? null;
    }
    return (await database.user.findUnique({ where: { id: profileUserId }, select: { id: true } }))?.id ?? null;
  }

  async function read(profileUserId: string) {
    const userId = await resolveUserId(profileUserId);
    if (!userId) return null;
    return database.user.findUnique({ where: { id: userId }, select: {
      avatarUrl: true,
      profileContent: { select: {
        profileImageUrl: true, bannerImageUrl: true, profileTheme: true,
        primaryCommunityId: true, localIssues: true, stateIssues: true, nationalIssues: true,
      } },
    } });
  }

  async function write(profileUserId: string, content: Omit<UserProfileContentSummary, "userId">) {
    const userId = await resolveUserId(profileUserId);
    if (!userId && profileUserId.startsWith("identity_")) throw new Error("profile_account_not_found");
    // Demo seed profiles can continue to use their isolated browser state.
    if (!userId) return false;
    const preferences = {
      profileImageUrl: content.profileImageUrl || null,
      bannerImageUrl: content.bannerImageUrl || null,
      profileTheme: content.profileTheme ?? "classic",
      primaryCommunityId: content.primaryCommunityId || null,
      localIssues: content.localIssues.map(entry => entry.value),
      stateIssues: content.stateIssues.map(entry => entry.value),
      nationalIssues: content.nationalIssues.map(entry => entry.value),
    };
    await database.$transaction([
      database.user.update({ where: { id: userId }, data: { avatarUrl: content.profileImageUrl || null } }),
      database.userProfileContent.upsert({ where: { userId },
        create: {
          userId, ...preferences,
          groupTags: content.groupTags.map(entry => entry.value),
          profession: content.background.profession || null,
          experience: content.background.experience || null,
          professionPublic: content.background.professionPublic,
          experiencePublic: content.background.experiencePublic,
          recentVotesPublic: content.recentVotesPublic,
          bookmarkedScopes: content.bookmarkedScopes,
        },
        update: preferences,
      }),
    ]);
    return true;
  }
  return { read, write };
}

export const durableProfileContent = createDurableProfileContentService();
