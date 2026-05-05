import { getOfficialById as getOfficialProfileById, getOfficials as getOfficialProfiles } from "@/lib/server/elections-context";
import type { OfficialProfileDetail, OfficialProfileSummary } from "@/types/domain";

export async function getOfficials(): Promise<OfficialProfileSummary[]> {
  return getOfficialProfiles();
}

export async function getOfficialById(id: string): Promise<OfficialProfileDetail | null> {
  return getOfficialProfileById(id);
}
