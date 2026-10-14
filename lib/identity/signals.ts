export const MINIMUM_COHORT_SIZE = 10;
export const SIGNAL_POLICY_VERSION = "signal-segmentation-v1";

export type ParticipationSignal = {
  id: string;
  answer: "yes" | "no" | "skip";
  verificationClass: "verified_resident" | "verified_voter";
  cohortIds?: string[];
  weight?: number;
};

export function summarizeSignals(signals: ParticipationSignal[]) {
  const verified = signals.filter((signal) => signal.verificationClass === "verified_resident" || signal.verificationClass === "verified_voter");
  const residents = verified.filter((signal) => signal.verificationClass === "verified_resident");
  const voters = verified.filter((signal) => signal.verificationClass === "verified_voter");
  return {
    policyVersion: SIGNAL_POLICY_VERSION,
    hiddenWeighting: false,
    minimumCohortSize: MINIMUM_COHORT_SIZE,
    allVerified: summarizeCohort(verified),
    verifiedResidents: summarizeCohort(residents),
    verifiedVoters: summarizeCohort(voters),
  };
}

function summarizeCohort(signals: ParticipationSignal[]) {
  if (signals.length < MINIMUM_COHORT_SIZE) {
    return {
      suppressed: true,
      reason: "minimum_cohort_size",
      minimumCohortSize: MINIMUM_COHORT_SIZE,
    };
  }
  const yes = signals.filter((signal) => signal.answer === "yes").length;
  const no = signals.filter((signal) => signal.answer === "no").length;
  const skip = signals.filter((signal) => signal.answer === "skip").length;
  return {
    suppressed: false,
    count: signals.length,
    yes,
    no,
    skip,
    supportPercent: Math.round((yes / Math.max(1, yes + no)) * 100),
    voteWeight: 1,
  };
}
