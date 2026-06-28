export type VerificationMatchStatus = "strongMatch" | "possibleMatch" | "noMatch" | "sourceUnavailable";

type VoterIdentityRecord = {
  userId: string;
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  streetAddress: string;
  jurisdictionName: string;
};

const voterIdentityRecords: VoterIdentityRecord[] = [
  {
    userId: "user_citizen_alicia_hart",
    legalFirstName: "Alicia",
    legalLastName: "Hart",
    dateOfBirth: "1990-08-14",
    streetAddress: "142 Carson Street",
    jurisdictionName: "Carson City, Nevada",
  },
  {
    userId: "user_citizen_casey_rivera",
    legalFirstName: "Casey",
    legalLastName: "Rivera",
    dateOfBirth: "1997-04-21",
    streetAddress: "18 Juniper Way",
    jurisdictionName: "Nevada",
  },
  {
    userId: "user_citizen_daniel_rowe",
    legalFirstName: "Daniel",
    legalLastName: "Rowe",
    dateOfBirth: "1981-11-04",
    streetAddress: "405 Pine Crest Avenue",
    jurisdictionName: "Nevada",
  },
  {
    userId: "user_citizen_aaron_hale",
    legalFirstName: "Aaron",
    legalLastName: "Hale",
    dateOfBirth: "1978-02-18",
    streetAddress: "88 Silver Oak Drive",
    jurisdictionName: "Washoe County, Nevada",
  },
];

export const VOTER_VERIFICATION_PROVIDER_CONFIGURED = process.env.DIRECT_DEMOCRACY_VOTER_PROVIDER_ENABLED === "true";

function normalize(value: string | undefined | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function evaluateVoterVerification(input: {
  legalFirstName: string;
  legalLastName: string;
  dateOfBirth: string;
  streetAddress: string;
  jurisdictionName: string;
}) {
  if (!VOTER_VERIFICATION_PROVIDER_CONFIGURED) {
    return {
      status: "sourceUnavailable" as const,
      confidence: "none" as const,
      matchedRecord: null,
      sourceStatus: "provider_unconfigured" as const,
    };
  }

  const exact = voterIdentityRecords.find(
    (record) =>
      normalize(record.legalFirstName) === normalize(input.legalFirstName) &&
      normalize(record.legalLastName) === normalize(input.legalLastName) &&
      record.dateOfBirth === input.dateOfBirth &&
      normalize(record.streetAddress) === normalize(input.streetAddress) &&
      normalize(record.jurisdictionName) === normalize(input.jurisdictionName),
  );

  if (exact) {
    return {
      status: "strongMatch" as const,
      confidence: "high" as const,
      matchedRecord: exact,
      sourceStatus: "queried" as const,
    };
  }

  const possible = voterIdentityRecords.find(
    (record) =>
      normalize(record.legalFirstName) === normalize(input.legalFirstName) &&
      normalize(record.legalLastName) === normalize(input.legalLastName) &&
      normalize(record.jurisdictionName) === normalize(input.jurisdictionName),
  );

  if (possible) {
    return {
      status: "possibleMatch" as const,
      confidence: "medium" as const,
      matchedRecord: possible,
      sourceStatus: "queried" as const,
    };
  }

  return {
    status: "noMatch" as const,
    confidence: "none" as const,
    matchedRecord: null,
    sourceStatus: "queried" as const,
  };
}

export function getSeedVoterIdentityRecord(userId: string) {
  return voterIdentityRecords.find((record) => record.userId === userId) ?? null;
}
