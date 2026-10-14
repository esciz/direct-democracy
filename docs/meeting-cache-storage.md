# Public Meeting Cache Storage

Direct Democracy keeps downloaded public meeting evidence binaries out of git.
Commit the generated manifests and audits, but keep the cache directories local or in object storage.

## Local durable handoff

The local object-store-shaped cache is the default backend:

```bash
npm run meetings:cache-storage:export -- --limit=all
npm run meetings:cache-storage:audit
```

Expected complete status:

- `status`: `object_cache_complete`
- `objectsPresent`: equals the meeting cache record count
- `missingObjects`: `0`
- `objectSizeMismatches`: `0`

The local object cache lives under:

```text
data/private/public-meeting-cache-objects/
```

This directory is intentionally ignored by git.

## Vercel Blob backend

Use Vercel Blob for long-term cloud storage of public meeting source documents.

Required environment:

```bash
PUBLIC_MEETING_CACHE_STORAGE_BACKEND=vercel_blob
PUBLIC_MEETING_CACHE_BLOB_ACCESS=private
BLOB_READ_WRITE_TOKEN=<from Vercel Blob>
```

Alternatively, in a Vercel runtime that supports OIDC:

```bash
PUBLIC_MEETING_CACHE_STORAGE_BACKEND=vercel_blob
PUBLIC_MEETING_CACHE_BLOB_ACCESS=private
VERCEL_OIDC_TOKEN=<provided by Vercel>
BLOB_STORE_ID=<blob store id>
```

Do not commit these values.

Run a smoke upload first:

```bash
npm run meetings:cache-storage:blob-smoke
npm run meetings:cache-storage:blob-audit
```

Then upload the complete cache:

```bash
npm run meetings:cache-storage:blob-export
npm run meetings:cache-storage:blob-audit
```

The supported repeatable operator workflow is:

```bash
npm run meetings:cache-storage:blob-sync
```

This command regenerates the cache manifest, verifies the local object cache, checks network and Blob credentials, runs the smoke upload, performs the full upload when credentials are present, audits Blob coverage, and writes `data/generated/public-meeting-cache-blob-sync.json`.

If the sync stops with `blob_sync_incomplete`, inspect:

```text
data/generated/public-meeting-cache-storage-export.vercel_blob.json
data/generated/public-meeting-cache-storage-audit.vercel_blob.json
```

The export artifact preserves provider error samples, while the audit artifact reports current object coverage in Blob. The upload is content-hash idempotent, so rerunning skips objects that already exist.

Expected complete status:

- `status`: `object_cache_complete`
- `backend`: `vercel_blob`
- `objectsPresent`: equals the meeting cache record count
- `missingObjects`: `0`
- `objectSizeMismatches`: `0`

## Cleanup rule

Do not delete local runtime cache directories until the Blob audit reports complete hash/size coverage.

The ignored runtime/cache directories are:

```text
data/generated/public-meeting-document-cache/
data/generated/public-meeting-document-text-cache/
data/generated/public-meeting-ocr-text-cache/
data/private/public-meeting-cache-objects/
```
