import { mkdirSync, writeFileSync } from "fs";
import path from "path";

import { getBrowsePreviewData, type BrowsePreviewCategory, type BrowsePreviewData } from "../lib/browse/preview-adapter";

const categories: BrowsePreviewCategory[] = [
  "communities",
  "issues",
  "people",
  "candidates",
  "officials",
  "petitions",
  "cases",
  "events",
  "elections",
  "ads",
  "organizations",
];

const forbiddenDemoPatterns = [
  /elena\s+ramirez/i,
  /sofia\s+bennett/i,
  /bennett\s+for\s+nevada/i,
  /future\s+first\s+pac/i,
  /demo\s+petition/i,
  /sample\s+petition/i,
  /fake\s+petition/i,
  /fake\s+ad/i,
  /mock\s+candidate/i,
  /seeded\s+political\s+ad/i,
];

function flattenPreviewText(preview: BrowsePreviewData) {
  return preview.items
    .map((item) =>
      [
        item.id,
        item.title,
        item.subtitle,
        item.description,
        item.href,
        item.ctaLabel,
        item.sourceUrl,
        ...(item.badges ?? []).map((badge) => badge.label),
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join("\n");
}

function auditPreview(category: BrowsePreviewCategory, preview: BrowsePreviewData) {
  const text = flattenPreviewText(preview);
  const forbiddenMatches = forbiddenDemoPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);

  return {
    category,
    itemCount: preview.items.length,
    sourceCount: preview.sourceCount,
    availableGeneratedCount: preview.availableGeneratedCount,
    isSourceBacked: preview.isSourceBacked,
    usesDemoData: preview.usesDemoData,
    lastGeneratedAt: preview.lastGeneratedAt,
    statusLabel: preview.statusLabel,
    emptyReason: preview.emptyReason,
    fullHref: preview.fullHref,
    hasGeneratedDataButEmptyPreview: preview.availableGeneratedCount > 0 && preview.items.length === 0,
    forbiddenDemoMatches: forbiddenMatches,
  };
}

const previews = getBrowsePreviewData({
  communityId: "carson-city-county",
  query: "",
  limit: 12,
});

const categoryReports = categories.map((category) => auditPreview(category, previews[category]));
const failures = categoryReports.flatMap((report) => {
  const reasons: string[] = [];

  if (report.usesDemoData) {
    reasons.push("usesDemoData=true");
  }

  if (report.forbiddenDemoMatches.length) {
    reasons.push(`forbidden demo text matched: ${report.forbiddenDemoMatches.join(", ")}`);
  }

  return reasons.map((reason) => ({ category: report.category, reason }));
});

const report = {
  generatedAt: new Date().toISOString(),
  communityId: "carson-city-county",
  totals: {
    categories: categoryReports.length,
    populatedCategories: categoryReports.filter((report) => report.itemCount > 0).length,
    intentionallyEmptyCategories: categoryReports.filter((report) => report.itemCount === 0 && report.emptyReason).length,
    sourceBackedCategories: categoryReports.filter((report) => report.isSourceBacked).length,
    demoBackedCategories: categoryReports.filter((report) => report.usesDemoData).length,
    categoriesWithGeneratedDataButEmptyPreview: categoryReports.filter((report) => report.hasGeneratedDataButEmptyPreview).length,
    failures: failures.length,
  },
  categories: Object.fromEntries(categoryReports.map((report) => [report.category, report])),
  categoriesWithAvailableGeneratedDataButEmptyPreviews: categoryReports
    .filter((report) => report.hasGeneratedDataButEmptyPreview)
    .map((report) => ({
      category: report.category,
      availableGeneratedCount: report.availableGeneratedCount,
      emptyReason: report.emptyReason,
    })),
  failures,
};

const outDir = path.join(process.cwd(), "data", "generated");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "browse-preview-audit.json"), `${JSON.stringify(report, null, 2)}\n`);

for (const category of categoryReports) {
  console.log(
    `${category.category}: ${category.itemCount} items, ${category.sourceCount} source records, ${category.isSourceBacked ? "source-backed" : "limited"}, ${
      category.usesDemoData ? "demo" : "no-demo"
    }`,
  );
}

if (failures.length) {
  console.error("Browse preview audit failed:");
  for (const failure of failures) {
    console.error(`- ${failure.category}: ${failure.reason}`);
  }
  process.exit(1);
}

console.log(`Browse preview audit passed. Report written to ${path.join(outDir, "browse-preview-audit.json")}`);
