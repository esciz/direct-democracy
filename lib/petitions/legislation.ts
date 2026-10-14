import type { DraftLegislationSummary } from "@/types/domain";

const seededDraftLegislation: DraftLegislationSummary[] = [
  {
    id: "draft_legislation_carson_meeting_access",
    petitionId: "petition_carson_meeting_archives",
    sponsorOfficialId: "profile_elena_ramirez",
    sponsorName: "Elena Ramirez",
    jurisdictionName: "Carson City, Nevada",
    title: "Draft ordinance to require Carson City public meetings to be livestreamed and archived",
    summary:
      "A draft ordinance requiring city boards and major public meetings to provide livestream access, archived recordings, and agenda materials in one public location.",
    body:
      "This draft ordinance would require Carson City public meetings subject to the city meeting calendar to provide livestream access when practical, publish archived recordings within a fixed window after adjournment, and maintain a centralized public page for agendas, packets, and recordings. The draft also directs staff to publish an implementation plan covering vendor support, accessibility standards, and retention timelines before final consideration.",
    status: "Drafting",
    createdAt: "2026-03-28T15:30:00.000Z",
  },
];

export async function getAllDraftLegislation() {
  return seededDraftLegislation;
}

export async function getDraftLegislationById(id: string) {
  return seededDraftLegislation.find((entry) => entry.id === id) ?? null;
}

export async function getDraftLegislationByPetitionId(petitionId: string) {
  return seededDraftLegislation.find((entry) => entry.petitionId === petitionId) ?? null;
}

export async function getDraftLegislationBySponsorId(sponsorOfficialId: string) {
  return seededDraftLegislation.filter((entry) => entry.sponsorOfficialId === sponsorOfficialId);
}
