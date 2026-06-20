import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildResidentStoryIntakeFromFormData, validateResidentStoryIntakeShape } from "@/lib/cases/resident-intake";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const AUDIT_OUTPUT_PATH = path.join(GENERATED_DIR, "resident-intake-shape-audit.json");
const RUNTIME_OUTPUT_PATH = path.join(GENERATED_DIR, "resident-civic-intake-runtime.json");

const fixture = new FormData();
fixture.set("submissionType", "government_service_failure");
fixture.set(
  "story",
  "I tried to get a city service resolved for several weeks, but the agency did not respond and I need help understanding which public body is responsible.",
);
fixture.set("location", "Reno, Nevada");
fixture.set("approximateDate", "Spring 2026");
fixture.set("peopleOrEntitiesInvolved", "City service department");
fixture.set("links", "https://www.reno.gov/");
fixture.set("publicationPreference", "private");

const intake = buildResidentStoryIntakeFromFormData(fixture, new Date("2026-06-20T12:00:00.000Z"));
const errors = validateResidentStoryIntakeShape(intake);
const requiredSafetyFields = ["containsPersonalData", "containsAllegation", "involvesMinor", "involvesLegalMatter"];
for (const field of requiredSafetyFields) {
  if (!(field in intake.safety)) errors.push(`missing safety.${field}`);
}
if (intake.publicationStatus !== "private_pending_review") errors.push("publicationStatus must default to private_pending_review");
if (intake.verificationStatus !== "source_links_provided") errors.push("fixture should be source_links_provided");

const audit = {
  generatedAt: new Date().toISOString(),
  totals: {
    fixtureSubmissions: 1,
    validFixtures: errors.length ? 0 : 1,
    errors: errors.length,
    runtimePendingResidentConcerns: 0,
  },
  requiredFields: [
    "submissionType",
    "story",
    "location",
    "approximateDate",
    "peopleOrEntitiesInvolved",
    "publicationStatus",
    "verificationStatus",
    "reviewerNotes",
    "safety.containsPersonalData",
    "safety.containsAllegation",
    "safety.involvesMinor",
    "safety.involvesLegalMatter",
  ],
  fixture: intake,
  errors,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(AUDIT_OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);
writeFileSync(
  RUNTIME_OUTPUT_PATH,
  `${JSON.stringify(
    {
      generatedAt: audit.generatedAt,
      policy: "Resident submissions are private pending review and are not public civic truth until verified.",
      records: [],
    },
    null,
    2,
  )}\n`,
);

if (errors.length) {
  console.error("Resident intake shape validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Resident intake shape validation passed.");
console.log(JSON.stringify(audit.totals, null, 2));
