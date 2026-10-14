import type { NormalizedCivicData } from "@/lib/civic-data/types";

export function createEmptyNormalizedCivicData(): NormalizedCivicData {
  return {
    jurisdictions: [],
    offices: [],
    officials: [],
    districts: [],
    elections: [],
    candidates: [],
    electionResults: [],
    ballotInitiatives: [],
    ballotQuestions: [],
    legislativeBills: [],
    legislativeVotes: [],
    committees: [],
    meetings: [],
    agendaItems: [],
    campaignFinanceFilings: [],
    organizations: [],
    politicalAdvertisements: [],
  };
}
