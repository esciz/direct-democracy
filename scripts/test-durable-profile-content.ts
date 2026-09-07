import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { guidedOnboardingStep } from "../lib/onboarding/steps";
import type { UserProfileContentSummary } from "../types/domain";

type Preferences = {
  userId: string;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  profileTheme: string;
  primaryCommunityId: string | null;
  localIssues: string[];
  stateIssues: string[];
  nationalIssues: string[];
};
type StoredUser = { id: string; avatarUrl: string | null; profileContent: Preferences | null };
type DatabaseState = Map<string, StoredUser>;
type TransactionOperation = (state: DatabaseState) => unknown;

function isolatedDatabase() {
  let users: DatabaseState = new Map([
    ["user_account_a", { id: "user_account_a", avatarUrl: null, profileContent: null }],
    ["user_account_b", { id: "user_account_b", avatarUrl: null, profileContent: null }],
  ]);
  const accounts = new Map([
    ["identity_account_a", { userId: "user_account_a" }],
    ["identity_account_b", { userId: "user_account_b" }],
    ["identity_unlinked", { userId: null }],
  ]);
  const identityLookups: string[] = [];
  const userLookups: string[] = [];
  let transactions = 0;
  let failTransaction = false;
  const transactionFailure = new Error("fixture_database_write_failed");
  const database = {
    identityAccount: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        identityLookups.push(where.id);
        return accounts.get(where.id) ?? null;
      },
    },
    user: {
      findUnique: async ({ where, select }: { where: { id: string }; select: { id?: boolean } }) => {
        userLookups.push(where.id);
        const user = users.get(where.id);
        return !user ? null : select.id ? { id: user.id } : structuredClone(user);
      },
      update: ({ where, data }: { where: { id: string }; data: { avatarUrl: string | null } }): TransactionOperation =>
        (state) => {
          const user = state.get(where.id);
          assert.ok(user, "Updates must target an existing durable User");
          Object.assign(user, data);
          return user;
        },
    },
    userProfileContent: {
      upsert: ({ where, create, update }: { where: { userId: string }; create: Preferences; update: Partial<Preferences> }): TransactionOperation =>
        (state) => {
          if (failTransaction) throw transactionFailure;
          const user = state.get(where.userId);
          assert.ok(user, "Profile content must target the linked durable User");
          user.profileContent = user.profileContent
            ? { ...user.profileContent, ...structuredClone(update) }
            : structuredClone(create);
          return user.profileContent;
        },
    },
    // Prisma batches are lazy; only commit the copy if every operation succeeds.
    $transaction: async (operations: TransactionOperation[]) => {
      transactions++;
      const pending = structuredClone(users);
      const result = operations.map((operation) => operation(pending));
      users = pending;
      return result;
    },
  };
  return {
    database: database as unknown as PrismaClient,
    identityLookups,
    userLookups,
    transactionFailure,
    transactionCount: () => transactions,
    rejectTransactions: () => { failTransaction = true; },
    snapshot: () => structuredClone(users),
  };
}

function content(overrides: Partial<Omit<UserProfileContentSummary, "userId">> = {}): Omit<UserProfileContentSummary, "userId"> {
  return {
    profileImageUrl: "https://example.test/avatar-a.png",
    bannerImageUrl: "https://example.test/banner-a.png",
    profileTheme: "daylight",
    primaryCommunityId: "community_carson_city",
    localIssues: [{ value: "Housing", isCustom: false }],
    stateIssues: [{ value: "Education", isCustom: false }],
    nationalIssues: [{ value: "Healthcare", isCustom: false }],
    favoriteSpots: [],
    groupTags: [],
    background: { profession: "", experience: "", professionPublic: false, experiencePublic: false, politicalAffiliation: "", politicalAffiliationPublic: false },
    identityTags: [],
    externalLinks: [],
    recentVotesPublic: false,
    bookmarkedScopes: ["local"],
    ...overrides,
  };
}

async function main() {
  // Any accidental use of the singleton fails before a real client can connect.
  const previousClient = globalThis.prisma;
  globalThis.prisma = new Proxy({} as PrismaClient, {
    get() { throw new Error("Tests must only use the injected database"); },
  });
  try {
    const { createDurableProfileContentService } = await import("../lib/profile/durable-content");
    const fixture = isolatedDatabase();
    const service = createDurableProfileContentService(fixture.database);
    assert.equal(await service.write("identity_account_a", content()), true);
    assert.deepEqual(fixture.identityLookups, ["identity_account_a"]);
    assert.equal(fixture.snapshot().has("identity_account_a"), false, "Identity IDs are not User IDs");
    assert.equal(fixture.snapshot().get("user_account_a")?.profileContent?.primaryCommunityId, "community_carson_city");
    assert.equal(fixture.snapshot().get("user_account_a")?.avatarUrl, "https://example.test/avatar-a.png");

    const updated = content({
      primaryCommunityId: "community_reno",
      localIssues: [{ value: "Transportation", isCustom: false }, { value: "Water", isCustom: false }],
      stateIssues: [{ value: "Tax policy", isCustom: false }],
      nationalIssues: [{ value: "Public health", isCustom: false }],
    });
    assert.equal(await service.write("identity_account_a", updated), true);
    const freshSession = createDurableProfileContentService(fixture.database);
    const saved = await freshSession.read("identity_account_a");
    assert.equal(saved?.profileContent?.primaryCommunityId, "community_reno");
    assert.deepEqual(saved?.profileContent?.localIssues, ["Transportation", "Water"]);
    assert.deepEqual(saved?.profileContent?.stateIssues, ["Tax policy"]);
    assert.deepEqual(saved?.profileContent?.nationalIssues, ["Public health"]);
    assert.equal(saved?.profileContent?.profileTheme, "daylight");
    assert.equal(saved?.profileContent?.profileImageUrl, updated.profileImageUrl);
    assert.equal(saved?.profileContent?.bannerImageUrl, updated.bannerImageUrl);
    assert.ok(fixture.userLookups.every((id) => !id.startsWith("identity_")), "All reads use the linked User ID");
    assert.equal((await freshSession.read("identity_account_b"))?.profileContent, null, "Another account cannot inherit the first account's choices");
    assert.deepEqual(await freshSession.read("user_account_a"), saved, "Durable User IDs resolve to the same preferences");

    await freshSession.write("identity_account_a", content({ localIssues: [], stateIssues: [], nationalIssues: [] }));
    const cleared = await freshSession.read("identity_account_a");
    assert.deepEqual(cleared?.profileContent?.localIssues, []);
    assert.deepEqual(cleared?.profileContent?.stateIssues, []);
    assert.deepEqual(cleared?.profileContent?.nationalIssues, [], "Cleared interests must not revive stale values");

    const transactionsBeforeMissingUsers = fixture.transactionCount();
    for (const accountId of ["identity_missing", "identity_unlinked"]) {
      await assert.rejects(freshSession.read(accountId), /profile_account_not_found/);
      await assert.rejects(freshSession.write(accountId, content()), /profile_account_not_found/);
    }
    assert.equal(await freshSession.read("user_demo_fixture"), null);
    assert.equal(await freshSession.write("user_demo_fixture", content()), false, "Missing demo seeds can retain their isolated browser preferences");
    assert.equal(fixture.transactionCount(), transactionsBeforeMissingUsers);

    const beforeFailure = fixture.snapshot();
    fixture.rejectTransactions();
    await assert.rejects(
      freshSession.write("identity_account_a", content({ profileImageUrl: "https://example.test/unsaved.png", primaryCommunityId: "unsaved" })),
      (error: unknown) => error === fixture.transactionFailure,
      "A failed transaction must reach the caller, rather than report success",
    );
    assert.deepEqual(fixture.snapshot(), beforeFailure, "Media and preferences are committed atomically");

    assert.equal(guidedOnboardingStep(undefined, true, false), "setup");
    assert.equal(guidedOnboardingStep("account", true, false), "setup");
    for (const step of ["setup", "role-match", "finish", "verify"]) {
      assert.equal(guidedOnboardingStep(step, true, false), step, "Explicit navigation survives the real-account default");
    }
    for (const signedIn of [true, false]) {
      assert.equal(guidedOnboardingStep(undefined, signedIn, true), "account", "Demo entry preserves its account step");
      assert.equal(guidedOnboardingStep("account", signedIn, true), "account");
      assert.equal(guidedOnboardingStep("setup", signedIn, true), "setup");
    }
    assert.equal(guidedOnboardingStep(undefined, false, false), "account");
    console.log("Durable profile preferences: linked identity, fresh-session reads, repeated updates, account isolation, transaction failures, and demo onboarding steps passed using an injected database only.");
  } finally {
    globalThis.prisma = previousClient;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
