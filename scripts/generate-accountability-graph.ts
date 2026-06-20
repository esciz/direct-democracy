import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildAccountabilityGraph } from "@/lib/community/accountability-graph";
import type { PublicMeetingRecord } from "@/lib/public-meetings/types";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "accountability-graph.json");

type Artifact<T> = {
  generatedAt?: string;
  records?: T[];
};

function readJson<T>(fileName: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path.join(GENERATED_DIR, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

const meetings = readJson<PublicMeetingRecord[]>("public-meetings.json", []);
const votingCards = readJson<Artifact<Parameters<typeof buildAccountabilityGraph>[0]["votingCards"][number]>>("voting-cards.json", { records: [] });
const projects = readJson<Artifact<Parameters<typeof buildAccountabilityGraph>[0]["projects"][number]>>("projects-runtime.json", { records: [] });
const attendance = readJson<Artifact<NonNullable<Parameters<typeof buildAccountabilityGraph>[0]["attendance"]>[number]>>("public-meeting-attendance.json", { records: [] });
const graph = buildAccountabilityGraph({
  meetings,
  votingCards: votingCards.records ?? [],
  projects: projects.records ?? [],
  attendance: attendance.records ?? [],
});

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(graph, null, 2)}\n`);
console.log(`Generated accountability graph with ${graph.totals.nodes} nodes and ${graph.totals.edges} edges at ${OUTPUT_PATH}`);
