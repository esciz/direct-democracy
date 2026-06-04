import { SourceSyncStatus } from "@prisma/client";

import { getCivicDataAdapter } from "@/lib/civic-data/adapters";
import { NEVADA_BETA_SOURCE_DEFINITIONS, getSourceDefinition } from "@/lib/civic-data/source-definitions";
import type { CivicSourceDefinition, ImportMode, IngestionIssue } from "@/lib/civic-data/types";
import { prisma } from "@/lib/prisma";

export type AdminSourceRow = CivicSourceDefinition & {
  id?: string;
  lastSyncAt?: Date | null;
  syncStatus: SourceSyncStatus;
  errorLog?: string | null;
  syncCursor?: string | null;
  isPersisted: boolean;
};

export type AdminImportRunRow = {
  id: string;
  sourceName: string;
  sourceSlug: string;
  startedAt: Date;
  completedAt: Date | null;
  status: SourceSyncStatus;
  recordsSeen: number;
  recordsChanged: number;
  errorLog: string | null;
};

export type CivicDataMetrics = {
  officials: number;
  elections: number;
  bills: number;
  initiatives: number;
  meetings: number;
  ads: number;
  dataSources: number;
};

const emptyMetrics: CivicDataMetrics = {
  officials: 0,
  elections: 0,
  bills: 0,
  initiatives: 0,
  meetings: 0,
  ads: 0,
  dataSources: NEVADA_BETA_SOURCE_DEFINITIONS.length,
};

function serializeIssues(issues: IngestionIssue[]) {
  return issues.length > 0 ? issues.map((issue) => `[${issue.severity}] ${issue.message}`).join("\n") : null;
}

async function upsertSourceDefinition(definition: CivicSourceDefinition) {
  const jurisdiction = await prisma.jurisdiction.findUnique({
    where: { slug: definition.jurisdictionSlug },
    select: { id: true },
  });

  return prisma.source.upsert({
    where: { slug: definition.slug },
    create: {
      name: definition.name,
      slug: definition.slug,
      sourceType: definition.sourceType,
      url: definition.url,
      adapterKey: definition.adapterKey,
      jurisdictionId: jurisdiction?.id,
      metadata: {
        description: definition.description,
        jurisdictionSlug: definition.jurisdictionSlug,
      },
    },
    update: {
      name: definition.name,
      sourceType: definition.sourceType,
      url: definition.url,
      adapterKey: definition.adapterKey,
      jurisdictionId: jurisdiction?.id,
      metadata: {
        description: definition.description,
        jurisdictionSlug: definition.jurisdictionSlug,
      },
    },
  });
}

export async function ensureNevadaBetaSources() {
  return Promise.all(NEVADA_BETA_SOURCE_DEFINITIONS.map((definition) => upsertSourceDefinition(definition)));
}

export async function getAdminDataSources(): Promise<AdminSourceRow[]> {
  try {
    const persistedSources = await prisma.source.findMany({
      where: {
        slug: {
          in: NEVADA_BETA_SOURCE_DEFINITIONS.map((source) => source.slug),
        },
      },
      orderBy: { name: "asc" },
    });

    return NEVADA_BETA_SOURCE_DEFINITIONS.map((definition) => {
      const persisted = persistedSources.find((source) => source.slug === definition.slug);

      return {
        ...definition,
        id: persisted?.id,
        lastSyncAt: persisted?.lastSyncAt,
        syncStatus: persisted?.syncStatus ?? SourceSyncStatus.NEVER_SYNCED,
        errorLog: persisted?.errorLog,
        syncCursor: persisted?.syncCursor,
        isPersisted: Boolean(persisted),
      };
    });
  } catch {
    return NEVADA_BETA_SOURCE_DEFINITIONS.map((definition) => ({
      ...definition,
      syncStatus: SourceSyncStatus.NEVER_SYNCED,
      isPersisted: false,
    }));
  }
}

export async function getAdminImportRuns(): Promise<AdminImportRunRow[]> {
  try {
    const runs = await prisma.sourceSyncRun.findMany({
      include: {
        source: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    return runs.map((run) => ({
      id: run.id,
      sourceName: run.source.name,
      sourceSlug: run.source.slug,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      status: run.status,
      recordsSeen: run.recordsSeen,
      recordsChanged: run.recordsChanged,
      errorLog: run.errorLog,
    }));
  } catch {
    return [];
  }
}

export async function getCivicDataMetrics(): Promise<CivicDataMetrics> {
  try {
    const [officials, elections, bills, initiatives, meetings, ads, dataSources] = await Promise.all([
      prisma.official.count(),
      prisma.election.count(),
      prisma.legislativeBill.count(),
      prisma.ballotInitiative.count(),
      prisma.meeting.count(),
      prisma.politicalAdvertisement.count(),
      prisma.source.count(),
    ]);

    return {
      officials,
      elections,
      bills,
      initiatives,
      meetings,
      ads,
      dataSources: Math.max(dataSources, NEVADA_BETA_SOURCE_DEFINITIONS.length),
    };
  } catch {
    return emptyMetrics;
  }
}

export async function syncCivicSource(sourceSlug: string, mode: ImportMode = "manual") {
  const definition = getSourceDefinition(sourceSlug);

  if (!definition) {
    throw new Error(`Unknown civic data source: ${sourceSlug}`);
  }

  const adapter = getCivicDataAdapter(definition.adapterKey);
  const source = await upsertSourceDefinition(definition);
  const run = await prisma.sourceSyncRun.create({
    data: {
      sourceId: source.id,
      status: SourceSyncStatus.SYNCING,
      cursorBefore: source.syncCursor,
    },
  });

  await prisma.source.update({
    where: { id: source.id },
    data: {
      syncStatus: SourceSyncStatus.SYNCING,
      errorLog: null,
    },
  });

  try {
    const result = await adapter.sync({
      source: definition,
      mode,
      cursor: source.syncCursor,
      requestedAt: new Date(),
    });
    const errorLog = serializeIssues(result.issues);

    await prisma.$transaction([
      prisma.source.update({
        where: { id: source.id },
        data: {
          lastSyncAt: new Date(),
          syncStatus: result.status,
          errorLog,
          syncCursor: result.cursor,
        },
      }),
      prisma.sourceSyncRun.update({
        where: { id: run.id },
        data: {
          completedAt: new Date(),
          status: result.status,
          recordsSeen: result.recordsSeen,
          recordsChanged: result.recordsChanged,
          errorLog,
          cursorAfter: result.cursor,
        },
      }),
    ]);

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion error";

    await prisma.$transaction([
      prisma.source.update({
        where: { id: source.id },
        data: {
          lastSyncAt: new Date(),
          syncStatus: SourceSyncStatus.ERROR,
          errorLog: message,
        },
      }),
      prisma.sourceSyncRun.update({
        where: { id: run.id },
        data: {
          completedAt: new Date(),
          status: SourceSyncStatus.ERROR,
          errorLog: message,
        },
      }),
    ]);

    throw error;
  }
}

