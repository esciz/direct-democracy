import { normalizeCounty, normalizeVoterText, readVoterFileIndex, type VoterFileMatchInput } from "@/lib/identity/voter-file-provider";
import type { VerificationClaim } from "@/lib/identity/types";

export type VoterVerificationAssistantPacket = NonNullable<NonNullable<VerificationClaim["reviewContext"]>["verificationAssistant"]>;

type BuildPacketInput = VoterFileMatchInput & {
  portalResultSummary: string;
  fileMatchMatched: boolean;
};

const ACTIVE_HINTS = ["active", "registered", "voting status active"];
const INACTIVE_HINTS = ["inactive", "cancelled", "canceled", "suspended"];

function hasMeaningfulValue(value: string | null | undefined, minLength = 1) {
  return normalizeVoterText(value).length >= minLength;
}

function sourceCountyIsIndexed(countyOrJurisdiction: string) {
  const index = readVoterFileIndex();
  const county = normalizeCounty(countyOrJurisdiction);
  return Boolean(index?.providers.some((provider) => normalizeCounty(provider.county) === county));
}

function summarySuggestsActive(summary: string) {
  const normalized = normalizeVoterText(summary);
  return ACTIVE_HINTS.some((hint) => normalized.includes(hint)) && !INACTIVE_HINTS.some((hint) => normalized.includes(hint));
}

function summarySuggestsInactive(summary: string) {
  const normalized = normalizeVoterText(summary);
  return INACTIVE_HINTS.some((hint) => normalized.includes(hint));
}

export function buildVoterVerificationAssistantPacket(input: BuildPacketInput): VoterVerificationAssistantPacket {
  const countyIndexed = sourceCountyIsIndexed(input.countyOrJurisdiction);
  const extractedSignals = [
    hasMeaningfulValue(input.countyOrJurisdiction, 2) ? "county_or_jurisdiction" : null,
    hasMeaningfulValue(input.countyVoterId, 3) ? "county_voter_id" : null,
    hasMeaningfulValue(input.electionPrecinct) ? "election_precinct" : null,
    hasMeaningfulValue(input.registeredFirstName) ? "registered_first_name" : null,
    hasMeaningfulValue(input.registeredLastName) ? "registered_last_name" : null,
    hasMeaningfulValue(input.portalResultSummary, 4) ? "official_lookup_summary" : null,
    summarySuggestsActive(input.portalResultSummary) ? "active_status_hint" : null,
  ].filter((signal): signal is string => Boolean(signal));
  const missingSignals = [
    !hasMeaningfulValue(input.countyOrJurisdiction, 2) ? "county_or_jurisdiction" : null,
    !hasMeaningfulValue(input.countyVoterId, 3) ? "county_voter_id" : null,
    !hasMeaningfulValue(input.electionPrecinct) ? "election_precinct" : null,
    !hasMeaningfulValue(input.registeredFirstName) ? "registered_first_name" : null,
    !hasMeaningfulValue(input.registeredLastName) ? "registered_last_name" : null,
    !hasMeaningfulValue(input.portalResultSummary, 4) ? "official_lookup_summary" : null,
  ].filter((signal): signal is string => Boolean(signal));

  if (input.fileMatchMatched) {
    return {
      version: "voter-verification-assistant-v1",
      mode: "deterministic_source_triage",
      outcome: "auto_matched_source_file",
      confidence: "high",
      recommendedAction: "auto_verified",
      sourceAvailability: "indexed_private_voter_file",
      extractedSignals,
      missingSignals,
      reviewReasons: ["Submitted fields matched an imported official voter-file record."],
      countyIndexed,
      sourceBackedDecision: true,
    };
  }

  if (missingSignals.length) {
    return {
      version: "voter-verification-assistant-v1",
      mode: "deterministic_source_triage",
      outcome: "needs_more_information",
      confidence: "low",
      recommendedAction: "request_more_information",
      sourceAvailability: countyIndexed ? "indexed_private_voter_file" : "official_portal_user_guided",
      extractedSignals,
      missingSignals,
      reviewReasons: ["The submission is missing one or more fields needed for source-backed voter verification."],
      countyIndexed,
      sourceBackedDecision: false,
    };
  }

  if (countyIndexed) {
    return {
      version: "voter-verification-assistant-v1",
      mode: "deterministic_source_triage",
      outcome: "source_mismatch_needs_review",
      confidence: "medium",
      recommendedAction: "review_source_mismatch",
      sourceAvailability: "indexed_private_voter_file",
      extractedSignals,
      missingSignals,
      reviewReasons: [
        "The county has an indexed official voter file, but the submitted county voter ID, precinct, and name did not produce an exact source match.",
        summarySuggestsInactive(input.portalResultSummary) ? "The submitted summary may indicate inactive or canceled status." : "A typo, name variation, precinct format, or stale source file may explain the mismatch.",
      ],
      countyIndexed,
      sourceBackedDecision: false,
    };
  }

  return {
    version: "voter-verification-assistant-v1",
    mode: "deterministic_source_triage",
    outcome: "source_unavailable_guided_review",
    confidence: summarySuggestsActive(input.portalResultSummary) ? "medium" : "low",
    recommendedAction: "approve_if_attestation_and_source_confirmed",
    sourceAvailability: "official_portal_user_guided",
    extractedSignals,
    missingSignals,
    reviewReasons: [
      "This county is not yet covered by an imported official voter-file provider.",
      "The assistant prepared a review packet from the user-submitted official lookup result; a reviewer must confirm before approval.",
    ],
    countyIndexed,
    sourceBackedDecision: false,
  };
}
