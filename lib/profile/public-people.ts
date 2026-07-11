import { prisma } from "@/lib/prisma";
import type { AuthUser, PublicCitizenDirectorySummary, UserRole } from "@/types/domain";

type PublicDirectoryRole = Extract<UserRole, "citizen" | "trustedCitizen">;

function isPublicDirectoryRole(role: string): role is PublicDirectoryRole {
  return role === "citizen" || role === "trustedCitizen";
}

function isOperatorOrSmokeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith("@directdemocracy.local") || normalized.endsWith("@example.com") || normalized.includes("smoke");
}

function inferTopIssuesFromText(input: { bio: string | null; jurisdictionName: string }) {
  const text = `${input.bio ?? ""} ${input.jurisdictionName}`.toLowerCase();
  const issues = [
    ["school", "Education"],
    ["teacher", "Education"],
    ["housing", "Housing"],
    ["growth", "Growth"],
    ["water", "Water"],
    ["transit", "Transportation"],
    ["wildfire", "Public safety"],
    ["campaign finance", "Campaign finance"],
    ["budget", "Budgets"],
    ["meeting", "Public meetings"],
    ["healthcare", "Healthcare"],
    ["energy", "Energy"],
  ] as const;

  return issues
    .filter(([needle]) => text.includes(needle))
    .map(([, label]) => label)
    .filter((label, index, values) => values.indexOf(label) === index)
    .slice(0, 3);
}

function credibilityLabel(input: { role: PublicDirectoryRole; isVerifiedVoter: boolean }) {
  if (input.role === "trustedCitizen") return "High";
  if (input.isVerifiedVoter) return "Verified";
  return "Still forming";
}

function credibilitySummary(input: { role: PublicDirectoryRole; isVerifiedVoter: boolean }) {
  if (input.role === "trustedCitizen") {
    return "This person has enough verified civic support to appear as a trusted public voice.";
  }

  if (input.isVerifiedVoter) {
    return "This public profile belongs to a verified voter.";
  }

  return "This public profile is still building a civic record.";
}

export async function getDurablePublicPeopleDirectory(viewer: Pick<AuthUser, "id">): Promise<PublicCitizenDirectorySummary[]> {
  const accounts = await prisma.identityAccount.findMany({
    where: {
      status: "active",
      disabledAt: null,
      userId: { not: null },
    },
    select: {
      userId: true,
      email: true,
    },
  });
  const accountByUserId = new Map(accounts.flatMap((account) => (account.userId ? [[account.userId, account]] : [])));
  const users = await prisma.user.findMany({
    where: {
      role: { in: ["citizen", "trustedCitizen"] },
      isAnonymousPublic: false,
    },
    include: {
      jurisdiction: { select: { name: true } },
    },
    orderBy: [{ followerCount: "desc" }, { name: "asc" }],
    take: 200,
  });
  const publicUsers = users.filter((user) => {
    if (!isPublicDirectoryRole(user.role)) return false;
    const account = accountByUserId.get(user.id);
    if (!account) return false;
    return !isOperatorOrSmokeEmail(account.email);
  });
  const followStateModule = publicUsers.length ? await import("@/lib/social/follows").catch(() => null) : null;

  const summaries = await Promise.all(
    publicUsers.map(async (user) => {
      const followState = followStateModule
        ? await followStateModule.getLightweightFollowState(viewer.id, user.id, user.followerCount)
        : {
            followerCount: user.followerCount,
            viewerIsFollowing: false,
            viewerCanFollow: viewer.id !== user.id,
          };
      const role = user.role as PublicDirectoryRole;

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        role,
        bio: user.bio,
        profileImageUrl: user.avatarUrl,
        jurisdictionName: user.jurisdiction?.name ?? "Nevada",
        followerCount: followState.followerCount,
        topIssuesPreview: inferTopIssuesFromText({ bio: user.bio, jurisdictionName: user.jurisdiction?.name ?? "Nevada" }),
        civicCredibility: {
          label: credibilityLabel({ role, isVerifiedVoter: user.isVerifiedVoter }),
          summary: credibilitySummary({ role, isVerifiedVoter: user.isVerifiedVoter }),
        },
        trustSignal: {
          label: user.isVerifiedVoter ? "Verified voter" : "Registered account",
        },
        viewerIsFollowing: followState.viewerIsFollowing,
        viewerCanFollow: followState.viewerCanFollow,
      } satisfies PublicCitizenDirectorySummary;
    }),
  );

  return summaries.sort((a, b) => b.followerCount - a.followerCount || a.name.localeCompare(b.name));
}
