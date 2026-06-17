# Civic Data Update Pipeline

Direct Democracy keeps civic records updated through explicit import jobs. Normal page renders only read stored data; they do not scrape, geocode, or fetch source sites.

## Source Registry

Sources are stored in the `Source` table, which acts as the civic data source registry:

- `name`, `slug`, `sourceType`, `url`, `adapterKey`
- `jurisdictionId`
- `refreshFrequency`
- `lastCheckedAt`
- `lastSuccessAt`
- `lastSyncAt`
- `syncStatus`
- `errorLog`
- `isActive`

Seed or refresh the registry by visiting the admin data pages or running an import. `ensureNevadaBetaSources()` upserts the Nevada beta source definitions.

## Import Runs

Every import creates a `SourceSyncRun` row with:

- source
- start/completion timestamps
- status
- records found, created, updated, unchanged, and flagged for review
- parser/source error log
- cursor before/after

If a source fails, the importer records the failure on the source and run, but it keeps the last good stored data.

## Manual Imports

Start the app first:

```bash
npm run dev
```

Then run imports from another terminal:

```bash
npm run import:voter-registration
npm run import:election-results
npm run import:precinct-results
npm run import:candidate-filings
```

Job buckets:

```bash
npm run import:daily-candidate-elections
npm run import:monthly-voter-registration
npm run import:weekly-legislative
```

Custom source or deployed target:

```bash
npm run import:civic -- --source=nevada-secretary-of-state-candidate-filings
CIVIC_IMPORT_BASE_URL=https://example.vercel.app CIVIC_IMPORT_SECRET=... npm run import:civic -- --job=candidate-election-daily
```

Do not put secret values in docs or commits.

## Vercel Cron

Cron can call the import route:

```text
/api/admin/civic-import/run?job=candidate-election-daily
/api/admin/civic-import/run?job=voter-registration-monthly
/api/admin/civic-import/run?job=legislative-weekly
```

Recommended schedule:

- daily during election season: `candidate-election-daily`
- monthly: `voter-registration-monthly`
- weekly: `legislative-weekly`

Set `CIVIC_IMPORT_SECRET` in Vercel and protect scheduled calls with a bearer token or `secret` query parameter in environments that support secret injection.

## Conflict Review

Exact source IDs update the matching imported record. The importer versions changed fields in `ImportedRecordVersion`.

If a source update would change a record marked `approved` or `verified`, the importer does not overwrite that record. It creates:

- an `ImportedRecordVersion` with `pending_review`
- a `CivicEntityReview` conflict item
- an import-run `recordsFlaggedForReview` count

Name/office/date matches from different source IDs should be treated as merge suggestions. They should not silently replace existing verified records.

## Verified Data Protection

Manual and verified civic data is protected through `CivicEntityReview.reviewStatus` and `verificationStatus`.

Protected statuses:

- `approved`
- `verified`

When protected fields conflict with new source data, reviewers decide whether to accept the source update, keep the manual value, or request more evidence.

## Admin Monitoring

Use:

- `/admin/data` for source health, import runs, pending review, recent updates, and completeness
- `/admin/sources` for registry health and manual source sync
- `/admin/imports` for run history and counters

Public pages should continue showing source attribution and last-updated labels from stored records only.
