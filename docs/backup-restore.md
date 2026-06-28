# Backup And Restore

Sprint 2I-D-B2 requires verified backup status and an isolated restore smoke test before production trust can be promoted.

## Required Configuration Names

- `DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED`
- `DIRECT_DEMOCRACY_DATABASE_BACKUP_PROVIDER`
- `DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED`
- `DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL`

Do not print values for these settings in logs, docs, generated artifacts, or PR descriptions.

## Commands

```bash
npm run backup:create
npm run backup:audit
npm run restore:smoke-test -- --confirm-restore-smoke-test
npm run restore:audit
```

`backup:create` writes a status/refusal artifact; it does not write plaintext dumps. `restore:smoke-test` must use a separate scratch database, branch, or isolated schema. Never restore into the primary database from this repo.

## Production Gate

Production trust remains blocked until:

- provider-backed backups are verified,
- backup frequency/retention/latest successful backup are known,
- a restore is tested against an isolated target,
- non-sensitive identity/admin counts are validated after restore,
- the primary database was not touched.
