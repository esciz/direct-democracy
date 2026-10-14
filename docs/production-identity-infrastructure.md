# Sprint 2I Production Identity Infrastructure

Sprint 2I moves the Sprint 2H identity foundation toward production infrastructure without claiming unsupported provider integrations.

## Current Cutover Result

The durable identity/admin-operation migration has been applied from the network-enabled Mac terminal. The current durable cutover audit reports:

- database: `database_reachable`
- identity storage: `schema_ready`
- operation storage: `schema_ready`
- identity migration apply: `ok`, `wrote=true`
- migrated identity rows: 1 account, 1 credential, 4 cutover sessions, 1 role grant, 23 permission grants, and 10 MFA recovery-code hashes

Remaining production-readiness failures are provider/runtime configuration: production email, verification-evidence object storage, encrypted browser-session storage, worker runtime, backup, and restore smoke testing.

Sprint 2I-D adds audit provenance. `production:trust-audit` writes environment/run artifacts and does not update canonical readiness directly. Promote a network-enabled run with:

```bash
npm run audit:promote -- --run-id=<run-id>
```

Sprint 2I-D-B2 also writes a non-sensitive selected-services plan:

```bash
npm run production:trust-plan
```

## Durable Storage

Prisma schema models now exist for:

- identity accounts and credentials
- durable sessions
- permission grants
- verification claims
- consent and profile claims
- organization affiliations
- Trusted Citizen grants
- security events
- privacy requests
- verification evidence metadata
- durable identity/verification jobs

The migration command uses raw SQL through the existing Prisma client so it can create/check identity tables before generated Prisma model types are required.

Operator cutover commands:

```bash
npm run database:diagnose
npm run prisma:migrate:status
npm run prisma:migrate:deploy
npm run identity:migrate -- --dry-run
npm run identity:migrate -- --apply
npm run identity:migration-audit
npm run identity:cutover-audit
npm run identity:storage-audit
```

Production must not silently fall back to `data/private/identity/identity-store.json`. That file remains a development fallback and migration source only.

If Codex reports `environment_network_unavailable`, run the same sequence from a network-enabled terminal or the manual protected workflow `.github/workflows/identity-durable-cutover.yml`. Do not use `prisma migrate reset` for a configured remote database.

## Owner Admin Security

The existing owner admin is preserved. Sprint 2I does not print or regenerate its password.

Full admin access now requires:

- active verified account
- admin permission
- password rotation complete
- MFA enrollment complete when required

If the owner still has `mustChangePassword = true`, admin routes redirect to `/account/security/change-password`. If MFA enrollment is still required, admin routes redirect to `/account/security/mfa/enroll`.

## Email

Email support is provider-neutral.

Required production configuration:

- `DIRECT_DEMOCRACY_EMAIL_PROVIDER`
- `DIRECT_DEMOCRACY_EMAIL_FROM`
- `DIRECT_DEMOCRACY_EMAIL_API_KEY`

Until configured, audits report `email_provider_unconfigured` in production and `development_adapter` in local development.

Use `npm run email:test -- --recipient=<address>` for development/operator adapter testing.

Production readiness requires the worker-backed command:

```bash
DIRECT_DEMOCRACY_NETWORK_ENABLED=true npm run email:production-test -- --recipient=<authorized> --confirm-production-send
```

The recipient must be listed in `DIRECT_DEMOCRACY_EMAIL_TEST_RECIPIENT_ALLOWLIST`. The command creates a hashed expiring token, enqueues an email-delivery job through the durable worker queue, and records only redacted recipient/provider status in generated audits. Production email is not considered configured until this test succeeds.

## MFA

TOTP MFA has an encryption boundary and backup-code hashing helpers.

Required production configuration:

- `IDENTITY_MFA_ENCRYPTION_KEY`

Without this key, enrollment remains blocked and audits report `mfa_encryption_unconfigured`. TOTP secrets and backup codes must never appear in generated artifacts or logs.

## Evidence Storage

Verification-evidence storage is private by design.

Required production configuration:

- `IDENTITY_EVIDENCE_STORAGE_BUCKET`
- `IDENTITY_EVIDENCE_ENCRYPTION_KEY`

The local development adapter requires an encryption key, encrypts bytes with AES-GCM, and stores evidence under `data/private`, not `public` or generated artifacts.

Controls include generated object keys, content type and magic-byte validation, executable rejection boundaries, file-size limits, no public URLs, and purge metadata.

## Worker Queue

Durable job models and a queue boundary exist for:

- email delivery
- residency provider checks
- address normalization
- district mapping
- voter provider checks
- evidence purge
- privacy export
- account deletion/anonymization
- DataOps operations
- OCR processing
- scheduled health checks

Production worker execution remains `worker_unconfigured` until `DIRECT_DEMOCRACY_WORKER_ENABLED` is configured and the durable database schema is ready.

Queue commands:

```bash
npm run worker:once
npm run worker:local -- --limit=5
npm run worker:smoke-test
npm run worker:audit
npm run queue:audit
```

The queue supports idempotency, claim, heartbeat, bounded retries/backoff, cancellation, and dead-letter records. Long-running jobs must run in a worker/operator environment, not request handlers.

The first network-enabled backend path is `.github/workflows/identity-worker.yml`. It can be manually dispatched or scheduled, uses the durable DB queue, and uploads only non-sensitive audit artifacts.

## Browser Session Storage

Playwright session storage is separate from verification evidence storage.

Required production configuration:

- `PLAYWRIGHT_SESSION_STORAGE_BUCKET`
- `PLAYWRIGHT_SESSION_STORAGE_KEY`

Run:

```bash
npm run browser-session:audit
npm run browser-sessions:smoke-test -- --allow-ephemeral-dev-key
```

Storage-state files must not be committed or uploaded as CI artifacts. Generated audits include metadata only.

## Backup And Restore

Run:

```bash
npm run backup:create
npm run backup:audit
npm run restore:smoke-test
npm run restore:audit
npm run secrets:audit
```

`backup:create` and `restore:smoke-test` write truthful status/refusal artifacts when provider-backed backup or separate restore target configuration is missing. The repository does not expose a destructive primary restore command.

## Audits

Run:

```bash
npm run mfa:audit
npm run email:audit
npm run verification:operations-audit
npm run evidence:storage-audit
npm run evidence:smoke-test
npm run browser-session:audit
npm run browser-sessions:smoke-test
npm run worker:smoke-test
npm run worker:audit
npm run queue:audit
npm run backup:create
npm run backup:audit
npm run restore:smoke-test
npm run restore:audit
npm run production:trust-audit
npm run production:readiness-audit
```

Generated artifacts are aggregate/configuration-only and must not include passwords, hashes, tokens, MFA secrets, backup codes, exact addresses, dates of birth, voter-match inputs, private claim values, evidence object URLs, or encryption keys.
