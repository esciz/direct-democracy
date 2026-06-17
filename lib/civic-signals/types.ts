export type CivicSignalEntityType =
  | "Official"
  | "Candidate"
  | "Election"
  | "BallotMeasure"
  | "Bill"
  | "LegislativeVote"
  | "Issue"
  | "CourtCase"
  | "Jurisdiction";

export type CivicSignalVerificationStatus = "imported" | "pending_review" | "approved" | "rejected" | "verified";

export type NormalizedCivicSignalEntity = {
  id: string;
  name: string;
  entityType: CivicSignalEntityType;
  jurisdiction: {
    id: string;
    name: string;
    slug?: string | null;
  };
  summary: string | null;
  source_url: string | null;
  source_name: string | null;
  last_updated: string;
  confidence_score: number;
  verification_status: CivicSignalVerificationStatus;
};

export type NormalizedCivicQuestion = {
  id: string;
  questionText: string;
  questionType: string;
  entity: NormalizedCivicSignalEntity;
  source_url: string | null;
  source_name: string | null;
  last_updated: string;
  confidence_score: number;
  review_status: CivicSignalVerificationStatus;
};
