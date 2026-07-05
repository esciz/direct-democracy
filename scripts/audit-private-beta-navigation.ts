import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getBrowsePreviewData, type BrowsePreviewCategory, type BrowsePreviewItem } from "@/lib/browse/preview-adapter";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "private-beta-navigation-audit.json");

const criticalEntityCategories: BrowsePreviewCategory[] = ["candidates", "officials", "organizations"];
const expectedRouteFiles: Record<string, string> = {
  "/candidates": "app/candidates/page.tsx",
  "/candidates/[candidateId]": "app/candidates/[candidateId]/page.tsx",
  "/officials": "app/officials/page.tsx",
  "/officials/[officialId]": "app/officials/[officialId]/page.tsx",
  "/organizations": "app/organizations/page.tsx",
  "/organizations/[orgId]": "app/organizations/[orgId]/page.tsx",
};

function isInternalHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//") && href !== "#";
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function destinationKind(item: BrowsePreviewItem) {
  if (isInternalHref(item.href)) return "internal";
  if (isExternalHref(item.href)) return "source_only";
  return "missing";
}

async function main() {
  const previews = await getBrowsePreviewData({
    communityId: "carson-city-county",
    query: "",
    limit: 12,
  });

  const categoryReports = Object.entries(previews).map(([category, preview]) => {
    const items = preview.items.map((item) => ({
      id: item.id,
      title: item.title,
      href: item.href,
      ctaLabel: item.ctaLabel,
      sourceUrl: item.sourceUrl ?? null,
      destinationKind: destinationKind(item),
      hasSourceTrail: Boolean(item.sourceUrl),
    }));

    return {
      category: category as BrowsePreviewCategory,
      itemCount: preview.items.length,
      sourceCount: preview.sourceCount,
      isSourceBacked: preview.isSourceBacked,
      usesDemoData: preview.usesDemoData,
      internalDestinationCount: items.filter((item) => item.destinationKind === "internal").length,
      sourceOnlyDestinationCount: items.filter((item) => item.destinationKind === "source_only").length,
      missingDestinationCount: items.filter((item) => item.destinationKind === "missing").length,
      sourceTrailCount: items.filter((item) => item.hasSourceTrail).length,
      items,
    };
  });

  const routeReports = Object.entries(expectedRouteFiles).map(([route, filePath]) => ({
    route,
    filePath,
    exists: existsSync(path.join(process.cwd(), filePath)),
  }));

  const failures = [
    ...routeReports.filter((route) => !route.exists).map((route) => `${route.route} missing route file ${route.filePath}.`),
    ...categoryReports.flatMap((report) => {
      const reasons: string[] = [];

      if (criticalEntityCategories.includes(report.category) && report.itemCount > 0 && report.internalDestinationCount === 0) {
        reasons.push(`${report.category} has source-backed items but no internal destinations.`);
      }

      if (criticalEntityCategories.includes(report.category) && report.sourceOnlyDestinationCount > 0) {
        reasons.push(`${report.category} has ${report.sourceOnlyDestinationCount} source-only destination(s).`);
      }

      if (report.missingDestinationCount > 0) {
        reasons.push(`${report.category} has ${report.missingDestinationCount} item(s) missing a usable destination.`);
      }

      return reasons;
    }),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      categories: categoryReports.length,
      items: categoryReports.reduce((sum, category) => sum + category.itemCount, 0),
      internalDestinations: categoryReports.reduce((sum, category) => sum + category.internalDestinationCount, 0),
      sourceOnlyDestinations: categoryReports.reduce((sum, category) => sum + category.sourceOnlyDestinationCount, 0),
      missingDestinations: categoryReports.reduce((sum, category) => sum + category.missingDestinationCount, 0),
      sourceTrails: categoryReports.reduce((sum, category) => sum + category.sourceTrailCount, 0),
      routeFilesChecked: routeReports.length,
      routeFilesMissing: routeReports.filter((route) => !route.exists).length,
      failures: failures.length,
    },
    criticalEntityCategories,
    routes: routeReports,
    categories: Object.fromEntries(categoryReports.map((category) => [category.category, category])),
    failures,
  };

  mkdirSync(GENERATED_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log("Private beta navigation audit complete.");
  console.log(JSON.stringify(report.totals, null, 2));

  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Private beta navigation audit failed:", error);
  process.exit(1);
});
