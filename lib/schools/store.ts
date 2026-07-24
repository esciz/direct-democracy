import type { AuthUser, SchoolDetail, SchoolSummary } from "@/types/domain";

export function getAllSchools(): SchoolSummary[] {
  return [];
}

export function getSchoolsForCommunity(_communityId: string): SchoolSummary[] {
  return [];
}

export function getTopSchoolsForCommunity(_communityId: string, _limit = 3): SchoolSummary[] {
  return [];
}

export async function getSchoolById(_user: AuthUser, _schoolId: string): Promise<SchoolDetail | null> {
  return null;
}
