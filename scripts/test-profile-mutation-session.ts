import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import type { UserProfileContentSummary } from "../types/domain";

type ProfileAction = (formData: FormData) => Promise<never>;
type ProfileActions = Record<"togglePublicCitizenVisibility" | "updateProfileDetails" | "toggleBookmarkedScope", ProfileAction>;
type SessionUser = { id: string };

class RedirectSignal extends Error {
  constructor(readonly destination: string) { super(`redirect:${destination}`); }
}

function profile(userId: string): UserProfileContentSummary {
  return {
    userId,
    profileImageUrl: "",
    bannerImageUrl: "",
    profileTheme: "classic",
    primaryCommunityId: userId === "user_demo_a" ? "carson-city" : "reno",
    localIssues: [{ value: "Housing", isCustom: false }],
    stateIssues: [],
    nationalIssues: [],
    favoriteSpots: [],
    groupTags: [],
    background: { profession: "", experience: "", professionPublic: false, experiencePublic: false, politicalAffiliation: "", politicalAffiliationPublic: false },
    identityTags: [],
    externalLinks: [],
    recentVotesPublic: false,
    bookmarkedScopes: ["local"],
  };
}

function loadIsolatedActions() {
  const sourcePath = path.resolve("lib/profile/actions.ts");
  const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    fileName: sourcePath,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  let session: SessionUser | null = null;
  const calls: string[] = [];
  const profiles = new Map(["user_demo_a", "user_demo_b"].map((id) => [id, profile(id)]));
  const blockedModules = new Set([
    "@/lib/community/communities",
    "@/lib/prisma",
    "@/lib/issues/utils",
    "@/lib/profile/external-links",
    "@/lib/profile/media-storage",
    "@/lib/profile/visibility",
  ]);
  function forbidden(label: string): never {
    calls.push(`forbidden:${label}`);
    throw new Error(`Unexpected dependency access: ${label}`);
  }
  const stubs: Record<string, object> = {
    "next/navigation": {
      redirect(destination: string): never {
        calls.push(`redirect:${destination}`);
        throw new RedirectSignal(destination);
      },
    },
    "@/lib/server/auth-session": {
      getCurrentSessionUser: async () => { calls.push("session:read"); return session; },
      getCurrentUser: () => forbidden("guest-fallback authentication"),
    },
    "@/lib/profile/details": new Proxy({
      getUserProfileContent: async (userId: string) => {
        calls.push(`profile:read:${userId}`);
        assert.ok(session, "Profile reads require an authenticated session");
        assert.equal(userId, session.id, "Read the active profile, not an ID submitted by the browser");
        const current = profiles.get(userId);
        assert.ok(current);
        return structuredClone(current);
      },
      updateUserProfileContent: async (userId: string, content: Omit<UserProfileContentSummary, "userId">) => {
        calls.push(`profile:write:${userId}`);
        assert.ok(session, "Profile mutations require an authenticated session");
        assert.equal(userId, session.id, "Write only the current session's profile");
        profiles.set(userId, { ...structuredClone(content), userId });
      },
    }, {
      get(target, property) {
        if (property in target) return Reflect.get(target, property);
        return forbidden(`profile/details.${String(property)}`);
      },
    }),
  };
  const module = { exports: {} as ProfileActions };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require(request: string) {
      if (request in stubs) return stubs[request];
      if (blockedModules.has(request)) {
        return new Proxy({}, { get(_target, property) { return forbidden(`${request}.${String(property)}`); } });
      }
      throw new Error(`Unstubbed import: ${request}`);
    },
    URL,
  }, { filename: sourcePath });
  return {
    actions: module.exports,
    calls,
    profiles,
    selectSession(user: SessionUser | null) { session = user; calls.length = 0; },
  };
}

async function expectRedirect(action: ProfileAction, formData: FormData, destination: string) {
  await assert.rejects(action(formData), (error: unknown) => error instanceof RedirectSignal && error.destination === destination);
}

async function main() {
  const fixture = loadIsolatedActions();
  const originalProfiles = structuredClone(fixture.profiles);
  for (const actionName of ["togglePublicCitizenVisibility", "updateProfileDetails", "toggleBookmarkedScope"] as const) {
    fixture.selectSession(null);
    const unreadableForm = {
      get() { throw new Error(`${actionName} read form data before rejecting an anonymous request`); },
    } as unknown as FormData;
    await expectRedirect(fixture.actions[actionName], unreadableForm, "/auth");
    assert.deepEqual(fixture.calls, ["session:read", "redirect:/auth"], `${actionName} must stop before reads, uploads, cookies, or database mutations`);
    assert.deepEqual(fixture.profiles, originalProfiles);
  }

  async function bookmarkAs(userId: string, scope: string, returnPath = "/my-community") {
    fixture.selectSession({ id: userId });
    const form = new FormData();
    form.set("scope", scope);
    form.set("returnPath", returnPath);
    form.set("userId", userId === "user_demo_a" ? "user_demo_b" : "user_demo_a");
    await expectRedirect(fixture.actions.toggleBookmarkedScope, form, `${returnPath}${returnPath.includes("?") ? "&" : "?"}community=bookmarked`);
    assert.deepEqual(fixture.calls, ["session:read", `profile:read:${userId}`, `profile:write:${userId}`, `redirect:${returnPath}${returnPath.includes("?") ? "&" : "?"}community=bookmarked`]);
  }

  await bookmarkAs("user_demo_a", "state");
  assert.deepEqual(fixture.profiles.get("user_demo_a"), { ...originalProfiles.get("user_demo_a"), bookmarkedScopes: ["local", "state"] });
  assert.deepEqual(fixture.profiles.get("user_demo_b"), originalProfiles.get("user_demo_b"));
  await bookmarkAs("user_demo_b", "national", "/my-community?communityId=reno");
  assert.deepEqual(fixture.profiles.get("user_demo_b"), { ...originalProfiles.get("user_demo_b"), bookmarkedScopes: ["local", "national"] });
  assert.deepEqual(fixture.profiles.get("user_demo_a")?.bookmarkedScopes, ["local", "state"]);
  await bookmarkAs("user_demo_a", "state");
  assert.deepEqual(fixture.profiles.get("user_demo_a"), originalProfiles.get("user_demo_a"), "Switching back must update the original demo profile only");
  assert.deepEqual(fixture.profiles.get("user_demo_b")?.bookmarkedScopes, ["local", "national"]);
  console.log("Profile mutation session checks passed: all three anonymous actions redirect before side effects; authenticated bookmark edits stay scoped to the selected demo profile. Actual action source ran with isolated imports only.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
