"use server";

import { redirect } from "next/navigation";

import { createAutomatedVoterFileMatchClaim, requestGuidedVoterPortalReview, requestResidencyManualReview } from "@/lib/identity/verification";
import { buildVoterVerificationAssistantPacket } from "@/lib/identity/voter-verification-assistant";
import { matchVoterFileRecord } from "@/lib/identity/voter-file-provider";
import { getCurrentSessionUser } from "@/lib/server/auth-session";

function formString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function requestResidencyVerificationAction(formData: FormData) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/auth");

  const attestationAccepted = formData.get("attestationAccepted") === "on";
  const residencyArea = formString(formData, "residencyArea");
  const communityId = formString(formData, "communityId");
  const evidenceDescription = formString(formData, "evidenceDescription");

  if (!attestationAccepted || residencyArea.length < 2) {
    redirect("/account/verification?status=residency-missing#residency-review");
  }

  requestResidencyManualReview({
    userId: user.id,
    jurisdictionIds: ["nevada"],
    communityIds: communityId ? [communityId] : [],
    residencyArea,
    evidenceDescription,
    attestationAccepted,
  });

  redirect("/account/verification?status=residency-submitted#claim-history");
}

export async function requestGuidedVoterPortalVerificationAction(formData: FormData) {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/auth");

  const attestationAccepted = formData.get("attestationAccepted") === "on";
  const countyOrJurisdiction = formString(formData, "countyOrJurisdiction");
  const countyVoterId = formString(formData, "countyVoterId");
  const electionPrecinct = formString(formData, "electionPrecinct");
  const registeredFirstName = formString(formData, "registeredFirstName");
  const registeredLastName = formString(formData, "registeredLastName");
  const portalResultSummary = formString(formData, "portalResultSummary");

  if (!attestationAccepted || countyOrJurisdiction.length < 2 || countyVoterId.length < 3 || electionPrecinct.length < 1 || registeredFirstName.length < 1 || registeredLastName.length < 1 || portalResultSummary.length < 4) {
    redirect("/account/verification?status=voter-missing#voter-review");
  }

  const fileMatch = matchVoterFileRecord({
    countyOrJurisdiction,
    countyVoterId,
    electionPrecinct,
    registeredFirstName,
    registeredLastName,
  });

  if (fileMatch.matched) {
    createAutomatedVoterFileMatchClaim({
      userId: user.id,
      jurisdictionIds: ["nevada"],
      countyOrJurisdiction,
      countyVoterId,
      electionPrecinct,
      registeredFirstName,
      registeredLastName,
      providerId: fileMatch.providerId,
      sourceHash: fileMatch.sourceHash,
      dateOfRecord: fileMatch.dateOfRecord,
    });
    redirect("/account/verification?status=voter-auto-matched#claim-history");
  }

  requestGuidedVoterPortalReview({
    userId: user.id,
    jurisdictionIds: ["nevada"],
    countyOrJurisdiction,
    countyVoterId,
    electionPrecinct,
    registeredFirstName,
    registeredLastName,
    portalResultSummary,
    attestationAccepted,
    assistantPacket: buildVoterVerificationAssistantPacket({
      countyOrJurisdiction,
      countyVoterId,
      electionPrecinct,
      registeredFirstName,
      registeredLastName,
      portalResultSummary,
      fileMatchMatched: false,
    }),
  });

  redirect("/account/verification?status=voter-submitted#claim-history");
}
