import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import type { OfficialMeetingActionRecord, PublicBodyRecord, PublicMeetingItemRecord, PublicMeetingRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "public-meeting-voting-cards.json");

function readRecords<T>(fileName: string): T[] {
  const value = JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T[] | { records?: T[] };
  return Array.isArray(value) ? value : value.records ?? [];
}

const meetings = readRecords<PublicMeetingRecord>("public-meetings.json");
const bodies = readRecords<PublicBodyRecord>("public-meeting-bodies.json");
const items = readRecords<PublicMeetingItemRecord>("public-meeting-items.json");
const officialActions = readRecords<OfficialMeetingActionRecord>("public-meeting-official-actions.json");
const actionResults = readRecords<{
  meetingItemId: string;
  outcome: string | null;
  voteCount: { yes: number; no: number; abstain: number | null } | null;
  unanimous: boolean;
  sourceSnippet: string;
  sourceUrl: string | null;
  sourcePath: string | null;
  confidence: number;
  needsReview: boolean;
}>("public-meeting-action-results.json");

const cards = buildMeetingVotingCards({ meetings, bodies, items, officialActions, actionResults });

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(cards, null, 2)}\n`);

const counts = cards.reduce<Record<string, number>>((acc, card) => {
  acc[card.review_status] = (acc[card.review_status] ?? 0) + 1;
  return acc;
}, {});

console.log(`Regenerated ${cards.length} public meeting voting cards at ${OUTPUT_PATH}`);
console.log(JSON.stringify({ cards: cards.length, reviewStatus: counts }, null, 2));
