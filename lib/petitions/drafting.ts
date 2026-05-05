import { cookies } from "next/headers";

const DRAFTING_PETITIONS_COOKIE = "dd_mock_petition_drafting";
const seededDraftingPetitionIds = ["petition_carson_meeting_archives"];

async function readDraftingPetitionIds() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DRAFTING_PETITIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

async function writeDraftingPetitionIds(petitionIds: string[]) {
  const cookieStore = await cookies();
  cookieStore.set(DRAFTING_PETITIONS_COOKIE, JSON.stringify([...new Set(petitionIds)].slice(0, 50)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getDraftingPetitionIds() {
  return [...seededDraftingPetitionIds, ...(await readDraftingPetitionIds())];
}

export async function isPetitionDrafting(petitionId: string) {
  const petitionIds = await getDraftingPetitionIds();
  return petitionIds.includes(petitionId);
}

export async function startDraftingForPetition(petitionId: string) {
  const petitionIds = await readDraftingPetitionIds();

  if (petitionIds.includes(petitionId)) {
    return;
  }

  await writeDraftingPetitionIds([petitionId, ...petitionIds]);
}
