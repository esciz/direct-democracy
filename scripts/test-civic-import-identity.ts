import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as prismaTypes from "@prisma/client";
import { resolveSourceImportWhere, SHARED_SOS_SOURCE_SLUGS } from "../lib/civic-data/import-identity";
import { createEmptyNormalizedCivicData } from "../lib/civic-data/normalized";

async function main() {
  const identity = { sourceId: "filings", sharedSourceIds: ["elections", "filings"], externalId: "native-office", slug: "office", jurisdictionId: "j-nevada" };
  const existing = { id: "office-1", sourceId: "elections", externalId: "native-office", jurisdictionId: "j-nevada" };
  const delegate = (records: typeof existing[], owner: typeof existing | null = records[0] ?? null) => ({
    async findMany(args: { where: { sourceId: { in: string[] }; externalId: string }; take: number }) {
      assert.deepEqual(args.where.sourceId.in, ["filings", "elections"]);
      assert.equal(args.where.externalId, identity.externalId);
      assert.equal(args.take, 2);
      return records;
    },
    async findUnique() { return owner; },
  });
  assert.deepEqual(await resolveSourceImportWhere(delegate([existing]), identity), { id: existing.id });
  assert.deepEqual(await resolveSourceImportWhere(delegate([]), identity), { sourceId_externalId: { sourceId: "filings", externalId: identity.externalId } });
  await assert.rejects(resolveSourceImportWhere(delegate([existing, { ...existing, id: "duplicate" }]), identity), /identity_ambiguous/);
  await assert.rejects(resolveSourceImportWhere(delegate([{ ...existing, jurisdictionId: "other" }]), identity), /jurisdiction_conflict/);
  await assert.rejects(resolveSourceImportWhere(delegate([], existing), identity), /slug_conflict/, "A matching slug without native ID proof cannot merge records");
  assert.deepEqual(await resolveSourceImportWhere({}, { ...identity, sharedSourceIds: ["filings"] }), { sourceId_externalId: { sourceId: "filings", externalId: identity.externalId } }, "Unrelated sources retain their isolated namespaces without cross-source lookups");
  assert.equal(SHARED_SOS_SOURCE_SLUGS.length, 2);

  // Exercise the real service foundations with an in-memory Prisma boundary.
  // Both feeds observe the same native records; no production database writes.
  type Row = Record<string, any>;
  const rows: Record<string, Row[]> = {
    district: [{ id: "d1", sourceId: "elections", externalId: "district-native", slug: "district-slug", jurisdictionId: "j-nevada" }],
    office: [{ id: "o1", sourceId: "elections", externalId: "office-native", slug: "office-slug", jurisdictionId: "j-nevada", districtId: "d1" }],
    election: [{ id: "e1", sourceId: "elections", externalId: "election-native", slug: "election-slug", jurisdictionId: "j-nevada", officeId: "o1", districtId: "d1", title: "Election", officeTitle: "Office", electionDate: new Date("2026-11-03"), electionType: "GENERAL", status: "UPCOMING" }],
    candidate: [{ id: "c1", sourceId: "elections", externalId: "candidate-native", jurisdictionId: "j-nevada", electionId: "e1", officeId: "o1", districtId: "d1", fullName: "Reviewed Candidate", status: "FILED" }],
    ballotInitiative: [{ id: "i1", sourceId: "elections", externalId: "initiative-native", slug: "initiative-slug", jurisdictionId: "j-nevada" }],
    ballotQuestion: [{ id: "q1", sourceId: "elections", externalId: "question-native", slug: "question-slug", jurisdictionId: "j-nevada" }],
    electionResult: [], official: [],
  };
  const versions: Row[] = []; const reviews: Row[] = [];
  const model = (name: string) => {
    const find = (where: Row) => rows[name].find(row => where.id ? row.id === where.id : where.slug ? row.slug === where.slug : row.sourceId === where.sourceId_externalId.sourceId && row.externalId === where.sourceId_externalId.externalId);
    return {
      async findUnique({ where }: Row) { return find(where) ?? null; },
      async findMany({ where }: Row) { return rows[name].filter(row => where.sourceId.in.includes(row.sourceId) && (typeof where.externalId === "string" ? where.externalId === row.externalId : where.externalId.in.includes(row.externalId))); },
      async upsert({ where, create, update }: Row) {
        const row = find(where);
        assert.ok(row, `${name} must reuse its canonical record, not create a duplicate`);
        assert.equal(update.sourceId, undefined, "Observation must not replace original source ownership");
        assert.equal(update.externalId, undefined);
        Object.assign(row, update);
        return row;
      },
    };
  };
  const db = {
    ...Object.fromEntries(Object.keys(rows).map(name => [name, model(name)])),
    jurisdiction: {
      async upsert({ create }: Row) { return { id: `j-${create.slug}`, slug: create.slug }; },
      async findMany({ where }: Row) { return where.slug.in.map((slug: string) => ({ id: `j-${slug}`, slug })); },
    },
    civicEntityReview: {
      async findUnique({ where }: Row) { return where.entityType_entityId.entityId === "c1" ? { reviewStatus: "verified", verificationStatus: "verified" } : null; },
      async upsert(args: Row) { reviews.push(args); return {}; },
    },
    importedRecordVersion: { async create(args: Row) { versions.push(args.data); return {}; } },
  };
  const source = readFileSync("lib/civic-data/service.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as Row };
  vm.runInNewContext(`${compiled}\nmodule.exports.foundation = upsertOfficialsFoundation; module.exports.elections = upsertElectionFoundation;`, {
    module, exports: module.exports, Date, console,
    require(name: string) {
      if (name === "@prisma/client") return prismaTypes;
      if (name === "@/lib/prisma") return { prisma: db };
      if (name === "@/lib/civic-data/import-identity") return { resolveSourceImportWhere, SHARED_SOS_SOURCE_SLUGS };
      if (name === "@/lib/civic-data/adapters") return {};
      if (name === "@/lib/civic-data/source-definitions") return { NEVADA_BETA_SOURCE_DEFINITIONS: [] };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const data = createEmptyNormalizedCivicData();
  data.districts.push({ externalId: "district-native", slug: "district-slug", jurisdictionSlug: "nevada", name: "District", districtType: "CONGRESSIONAL" });
  data.offices.push({ externalId: "office-native", slug: "office-slug", jurisdictionSlug: "nevada", districtExternalId: "district-native", title: "Office", level: "FEDERAL", selectionMethod: "ELECTED" });
  data.elections.push({ externalId: "election-native", slug: "election-slug", jurisdictionSlug: "nevada", officeExternalId: "office-native", districtExternalId: "district-native", title: "Election", officeTitle: "Office", electionDate: "2026-11-03", electionType: "GENERAL", status: "UPCOMING" });
  data.candidates.push({ externalId: "candidate-native", jurisdictionSlug: "nevada", electionExternalId: "election-native", officeExternalId: "office-native", districtExternalId: "district-native", fullName: "Changed Candidate", status: "FILED" });
  data.ballotInitiatives.push({ externalId: "initiative-native", slug: "initiative-slug", jurisdictionSlug: "nevada", electionExternalId: "election-native", title: "Initiative", summary: "Summary", status: "PROPOSED" });
  data.ballotQuestions.push({ externalId: "question-native", slug: "question-slug", jurisdictionSlug: "nevada", electionExternalId: "election-native", initiativeExternalId: "initiative-native", title: "Question", summary: "Summary", questionType: "INITIATIVE_PETITION" });
  await module.exports.foundation("filings", data, ["elections", "filings"]);
  const stats = await module.exports.elections("filings", "run-filings", "Candidate filings", data, ["elections", "filings"]);
  assert.equal(rows.candidate[0].fullName, "Reviewed Candidate", "Verified candidate changes remain held for review");
  assert.equal(stats.recordsFlaggedForReview, 1);
  assert.equal(versions[0].sourceId, "filings", "New observation retains the observing feed's provenance");
  assert.equal(versions[0].entityId, "c1");
  assert.equal(versions[0].changeType, "pending_review");
  assert.equal(versions[0].newValues.officeId, "o1");
  assert.equal(versions[0].newValues.districtId, "d1");
  assert.equal(reviews.length, 1);
  assert.equal(rows.ballotQuestion[0].ballotInitiativeId, "i1");
  assert.equal(rows.ballotQuestion[0].electionId, "e1");
  for (const records of Object.values(rows)) for (const record of records) assert.equal(record.sourceId, "elections");
  console.log("Shared civic import identity passed: exact source-scoped native IDs, conflict rejection, canonical relationships, retained ownership and protected-record review.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
