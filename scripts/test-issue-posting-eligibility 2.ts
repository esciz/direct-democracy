import assert from "node:assert/strict";

import { getActiveVerificationScope, resolveVerificationCommunityIds } from "@/lib/identity/claim-jurisdiction";
import { canPostToIssueScope, canSubmitIssueVoice } from "@/lib/issues/posting-eligibility";
import type { AuthUser } from "@/types/domain";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "test-user",
    email: "resident@example.com",
    name: "Test Resident",
    username: "test-resident",
    bio: null,
    role: "citizen",
    verificationState: "voterVerified",
    jurisdictionName: "Carson City, Nevada",
    primaryCommunityId: "carson-city",
    followerCount: 0,
    isVerifiedVoter: true,
    isAnonymousPublic: true,
    verifiedJurisdictionIds: ["nevada"],
    verifiedCommunityIds: ["carson-city"],
    ...overrides,
  };
}

const carsonResident = user();
assert.equal(canSubmitIssueVoice(carsonResident), true);
assert.equal(canPostToIssueScope(carsonResident, { scope: "local", jurisdictionName: "Across the platform" }), true);
assert.equal(canPostToIssueScope(carsonResident, { scope: "local", jurisdictionName: "Carson City" }), true);
assert.equal(canPostToIssueScope(carsonResident, { scope: "local", jurisdictionName: "Carson City County, Nevada" }), true);
assert.equal(canPostToIssueScope(carsonResident, { scope: "local", jurisdictionName: "Reno, Nevada" }), false);
assert.equal(canPostToIssueScope(carsonResident, { scope: "state", jurisdictionName: "Nevada" }), true);
assert.equal(canPostToIssueScope(carsonResident, { scope: "national", jurisdictionName: "United States" }), true);

const unverifiedProfileOnly = user({
  verificationState: "unverified",
  isVerifiedVoter: false,
  verifiedJurisdictionIds: [],
  verifiedCommunityIds: [],
});
assert.equal(canSubmitIssueVoice(unverifiedProfileOnly), false);
assert.equal(canPostToIssueScope(unverifiedProfileOnly, { scope: "local", jurisdictionName: "Carson City" }), false);

const verifiedScope = getActiveVerificationScope([
  {
    claimType: "voter",
    status: "matched",
    jurisdictionIds: ["nevada"],
    communityIds: ["carson-city"],
    expiresAt: "2027-07-01T00:00:00.000Z",
  },
]);
assert.equal(verifiedScope.hasActiveVoterClaim, true);
assert.equal(verifiedScope.primaryCommunity?.id, "carson-city");
assert.deepEqual(resolveVerificationCommunityIds(["Carson City"]), ["carson-city"]);

console.log("Issue posting eligibility checks passed.");
