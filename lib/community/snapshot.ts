import type { CommunitySnapshotSummary } from "@/types/domain";

const communitySnapshots: Record<string, CommunitySnapshotSummary> = {
  "carson-city": {
    communityId: "carson-city",
    labelNote: "Registered voter breakdown (estimated or sourced data). Community Snapshot is seeded context for the demo and is not derived from platform users.",
    registeredVoterBreakdown: [
      { label: "Democrat", percentage: 34 },
      { label: "Republican", percentage: 30 },
      { label: "Nonpartisan / Independent", percentage: 31 },
      { label: "Other", percentage: 5 },
    ],
    ageDistribution: [
      { label: "18–34", percentage: 23 },
      { label: "35–54", percentage: 31 },
      { label: "55+", percentage: 46 },
    ],
    genderDistribution: [
      { label: "Male", percentage: 48 },
      { label: "Female", percentage: 50 },
      { label: "Other", percentage: 2 },
    ],
  },
  reno: {
    communityId: "reno",
    labelNote: "Registered voter breakdown (estimated or sourced data). Community Snapshot is seeded context for the demo and is not derived from platform users.",
    registeredVoterBreakdown: [
      { label: "Democrat", percentage: 36 },
      { label: "Republican", percentage: 24 },
      { label: "Nonpartisan / Independent", percentage: 35 },
      { label: "Other", percentage: 5 },
    ],
    ageDistribution: [
      { label: "18–34", percentage: 29 },
      { label: "35–54", percentage: 33 },
      { label: "55+", percentage: 38 },
    ],
    genderDistribution: [
      { label: "Male", percentage: 49 },
      { label: "Female", percentage: 49 },
      { label: "Other", percentage: 2 },
    ],
  },
  "las-vegas": {
    communityId: "las-vegas",
    labelNote: "Registered voter breakdown (estimated or sourced data). Community Snapshot is seeded context for the demo and is not derived from platform users.",
    registeredVoterBreakdown: [
      { label: "Democrat", percentage: 38 },
      { label: "Republican", percentage: 23 },
      { label: "Nonpartisan / Independent", percentage: 33 },
      { label: "Other", percentage: 6 },
    ],
    ageDistribution: [
      { label: "18–34", percentage: 31 },
      { label: "35–54", percentage: 34 },
      { label: "55+", percentage: 35 },
    ],
    genderDistribution: [
      { label: "Male", percentage: 50 },
      { label: "Female", percentage: 48 },
      { label: "Other", percentage: 2 },
    ],
  },
  nevada: {
    communityId: "nevada",
    labelNote: "Registered voter breakdown (estimated or sourced data). Community Snapshot is seeded context for the demo and is not derived from platform users.",
    registeredVoterBreakdown: [
      { label: "Democrat", percentage: 33 },
      { label: "Republican", percentage: 28 },
      { label: "Nonpartisan / Independent", percentage: 34 },
      { label: "Other", percentage: 5 },
    ],
    ageDistribution: [
      { label: "18–34", percentage: 28 },
      { label: "35–54", percentage: 33 },
      { label: "55+", percentage: 39 },
    ],
    genderDistribution: [
      { label: "Male", percentage: 49 },
      { label: "Female", percentage: 49 },
      { label: "Other", percentage: 2 },
    ],
  },
  "united-states": {
    communityId: "united-states",
    labelNote: "Registered voter breakdown (estimated or sourced data). Community Snapshot is seeded context for the demo and is not derived from platform users.",
    registeredVoterBreakdown: [
      { label: "Democrat", percentage: 31 },
      { label: "Republican", percentage: 29 },
      { label: "Nonpartisan / Independent", percentage: 34 },
      { label: "Other", percentage: 6 },
    ],
    ageDistribution: [
      { label: "18–34", percentage: 30 },
      { label: "35–54", percentage: 33 },
      { label: "55+", percentage: 37 },
    ],
    genderDistribution: [
      { label: "Male", percentage: 49 },
      { label: "Female", percentage: 49 },
      { label: "Other", percentage: 2 },
    ],
  },
};

export function getCommunitySnapshot(communityId: string) {
  return communitySnapshots[communityId] ?? communitySnapshots["carson-city"];
}
