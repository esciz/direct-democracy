# Durable Storage And Migration

Sprint 2I-C prepares the durable identity/admin-operation cutover path without claiming provider integrations that have not been exercised.

Codex may be unable to reach the configured database endpoint. Treat `environment_network_unavailable` from `npm run database:diagnose` as an execution-environment blocker, not proof that the database URL or schema is invalid.

## Current Cutover Result

The network-enabled Mac terminal applied `20260621000000_sprint_2i_identity_operations_foundation` and completed `identity:migrate -- --apply` on June 21, 2026.

Migrated durable identity counts:

- 1 account
- 1 credential
- 4 sessions recorded for cutover
- 1 role grant
- 23 permission grants
- 10 MFA recovery-code hashes
- 12 security events

`identity:cutover-audit` reports `durable_identity_ready`. The promoted production trust audit reports identity and operation storage as `schema_ready`, with remaining failures limited to provider/runtime activation: email, evidence object storage, browser-session storage, worker, backup, and restore.

## Audit Provenance And Promotion

Operational audits write environment-scoped and run-scoped artifacts:

```bash
data/generated/audits/<run-id>/
data/generated/production-trust-readiness.codex-sandbox.json
data/generated/production-trust-readiness.local-network-enabled.json
data/generated/production-trust-readiness.github-actions.json
data/generated/production-trust-readiness.production.json
```

`npm run production:trust-audit` no longer updates the canonical artifact directly. Promote a successful network-enabled run explicitly:

```bash
npm run audit:promote -- --run-id=<run-id>
```

Promotion archives the previous canonical `data/generated/production-trust-readiness.json`, requires provenance, rejects sensitive artifacts, and refuses offline/sandbox runs unless an operator explicitly allows offline promotion for a non-production artifact.

## Database Diagnostics

Commands:

```bash
npm run database:diagnose
npm run database:health-audit
```

The diagnostic writes `data/generated/database-connectivity-audit.json` and redacts URL credentials, host parameters, certificates, and query credentials. It uses bounded DNS/TCP checks and a minimal read-only Prisma query. It does not make schema changes.

## Identity Migration

Commands:

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

The migration source remains `data/private/identity/identity-store.json` until the operator explicitly accepts the migration. Do not delete it automatically.

Dry-run reports counts, conflicts, invalid records, and planned writes. Apply uses the durable Prisma schema, preserves password hashes, preserves encrypted MFA material and hashed recovery codes, and records existing local sessions as revoked for cutover. Operators should require a new login and MFA challenge after cutover.

If the database is unreachable from Codex, run the same command sequence from the user's Mac terminal or the protected manual GitHub Actions workflow `.github/workflows/identity-durable-cutover.yml`. The workflow is manual only and only applies the identity migration when `apply_migration` is exactly `true`.

## Local Durable Database For Development

Optional development-only commands:

```bash
npm run database:dev:start
npm run database:dev:status
npm run database:dev:stop
```

These commands use `docker-compose.database.yml` with local PostgreSQL on port `54329`. They do not overwrite `.env.local` or switch a remote `DATABASE_URL`. To use the local database, set `DATABASE_URL` yourself in a local environment file or terminal.

## Admin Operations

Commands:

```bash
npm run operations:storage-audit
npm run operations:cleanup
```

The operation model remains allowlisted. It persists operation type, trigger type, actor, permission snapshot, validated arguments, backend, status, heartbeat, sanitized result summaries, artifact references, and log references. It does not persist arbitrary commands or expose raw unsanitized logs. Production operation creation checks durable operation storage first and fails closed when the Prisma admin-operation tables are unavailable.

## Worker Queue

Commands:

```bash
npm run worker:once
npm run worker:local -- --limit=5
npm run worker:audit
npm run queue:audit
```

The durable queue supports idempotent enqueue, claim, heartbeat, retry/backoff, cancellation, dead-letter state, parent operation linkage, and queue audits. `worker:local` is bounded and intended for development/operator testing, not long-running request handlers.

The first network-enabled worker backend is `.github/workflows/identity-worker.yml`. It runs `database:diagnose`, processes a bounded worker batch, and writes provenance-scoped worker/trust audits. Browser/admin-triggered operations should enqueue work rather than running long jobs inline.

## Email

Commands:

```bash
npm run email:audit
npm run email:test -- --recipient=operator@example.invalid
```

The development adapter writes metadata to a private local outbox. Production delivery is configured only when `DIRECT_DEMOCRACY_EMAIL_PROVIDER`, `DIRECT_DEMOCRACY_EMAIL_FROM`, and `DIRECT_DEMOCRACY_EMAIL_API_KEY` are present. `email:test` refuses production sends unless `--confirm-production-send` is supplied.

One-time email tokens are random, hashed for storage, expiring, and consumable once. Generated artifacts must never contain token values.

## Evidence And Browser Sessions

Commands:

```bash
npm run evidence:storage-audit
npm run evidence:purge-audit
npm run evidence:storage-smoke -- --allow-ephemeral-dev-key
npm run browser-session:audit
npm run browser-sessions:smoke -- --allow-ephemeral-dev-key
npm run secrets:audit
```

Local verification evidence is development-only and encrypted with AES-GCM when `IDENTITY_EVIDENCE_ENCRYPTION_KEY` is present. Production requires private object storage configuration. Evidence controls include content-type/magic-byte checks, executable rejection, max size, hashed object refs, retention metadata, and purge audits.

Playwright/browser session state uses a separate encrypted namespace and key. Storage-state files must not be committed or uploaded as CI artifacts.

## Health And Recovery

Commands:

```bash
npm run database:health-audit
npm run backup:create
npm run backup:audit
npm run restore:smoke-test
npm run restore:audit
npm run sessions:cleanup
```

Backups are reported honestly as `backup_configured` only when `DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED=true`. Restore is reported as `restore_tested` only when `DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED=true`.

Recommended recovery sequence:

1. Take a provider-backed database backup before `identity:migrate -- --apply`.
2. Run `identity:migrate -- --dry-run` and review conflicts.
3. Run `identity:migrate -- --apply`.
4. Require owner/admin users to sign in again and complete MFA challenge.
5. Run `database:health-audit`, `identity:storage-audit`, and `operations:storage-audit`.
6. Keep the local identity source store through the rollback window.

Rollback requires restoring the database backup and disabling durable identity reads. Do not rotate owner password or reset MFA unless migration validation shows encrypted MFA material could not transfer safely.

## Production Trust Rollup

Run:

```bash
npm run production:trust-audit
```

The rollup writes run-scoped and environment-scoped artifacts and reports database, migrations, identity/session storage, admin operation storage, queue depth/dead letters, email, evidence, browser session storage, backup, restore, secret separation, and deliberately disabled features such as official scorecards and hidden vote weighting. The canonical `data/generated/production-trust-readiness.json` changes only through `audit:promote`.
