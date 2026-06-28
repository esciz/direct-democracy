import { VoteAnswer as PrismaVoteAnswer } from "@prisma/client";
import type { VoteResponseProvenance } from "@prisma/client";
import type { UserRole as PrismaUserRole } from "@prisma/client";

import { canUserVote } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { updateCivicSentimentAggregate } from "@/lib/feed/quick-votes";
import type { AuthUser, VoteAnswer } from "@/types/domain";

const PUBLIC_REVIEW_STATUSES = ["approved", "verified"] as const;
const VALID_PRISMA_USER_ROLES = new Set<string>([
  "citizen",
  "trustedCitizen",
  "candidate",
  "official",
  "media",
  "moderator",
  "admin",
  "public_user",
  "verified_resident",
  "platform_admin",
  "government_admin",
  "government_staff",
  "government_observer",
]);

function prismaRoleFor(user: AuthUser): PrismaUserRole {
  return (VALID_PRISMA_USER_ROLES.has(user.role) ? user.role : "citizen") as PrismaUserRole;
}

function fallbackUsername(user: AuthUser) {
  return user.username?.trim() || user.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || user.id;
}

async function resolveJurisdictionId(user: AuthUser, fallbackJurisdictionId: string) {
  const normalized = user.jurisdictionName.trim().toLowerCase();
  const slug = normalized.replace(/,\s*nevada$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const exact = await prisma.jurisdiction.findFirst({ where: { name: { equals: user.jurisdictionName, mode: "insensitive" } } });
  if (exact) return exact.id;

  const slugMatch = slug ? await prisma.jurisdiction.findUnique({ where: { slug } }) : null;
  if (slugMatch) return slugMatch.id;

  const nevada = await prisma.jurisdiction.findUnique({ where: { slug: "nevada" } });
  return nevada?.id ?? fallbackJurisdictionId;
}

async function ensureParticipationUserRecord(user: AuthUser, fallbackJurisdictionId: string) {
  const jurisdictionId = await resolveJurisdictionId(user, fallbackJurisdictionId);
  const username = fallbackUsername(user);

  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email,
      username,
      name: user.name,
      bio: user.bio,
      role: prismaRoleFor(user),
      isVerifiedVoter: user.isVerifiedVoter,
      isAnonymousPublic: user.isAnonymousPublic,
      followerCount: user.followerCount,
      jurisdictionId,
    },
    update: {
      email: user.email,
      username,
      name: user.name,
      bio: user.bio,
      role: prismaRoleFor(user),
      isVerifiedVoter: user.isVerifiedVoter,
      isAnonymousPublic: user.isAnonymousPublic,
      followerCount: user.followerCount,
      jurisdictionId,
    },
  });
}

export async function recordSourceBackedCivicVoteForUser(
  user: AuthUser,
  questionId: string,
  answer: VoteAnswer,
  options: {
    provenance?: VoteResponseProvenance;
    countsInAnalytics?: boolean;
    provenanceNote?: string | null;
  } = {},
) {
  const provenance = options.provenance ?? "real_participant";
  const countsInAnalytics = options.countsInAnalytics ?? provenance === "real_participant";
  const question = await prisma.voteQuestion.findFirst({
    where: {
      id: questionId,
      generatedFromRealData: true,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
      sourceUrl: { not: null },
    },
    include: { responses: { where: { userId: user.id } } },
  });

  if (!question) {
    return { ok: false as const, code: "question" as const, user };
  }

  if (!canUserVote(user)) {
    return { ok: false as const, code: "verification" as const, user };
  }

  const existingResponse = question.responses[0] ?? null;
  await ensureParticipationUserRecord(user, question.jurisdictionId);

  await prisma.voteResponse.upsert({
    where: {
      userId_questionId: {
        userId: user.id,
        questionId,
      },
    },
    create: {
      userId: user.id,
      questionId,
      answer: PrismaVoteAnswer[answer],
      provenance,
      countsInAnalytics,
      provenanceNote: options.provenanceNote,
    },
    update: {
      answer: PrismaVoteAnswer[answer],
      provenance,
      countsInAnalytics,
      provenanceNote: options.provenanceNote,
    },
  });

  await updateCivicSentimentAggregate(questionId);

  return {
    ok: true as const,
    user,
    previousAnswer: existingResponse?.answer ?? null,
    replacedExistingVote: Boolean(existingResponse),
  };
}
