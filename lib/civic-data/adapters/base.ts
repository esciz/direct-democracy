import { SourceSyncStatus } from "@prisma/client";

import { createEmptyNormalizedCivicData } from "@/lib/civic-data/normalized";
import type { CivicDataAdapter, CivicSourceAdapterKey, IngestionContext, IngestionResult } from "@/lib/civic-data/types";

type PlaceholderAdapterOptions = {
  key: CivicSourceAdapterKey;
  displayName: string;
  supportsIncremental?: boolean;
};

export function createPlaceholderAdapter({
  key,
  displayName,
  supportsIncremental = true,
}: PlaceholderAdapterOptions): CivicDataAdapter {
  return {
    key,
    displayName,
    supportsIncremental,
    supportsScheduled: true,
    async sync(context: IngestionContext): Promise<IngestionResult> {
      const data = createEmptyNormalizedCivicData();

      return {
        sourceSlug: context.source.slug,
        status: SourceSyncStatus.SUCCESS,
        cursor: context.cursor ?? null,
        data,
        issues: [
          {
            severity: "info",
            message: `${displayName} adapter is registered. Parser implementation is pending; no records were imported.`,
          },
        ],
        recordsSeen: 0,
        recordsChanged: 0,
      };
    },
  };
}

