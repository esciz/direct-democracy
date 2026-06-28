import { prisma } from "@/lib/prisma";
import { recordSourceBackedCivicVoteForUser } from "@/lib/feed/vote-recording";
import type { AuthUser, VoteAnswer } from "@/types/domain";

const DEMO_USER_PREFIX = "demo_participation_seed_user_";
const PUBLIC_REVIEW_STATUSES = ["approved", "verified"] as const;

function requireExplicitDemoMode() {
  if (process.env.DIRECT_DEMOCRACY_ENABLE_DEMO_PARTICIPATION !== "true") {
    throw new Error("Refusing to seed demo participation. Set DIRECT_DEMOCRACY_ENABLE_DEMO_PARTICIPATION=true to run this explicit demo-only workflow.");
  }
}

function demoUser(index: number, jurisdictionName: string, jurisdictionId: string): AuthUser & { jurisdictionId: string } {
  return {
    id: `${DEMO_USER_PREFIX}${index}`,
    email: `demo-participation-${index}@directdemocracy.local`,
    name: `Demo Participation User ${index}`,
    username: `demo_participation_${index}`,
    bio: "Explicit demo participation account. Responses are excluded from official stakeholder analytics.",
    role: "citizen",
    verificationState: "voterVerified",
    jurisdictionName,
    jurisdictionId,
    followerCount: 0,
    isVerifiedVoter: true,
    isAnonymousPublic: true,
  };
}

async function main() {
  requireExplicitDemoMode();

  const clearOnly = process.argv.includes("--clear");
  const existingDemoUsers = await prisma.user.findMany({ where: { id: { startsWith: DEMO_USER_PREFIX } }, select: { id: true } });
  await prisma.voteResponse.deleteMany({ where: { userId: { in: existingDemoUsers.map((user) => user.id) } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: DEMO_USER_PREFIX } } });

  if (clearOnly) {
    console.log(JSON.stringify({ status: "demo_participation_cleared", usersRemoved: existingDemoUsers.length }, null, 2));
    return;
  }

  const questions = await prisma.voteQuestion.findMany({
    where: {
      generatedFromRealData: true,
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
      sourceUrl: { not: null },
    },
    include: { jurisdiction: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  const answers: VoteAnswer[] = ["yes", "no", "skip", "yes", "yes", "no", "skip", "yes"];
  let responsesCreated = 0;

  for (const [index, question] of questions.entries()) {
    const user = demoUser(index + 1, question.jurisdiction.name, question.jurisdictionId);
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        bio: user.bio,
        role: "citizen",
        isVerifiedVoter: true,
        isAnonymousPublic: true,
        jurisdictionId: user.jurisdictionId,
      },
    });
    const result = await recordSourceBackedCivicVoteForUser(user, question.id, answers[index] ?? "yes", {
      provenance: "demo_seed",
      countsInAnalytics: false,
      provenanceNote: "Explicit demo participation seed. Excluded from official stakeholder analytics.",
    });
    if (result.ok) responsesCreated += 1;
  }

  console.log(JSON.stringify({
    status: "demo_participation_seeded_excluded",
    usersCreated: questions.length,
    responsesCreated,
    countsInAnalytics: false,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
