import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import ts from "typescript";
import { packCivicRuntime } from "./pack-civic-runtime";
import { PACKED_CIVIC_FILES, packedCivicPath, civicJsonPath, readCivicJson, readCivicJsonSync } from "@/lib/dataops/packed-runtime";
import { getPublicMeetingItems } from "@/lib/public-meetings/public-record-eligibility";
import { getPublicMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import { cachedTopicNeedsEvidenceReview } from "@/lib/public-meetings/evidence-review";
import { compareDecisionTrustThenDate, getDecisionTrustView } from "@/lib/civic/public-decision-trust";

async function compressedVotingCardConsumers(root: string) {
  const save = (name: string, data: unknown) => writeFile(path.join(root, "data/generated", name), JSON.stringify(data));
  const decision = { id: "decision-transport", sourceVotingCardId: "card-transport", agendaItemId: "topic-transport", meetingId: "meeting-transport",
    title: "Approve Carson City transportation contract", jurisdiction: "Carson City", summary: "Full source-backed decision text — café.",
    meeting: { id: "meeting-transport", title: "Carson City meeting", date: "2026-09-01", bodyName: "Carson City Board", href: "/events/meeting-transport" },
    reviewStatus: "approved", confidence: 0.92, voteCount: { totalKnown: 3 }, relatedOfficials: [], sourceReferences: [{ label: "Minutes", url: "https://example.gov/minutes.pdf", snippet: "Motion approved." }],
    financialImpact: { estimatedAmount: null, raw: null }, futureEvidence: { nested: [false, 0, null, { text: "Keep every field" }] } };
  const held = { ...decision, id: "held-decision", reviewStatus: "needs_review" };
  const topic = { id: decision.agendaItemId, meeting_id: decision.meetingId, title: decision.title, source_url: "https://example.gov/minutes.pdf", source_method: "automated_archive", parser_status: "partially_parsed", confidence_score: 0.92 };
  const question = { id: decision.sourceVotingCardId, topic_item_id: topic.id, meeting_id: topic.meeting_id, review_status: "approved", confidence_score: 0.92, source_url: topic.source_url, public_question: "Should Carson City approve the transportation contract?" };
  await save("voting-cards.json", { generatedAt: "2026-09-07", records: [decision, held] });
  await save("public-meeting-items-runtime.json", [topic]);
  await save("voting-cards-runtime.json", [question]);
  await packCivicRuntime(root);
  await rm(path.join(root, "data/generated/voting-cards.json"));
  assert.equal(civicJsonPath(path.join(root, "data/generated/voting-cards-runtime.json")), path.join(root, "data/generated/voting-cards-runtime.json"), "The separate meeting-question schema must keep its own plain runtime file");
  const community = { id: "carson-city", name: "Carson City", primaryJurisdictionName: "Carson City", jurisdictionMatches: ["Carson City"] };
  const relationships = { name: community.name, records: { votingCards: [], meetings: [], projects: [], spendingRecords: [], courtCases: [], officialActionRecords: [], elections: [], issues: [] } };
  async function reader<T>(relativePath: string): Promise<T> {
    const sourcePath = path.resolve(relativePath);
    const compiled = ts.transpileModule(await readFile(sourcePath, "utf8"), { fileName: sourcePath, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const module = { exports: {} as T };
    vm.runInNewContext(compiled, { module, exports: module.exports, process: { cwd: () => root }, require(name: string) {
      if (name === "server-only") return {};
      if (name === "node:path") return path;
      if (name === "@/lib/dataops/packed-runtime") return { civicJsonPath, readCivicJson };
      if (name === "@/lib/public-meetings/public-record-eligibility") return { getPublicMeetingItems };
      if (name === "@/lib/public-meetings/voting-cards") return { getPublicMeetingVotingCards };
      if (name === "@/lib/public-meetings/evidence-review") return { cachedTopicNeedsEvidenceReview };
      if (name === "@/lib/civic/public-decision-trust") return { compareDecisionTrustThenDate, getDecisionTrustView };
      if (name === "@/lib/community/communities") return { getCommunityById: () => community, getNevadaCommunityKind: () => "city", seededCommunities: [community] };
      if (name === "@/lib/community/relationships") return { emptyCommunityRelationshipBucket: () => relationships, getCommunityRelationships: async () => relationships };
      throw new Error(`Unexpected packed-runtime consumer dependency: ${name}`);
    } }, { filename: sourcePath });
    return module.exports;
  }
  const decisions = await reader<Pick<typeof import("../lib/civic/decision-pages"), "getDecisionCards">>("lib/civic/decision-pages.ts");
  const hub = await reader<Pick<typeof import("../lib/community/product-hub"), "getCommunityHubData">>("lib/community/product-hub.ts");
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(await decisions.getDecisionCards()), [decision], "Real decision reader works compressed-only while preserving approval guards and nested fields");
  assert.deepEqual(plain((await hub.getCommunityHubData(community.id))?.decisions), [decision, held], "Community hub reads every decision and keeps held records' actual status from compressed-only storage");
  const updated = { ...decision, summary: "Fresh source revision" };
  await save("voting-cards.json", { records: [updated] });
  assert.deepEqual(plain(await decisions.getDecisionCards()), [updated]);
  assert.deepEqual(plain((await hub.getCommunityHubData(community.id))?.decisions), [updated], "Both actual runtime consumers prefer new original JSON over a stale packed build");
}

async function main() {
const root = await mkdtemp(path.join(os.tmpdir(), "dd-packed-runtime-"));
try {
  await mkdir(path.join(root, "data/generated"), { recursive: true });
  const fixture = { generatedAt: "2026-09-07T00:00:00Z", records: Array.from({ length: 100 }, (_, id) => ({ id: String(id), vote: "no", review: true, source: "Full original evidence — café", amount: null })) };
  for (const name of PACKED_CIVIC_FILES) await writeFile(path.join(root, "data/generated", name), JSON.stringify(fixture));
  const results = await packCivicRuntime(root);
  assert.equal(results.length, PACKED_CIVIC_FILES.length);
  for (const result of results) {
    assert.ok(result.packedBytes < result.bytes);
    const original = path.join(root, "data/generated", result.name);
    assert.equal(civicJsonPath(original), original, "Worker JSON takes precedence over a previous build copy");
    await rm(original);
    const packed = civicJsonPath(original)!;
    assert.equal(packed, packedCivicPath(original));
    assert.deepEqual(await readCivicJson(packed), fixture, "Production compressed-only read preserves every field and row");
    assert.deepEqual(readCivicJsonSync(packed), fixture);
    await writeFile(original, JSON.stringify({ records: [] }));
    assert.deepEqual(await readCivicJson(civicJsonPath(original)!), { records: [] }, "Fresh collection wins over stale compression");
    const valid = await readFile(packed);
    await writeFile(packed, valid.subarray(0, 20));
    await rm(original);
    await assert.rejects(readCivicJson(packed), "Damaged compressed evidence must never decode into partial records");
  }
  await packCivicRuntime(root);
  for (const name of PACKED_CIVIC_FILES) assert.equal(civicJsonPath(path.join(root, "data/generated", name)), null, "Missing source removes old build copy");
  await compressedVotingCardConsumers(root);
  console.log("Packed civic runtime passed: lossless evidence, compressed-only decision/community readers, distinct question schema, fresh source precedence and corrupt-file rejection.");
} finally { await rm(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
