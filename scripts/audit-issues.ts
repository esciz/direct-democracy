import fs from "node:fs";
import path from "node:path";

import { getCanonicalIssueTopics } from "@/lib/issues/utils";

const ROOT = process.cwd();
const OUTPUT_PATH = path.join(ROOT, "data/generated/issues-audit-report.json");

function readText(relativePath: string) {
  const absolutePath = path.join(ROOT, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
}

function readJson(relativePath: string) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function recordsFrom(value: unknown) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["records", "cards", "items", "events"]) {
      if (Array.isArray(object[key])) {
        return object[key];
      }
    }
  }

  return [];
}

function countMatches(text: string, pattern: RegExp) {
  return [...text.matchAll(pattern)].length;
}

function modelBlock(schema: string, modelName: string) {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
  return match?.[0] ?? null;
}

function enumBlock(schema: string, enumName: string) {
  const match = schema.match(new RegExp(`enum ${enumName} \\{[\\s\\S]*?\\n\\}`));
  return match?.[0] ?? null;
}

function listFields(block: string | null) {
  if (!block) {
    return [];
  }

  return block
    .split("\n")
    .slice(1, -1)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}

function listEnumValues(block: string | null) {
  if (!block) {
    return [];
  }

  return block
    .split("\n")
    .slice(1, -1)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"));
}

function collectUiSearches() {
  const files = [
    "app/issues/page.tsx",
    "app/issues/[issueId]/page.tsx",
    "app/issues/report/page.tsx",
    "components/domain/top-issue-card.tsx",
    "components/domain/issue-lifecycle-map.tsx",
    "components/domain/issue-picker-field.tsx",
    "components/domain/issue-positions-section.tsx",
    "components/domain/community-issue-priority-list.tsx",
  ];

  return files.map((file) => ({
    file,
    exists: fs.existsSync(path.join(ROOT, file)),
  }));
}

function main() {
  const schema = readText("prisma/schema.prisma");
  const mockData = readText("lib/mock-data.ts");
  const issueRuntime = readJson("data/generated/issues-runtime.json") as { records?: unknown[]; metrics?: unknown } | null;
  const issueReviewRuntime = readJson("data/generated/issue-review-requests-runtime.json");
  const votingCards = recordsFrom(readJson("data/generated/public-meeting-voting-cards.json"));
  const agendaItems = recordsFrom(readJson("data/generated/public-meeting-items.json"));
  const courtCases = recordsFrom(readJson("data/generated/public-court-cases-runtime.json"));

  const issueRelatedModels = [
    "IssueSnapshot",
    "IssueFollow",
    "TopIssueSubmission",
    "TopIssueUpvote",
    "IssuePosition",
    "IssuePositionChange",
    "Case",
  ];
  const issueRelatedEnums = ["TopIssueSource", "IssuePositionStance", "IssuePositionDerivation"];

  const canonicalTopics = getCanonicalIssueTopics();
  const generatedIssues = Array.isArray(issueRuntime?.records) ? issueRuntime.records : [];
  const reviewRequests = recordsFrom(issueReviewRuntime);
  const demoIssueIds = [...mockData.matchAll(/id: "((?:curated_)?issue[^"]*)"/g)].map((match) => match[1]);
  const hardcodedIssueLinks = [...mockData.matchAll(/relatedIssueHref: "([^"]+)"/g)].map((match) => match[1]);
  const campusProductHits = [...mockData.matchAll(/student government|student mode|campus|Western Nevada College|ASUN|\.edu/gi)].length;

  const report = {
    generatedAt: new Date().toISOString(),
    output: "data/generated/issues-audit-report.json",
    currentSchema: {
      hasPrimaryIssueModel: Boolean(modelBlock(schema, "Issue")),
      finding:
        "No standalone Prisma Issue model exists. The current Issues system is composed of issue snapshots, follows, top-issue submissions/upvotes, issue positions, issue tags on adjacent records, and generated runtime hubs.",
      models: issueRelatedModels.map((name) => ({
        name,
        present: Boolean(modelBlock(schema, name)),
        fields: listFields(modelBlock(schema, name)),
      })),
      enums: issueRelatedEnums.map((name) => ({
        name,
        present: Boolean(enumBlock(schema, name)),
        values: listEnumValues(enumBlock(schema, name)),
      })),
      issueSourceFields: [
        "TopIssueSubmission.source",
        "IssuePosition.derivation",
        "IssuePosition.evidenceUrl",
        "IssuePosition.sourceId",
        "Case.issueTags",
        "runtime sourceTypes in data/generated/issues-runtime.json",
      ],
      issueRelationshipStrategy:
        "Reuse existing issue text/slug matching and adjacent record issueTags; generated issue hubs store related record IDs for meetings, agenda items, voting cards, court cases, source documents, and citizen issue submissions.",
    },
    currentUi: {
      routes: ["/issues", "/issues/[issueId]", "/issues/report"],
      files: collectUiSearches(),
      filters: ["q search on /issues", "detail filter: posts", "events", "debates", "petitions", "cases", "ballotMeasures"],
      cardsAndSections: [
        "ExploreResultCard on /issues",
        "TopIssueCard in community flows",
        "Issue brief",
        "People",
        "Organizations",
        "Issue positions",
        "Political ads",
        "Issue review requests",
      ],
    },
    currentData: {
      demoIssues: {
        mockTopIssueIdCount: demoIssueIds.length,
        hardcodedIssueLinkCount: hardcodedIssueLinks.length,
        campusProductHitCount: campusProductHits,
        note:
          campusProductHits > 0
            ? "Campus/student-government product references still exist in mock data outside the canonical issue topic list and should remain guarded from public issue IA."
            : "No campus/student-government issue topic assumptions found in canonical issue topics.",
      },
      canonicalIssueTopics: {
        count: canonicalTopics.length,
        titles: canonicalTopics.map((topic) => topic.title),
      },
      sourceBackedInputs: {
        meetingVotingCards: votingCards.length,
        agendaItems: agendaItems.length,
        publicCourtCases: courtCases.length,
        issueReviewRequests: reviewRequests.length,
      },
      generatedIssueHubs: {
        count: generatedIssues.length,
        metrics: issueRuntime?.metrics ?? null,
      },
      placeholderSignals: {
        mockDataIssueTextOccurrences: countMatches(mockData, /issueText:/g),
        mockCuratedIssueBlockPresent: mockData.includes("mockCuratedTopIssues"),
        recommendation:
          "Keep mock top issues only as demo fallback. Prefer data/generated/issues-runtime.json for issue directory ordering and source-backed relationship counts.",
      },
    },
    migrationPlan: [
      "Preserve /issues and /issues/[issueId] URLs.",
      "Use generated issue hubs from existing meeting, agenda, voting-card, court, and issue review request data.",
      "Keep TopIssueSubmission and IssueFollow as user engagement overlays rather than the canonical issue source.",
      "Avoid creating a parallel Issue model until persistence requirements exceed runtime relationship records.",
      "Route citizen concerns through /issues/report and mark claims as submitted or needs review until verified.",
    ],
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[issues] Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main();
