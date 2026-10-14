# Data Pipeline Architecture

Direct Democracy uses one public-platform pipeline, one identity/admin operation queue, and one durable worker boundary. Sprint 2I-D-B2 does not add a second DataOps, identity, queue, worker, or admin system.

## Existing Flow

1. Admin or scheduler creates an allowlisted operation.
2. Long-running work is queued as a durable `IdentityJob` when appropriate.
3. A worker claims jobs with database locking.
4. The worker records heartbeat, completion, retry, or dead-letter state.
5. Non-sensitive generated audits summarize the result.
6. Reviewed source-backed runtime artifacts are regenerated separately.

## Worker Job Families

- email delivery
- verification-evidence purge
- browser-session health checks
- DataOps retrieval
- officials source refresh
- OCR
- source monitoring
- production trust audits

## Trust-Service Gates

```bash
npm run production:trust-plan
npm run worker:smoke-test
npm run email:production-test -- --recipient=<authorized> --confirm-production-send
npm run evidence:smoke-test
npm run browser-sessions:smoke-test
npm run backup:audit
npm run restore:audit
npm run production:trust-audit
```

The production trust audit reads exercised-state artifacts. Empty or missing smoke-test artifacts are treated as blocked, not ready.
