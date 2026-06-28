# Sprint Status

## Completed

- Sprint 2B: meeting extraction and accountability primitives.
- Sprint 2C: source discovery and completeness.
- Sprint 2D: retrieval queue and trust foundation.
- Sprint 2E: DataOps loop and freshness.
- Sprint 2F: cache verification, OCR path, orchestration, scheduler.
- Sprint 2G: secured public admin operations console.
- Sprint 2H: identity, verification, consent, claims, and signal foundation.
- Sprint 2I-A: owner MFA bootstrap and dashboard access recovery.
- Sprint 2I-B: durable identity and admin-operation persistence foundation.
- Sprint 2I-C: durable database migration and identity/admin-operation cutover.
- Sprint 2I-D-A: Carson City officials recovery, current-officeholder runtime, and officials coverage guard.
- Sprint 2I-D-B1: network-enabled officials worker path, Carson City source-evidence retrieval/reconciliation, and canonical officials promotion guard.
- Sprint 2I-D-B1.2: GitHub network worker activation, Carson City live-source promotion, and durable officials evidence handoff.
- Sprint 2I-D-B1.3: Carson City Granicus verification hotfix and repeatable manual sync.
- Sprint 2 source plumbing closeout: priority Nevada sources, officials coverage, meeting cache verification, local durable cache handoff, and Blob-ready export/audit path.
- Sprint 3A: verified participation UX and Trusted Citizen stewardship visibility.
- Sprint 3B: privacy-preserving stakeholder analytics and official-facing aggregate dashboards.
- Sprint 3E: voter verification review console polish and account email verification flow.

## Current

- Launch-readiness cleanup: generated artifact boundaries, local metadata cleanup, docs status reconciliation, and worktree hygiene.

## Planned Next

- Sprint 3C: resident case/story intake moderation and public/private separation polish.
- Sprint 3D: decision review workbench throughput and human-review queues.
- Production Blob cache upload after Vercel Blob credentials are configured.
- Later: official accountability scorecards only after evidence-readiness thresholds are defensible.

## Permanent Parallel Track

- Data Operations, Monitoring, Freshness, Retrieval, OCR, Reprocessing, and Review.
- Current officials, roster freshness, source monitoring, and coverage guards.

## Status Legend

- `implemented`: deterministic local/app behavior exists and passes audits.
- `foundation only`: schema, boundary, or UI readiness exists, but provider/worker integration is not live.
- `provider unconfigured`: a real provider is required before production use.
- `blocked`: environment, credentials, network, or policy prevents completion.
- `planned`: intentionally scheduled for a later sprint.

## Current Production Boundaries

- Durable database migration: applied from the network-enabled Mac terminal on June 21, 2026.
- Durable identity cutover: complete; 1 owner/admin account, 1 credential, 4 revoked cutover sessions, 1 role grant, 23 permission grants, and 10 MFA recovery-code hashes migrated.
- Durable admin-operation storage: schema ready.
- Audit provenance: operational audits write run-scoped and environment-scoped artifacts; canonical trust readiness is updated only by `npm run audit:promote -- --run-id=<run-id>`.
- Email provider: provider unconfigured until `npm run email:production-test -- --recipient=<authorized> --confirm-production-send` succeeds through the durable worker in a network-enabled environment.
- Verification evidence object storage: provider unconfigured; local development adapter encrypts fixture bytes when explicitly keyed. Real residency evidence collection remains blocked until evidence upload/read/unauthorized-read/purge gates pass against the configured private backend.
- Encrypted Playwright/browser session storage: provider unconfigured; fixture smoke tests prove local encrypted round-trip/revocation only.
- Production worker/queue: GitHub Actions worker path exists. Durable jobs can execute allowlisted operations through the existing worker queue; production readiness requires `npm run worker:smoke-test` to claim and complete queued jobs in the durable environment.
- Backup/restore: provider-backed backup and separate restore smoke test are unconfigured until real provider status and isolated restore are verified.
- Residency provider: planned.
- Voter-registration provider: planned.
- Official scorecards: blocked until evidence readiness is defensible.
- GovCRM: separate government-facing product area; public-platform identity and DataOps remain owned by the public platform.
- Current officials: public community pages use `data/generated/current-officials-runtime.json`; historical official actions remain separate in public-meeting artifacts.
- Carson City official-directory recovery: current mayor, four supervisors, elected offices, judiciary offices, and appointed/acting city leadership are source-backed and published with last-verified metadata.
- Canonical officials promotion: `officials:carson-city:sync` is the supported repeatable operator command for retrieval, reconciliation, guarded promotion, community regeneration, and browse audit.
- GitHub officials worker: `.github/workflows/identity-worker.yml` and the admin operation allowlist include durable worker controls. GitHub evidence artifacts remain non-sensitive.
- Generated artifact policy: public runtime data and canonical audits may be committed; environment-scoped audit copies, admin operation logs, raw caches, duplicate downloads, and local metadata stay ignored/local.

## Sprint 2I-D-B2 Operator Checklist

1. Configure selected production email provider and verified sender/domain.
2. Set `DIRECT_DEMOCRACY_EMAIL_PROVIDER`, `DIRECT_DEMOCRACY_EMAIL_FROM`, `DIRECT_DEMOCRACY_EMAIL_API_KEY`, and `DIRECT_DEMOCRACY_EMAIL_TEST_RECIPIENT_ALLOWLIST`.
3. Configure private evidence storage and `IDENTITY_EVIDENCE_STORAGE_BUCKET`.
4. Configure separate `IDENTITY_MFA_ENCRYPTION_KEY`, `IDENTITY_EVIDENCE_ENCRYPTION_KEY`, and `PLAYWRIGHT_SESSION_STORAGE_KEY`.
5. Configure `PLAYWRIGHT_SESSION_STORAGE_BUCKET`.
6. Configure GitHub protected environment secrets and variables for worker execution.
7. Run `npm run worker:smoke-test` in a durable network-enabled environment.
8. Run `npm run email:production-test -- --recipient=<authorized> --confirm-production-send`.
9. Run `npm run evidence:smoke-test` and `npm run evidence:purge-audit`.
10. Run `npm run browser-sessions:smoke-test`.
11. Verify provider-backed backup with `npm run backup:audit`.
12. Run `npm run restore:smoke-test -- --confirm-restore-smoke-test` against an isolated target.
13. Run `npm run production:trust-audit`.
14. Promote only the successful network-enabled audit with `npm run audit:promote -- --run-id=<run-id>`.
