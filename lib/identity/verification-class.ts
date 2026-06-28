import { readIdentityStore } from "@/lib/identity/storage";

export type VerificationClassSubject = {
  id: string;
  role: string;
  isVerifiedVoter: boolean;
};

export type PublicVerificationClass = "anonymous_public" | "authenticated_unverified" | "verified_resident" | "verified_voter";

export function getVerificationClassForSubject(user: VerificationClassSubject | null | undefined): PublicVerificationClass {
  if (!user) return "anonymous_public";
  if (user.isVerifiedVoter) return "verified_voter";

  const claims = readIdentityStore().verificationClaims;
  const voterClaim = claims.find(
    (claim) =>
      claim.userId === user.id &&
      claim.claimType === "voter" &&
      claim.status === "matched" &&
      (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now()),
  );
  if (voterClaim) return "verified_voter";

  const residentClaim = claims.find(
    (claim) =>
      claim.userId === user.id &&
      claim.claimType === "residency" &&
      claim.status === "verified" &&
      (!claim.expiresAt || new Date(claim.expiresAt).getTime() > Date.now()),
  );

  if (residentClaim || user.role === "verified_resident") return "verified_resident";
  return "authenticated_unverified";
}
