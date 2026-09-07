import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { hasTeacherPaySubjectEvidence } from "../lib/issues/utils";
import { getPublicMeetingItems } from "../lib/public-meetings/public-record-eligibility";
import { getPublicMeetingVotingCards } from "../lib/public-meetings/voting-cards";
import type { IssueHubRecord } from "../lib/issues/civic-hub";

function issue(overrides: Partial<IssueHubRecord> = {}): IssueHubRecord {
  return {
    id: "issue_real_teacher-pay",
    issueText: "Teacher Pay",
    issueSlug: "teacher-pay",
    summary: "Teacher compensation and retention.",
    scope: "local",
    jurisdictionName: "Nevada System of Higher Education",
    sourceBacked: true,
    reviewStatus: "needs_review",
    sourceTypes: ["agenda_item", "meeting_voting_card"],
    communities: ["Nevada System of Higher Education"],
    policyAreas: ["Other"],
    relationshipCounts: { meetings: 1, agendaItems: 7, votingCards: 1, courtCases: 0, communitySubmissions: 0, votes: 1, officials: 0, newsStories: 0, spendingRecords: 0, projects: 0, ballotQuestions: 0, sourceDocuments: 7 },
    relatedMeetingIds: ["meeting-public-comment", "meeting-compensation-report"],
    relatedAgendaItemIds: ["item-public-comment", "item-compensation-report"],
    relatedVotingCardIds: ["held-compensation-card"],
    relatedCourtCaseIds: [],
    relatedIssueReviewRequestIds: [],
    relatedSourceUrls: ["https://example.gov/minutes.pdf"],
    confidence: 0.63,
    ...overrides,
  };
}

function isolatedReader() {
  let runtime: unknown = { records: [] };
  const reads: string[] = [];
  let publicItems: unknown = [];
  let publicCards: unknown = [];
  const sourcePath = path.resolve("lib/issues/civic-hub.ts");
  const runtimePath = path.resolve("data/generated/issues-runtime.json");
  const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    fileName: sourcePath,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  type Reader = {
    getIssueHubRecords(): Promise<IssueHubRecord[]>;
    getIssueHubRecordByRouteParam(value: string): Promise<IssueHubRecord | null>;
  };
  const module = { exports: {} as Reader };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    process: { cwd: () => process.cwd() },
    require(name: string) {
      if (name === "server-only") return {};
      if (name === "node:path") return path;
      if (name === "@/lib/issues/utils") return { hasTeacherPaySubjectEvidence };
      if (name === "@/lib/public-meetings/public-record-eligibility") return { getPublicMeetingItems };
      if (name === "@/lib/public-meetings/voting-cards") return { getPublicMeetingVotingCards };
      if (name === "node:fs/promises") return {
        readFile: async (file: string, encoding: string) => {
          reads.push(file);
          assert.ok([runtimePath, path.resolve("data/generated/public-meeting-items-runtime.json"), path.resolve("data/generated/voting-cards-runtime.json")].includes(file), "Only the issue record and two compact public evidence files may be consulted");
          assert.equal(encoding, "utf8");
          const data = file === runtimePath ? runtime : file.endsWith("/public-meeting-items-runtime.json") ? publicItems : publicCards;
          if (data === undefined) throw Object.assign(new Error("Fixture artifact missing"), { code: "ENOENT" });
          return JSON.stringify(data);
        },
      };
      throw new Error(`Unstubbed reader dependency: ${name}`);
    },
    console: { warn: (...args: unknown[]) => { throw new Error(`Unexpected reader warning: ${args[0]}`); } },
  }, { filename: sourcePath });
  return {
    reader: module.exports,
    setRuntime(next: unknown) { runtime = next; },
    setEvidence(items: unknown, cards: unknown) { publicItems = items; publicCards = cards; },
    readCount: () => reads.length,
    evidenceReadCount: () => reads.filter((file) => file !== runtimePath).length,
    readFiles: reads,
  };
}

async function main() {
  const fixture = isolatedReader();
  const staleTeacherPay = issue();
  const housing = issue({ id: "issue_real_housing", issueSlug: "housing", issueText: "Housing" });
  const schoolFunding = issue({ id: "issue_real_school-funding", issueSlug: "school-funding", issueText: "School Funding", reviewStatus: "generated" });
  fixture.setRuntime({ records: [staleTeacherPay, housing, schoolFunding] });
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecords()), [housing, schoolFunding], "Stale Teacher Pay is held without hiding legitimate legacy issues");
  assert.equal(await fixture.reader.getIssueHubRecordByRouteParam(staleTeacherPay.id), null, "Old ID routes cannot bypass the compatibility check");
  assert.equal(await fixture.reader.getIssueHubRecordByRouteParam("TEACHER-PAY"), null, "Old slug routes cannot bypass the compatibility check");
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecordByRouteParam("school-funding")), schoolFunding);

  const supportedTeacherPay = issue({ publicRelationshipEvidenceVersion: 1, relationshipCounts: { ...staleTeacherPay.relationshipCounts, meetings: 1, agendaItems: 1 }, relatedMeetingIds: ["meeting-teacher-contract"], relatedAgendaItemIds: ["item-teacher-contract"] });
  fixture.setRuntime({ records: [supportedTeacherPay, housing] });
  const evidenceReadsBeforeVersioned = fixture.evidenceReadCount();
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecords()), [supportedTeacherPay, housing], "New generator evidence metadata preserves supported Teacher Pay");
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecordByRouteParam("teacher-pay")), supportedTeacherPay);
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecordByRouteParam(supportedTeacherPay.id)), supportedTeacherPay);
  assert.equal(fixture.evidenceReadCount(), evidenceReadsBeforeVersioned, "New generator metadata avoids any compatibility evidence reads");

  for (const stale of [
    issue({ publicRelationshipEvidenceVersion: 0 }),
    issue({ confidence: 0.99, reviewStatus: "verified" }),
    issue({ id: "legacy-by-slug", issueText: "Old issue title" }),
    issue({ id: "legacy-by-title", issueSlug: "old-topic", issueText: " Teacher Pay " }),
    issue({ id: "issue_real_teacher-pay", issueSlug: "old-topic", issueText: "Old issue title" }),
  ]) {
    fixture.setRuntime({ publicRelationshipEvidenceVersion: 1, records: [stale, housing] });
    assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecords()), [housing], "Wrapper metadata, high confidence, or a changed route name cannot validate an old record");
  }
  fixture.setRuntime({ records: [{ ...staleTeacherPay, publicRelationshipEvidenceVersion: "1" }, housing] });
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecords()), [housing], "Malformed version metadata cannot pass the gate");
  fixture.setRuntime({ records: [issue({ ...housing, publicRelationshipEvidenceVersion: 0 })] });
  assert.equal((await fixture.reader.getIssueHubRecords()).length, 1, "The targeted compatibility gate does not become a global issue version requirement");

  const teacherSalaryTopic = { id: "item-compensation-report", title: "Consider teacher salary schedule", source_text: "Discussion of teacher pay and educator retention.", plain_english_explanation: "Discussion of teacher pay and educator retention.", parser_status: "source_excerpt", source_method: "automated_archive", confidence_score: 0.72, source_url: "https://example.gov/teacher-contract.pdf" };
  fixture.setRuntime({ records: [staleTeacherPay, housing] });
  fixture.setEvidence([teacherSalaryTopic], []);
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecords()), [staleTeacherPay, housing], "Legitimate legacy Teacher Pay survives when a listed public topic has actual subject evidence");
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecordByRouteParam("teacher-pay")), staleTeacherPay);
  for (const topic of [
    { ...teacherSalaryTopic, parser_status: "needs_review", confidence_score: 0.99 },
    { ...teacherSalaryTopic, source_url: null },
    { ...teacherSalaryTopic, id: "unrelated-topic-not-linked-to-this-issue" },
    { ...teacherSalaryTopic, title: "Public Comment", source_text: "Cannabis education and funding for patients. Classroom support was mentioned." },
  ]) {
    fixture.setEvidence([topic], []);
    assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecords()), [housing], "Held, uncited, unlinked, or semantically unrelated topics cannot validate a stale issue");
  }
  const teacherSalaryCard = { id: "held-compensation-card", review_status: "approved", confidence_score: 0.92, source_url: "https://example.gov/teacher-contract.pdf", source_title: "Teacher salary agreement", agenda_language_original: "Approval of a revised teacher salary schedule.", source_snippets: ["Discuss teacher retention and compensation."], public_title: "Teacher salary agreement", plain_language_summary: "Increase teacher salaries to improve retention.", question_text: "Should the district approve the teacher salary agreement?" };
  fixture.setEvidence([], [teacherSalaryCard]);
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecords()), [staleTeacherPay, housing], "A listed approved, specific public card can also prove a legitimate legacy subject");
  for (const card of [
    { ...teacherSalaryCard, review_status: "needs_review", confidence_score: 0.99 },
    { ...teacherSalaryCard, question_text: "Should the district approve motion carried?" },
    { ...teacherSalaryCard, source_url: null },
    { ...teacherSalaryCard, source_title: "Public Comment", agenda_language_original: "Cannabis education and investor funding.", source_snippets: ["Classroom support for public schools."], public_title: "Teacher Pay", plain_language_summary: "Teacher compensation and retention." },
    { ...teacherSalaryCard, id: "unrelated-card-not-linked-to-this-issue" },
  ]) {
    fixture.setEvidence([], [card]);
    assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecords()), [housing], "Actual public card eligibility and subject evidence are both required");
  }
  fixture.setEvidence(undefined, undefined);
  assert.deepEqual(structuredClone(await fixture.reader.getIssueHubRecords()), [housing], "Missing public evidence holds only the unsupported legacy issue");
  fixture.setRuntime({ records: [] });
  assert.equal((await fixture.reader.getIssueHubRecords()).length, 0);
  assert.ok(fixture.readCount() > 0, "Assertions exercised the actual asynchronous runtime reader");
  assert.ok(fixture.readFiles.every((file) => ["issues-runtime.json", "public-meeting-items-runtime.json", "voting-cards-runtime.json"].includes(path.basename(file))), "No full worker dataset or relationship graph was read");
  console.log("Issue hub reader compatibility passed: unsupported legacy Teacher Pay hidden by list and route lookup; versioned records and semantically supported public legacy evidence retained; held/generic/unrelated sources rejected; other legacy issues preserved without graph recomputation or database access.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
