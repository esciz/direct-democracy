import type { IngestionIssue } from "@/lib/civic-data/types";
import { fetchOfficialHtml } from "@/lib/civic-data/adapters/html";
import type { OfficialSeedRecord } from "@/lib/civic-data/adapters/foundation";

export async function validateOfficialPages(records: OfficialSeedRecord[]) {
  const issues: IngestionIssue[] = [];

  await Promise.all(
    records.map(async (record) => {
      if (!record.websiteUrl) {
        issues.push({
          severity: "warning",
          message: `${record.fullName} has no official website URL.`,
          externalId: record.externalId,
        });
        return;
      }

      try {
        const html = await fetchOfficialHtml(record.websiteUrl);
        const lastName = record.fullName.split(/\s+/).at(-1);

        if (lastName && !html.toLowerCase().includes(lastName.toLowerCase())) {
          issues.push({
            severity: "warning",
            message: `Official page fetched but did not include expected name fragment "${lastName}".`,
            externalId: record.externalId,
          });
        }
      } catch (error) {
        issues.push({
          severity: "warning",
          message: error instanceof Error ? error.message : "Official page validation failed.",
          externalId: record.externalId,
        });
      }
    }),
  );

  return issues;
}

