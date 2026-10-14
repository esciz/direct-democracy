# Officials Network Worker Setup

Sprint 2I-D-B1.2 and B1.3 activate the network-enabled officials path for Carson City source evidence. Sprint 2I-D-B2 keeps this as a permanent DataOps responsibility through the repeatable local operator command and the existing durable identity worker/admin-operation queue. It does not create a second daily DataOps pipeline.

## One-Time GitHub Setup

1. Push or merge `.github/workflows/identity-worker.yml` to the repository default branch.
2. Confirm GitHub Actions is enabled for the repository.
3. Create a protected GitHub Environment named `officials-production-promotion`.
4. Add required review rules to that environment for promotion runs.
5. Configure only needed secrets and variables.
6. Run `officials:carson-city:sync` from a network-enabled operator terminal, or enqueue the allowlisted `officials_carson_city_refresh` operation.
7. Review `carson-city-officials-source-reconciliation.json`.
8. Promote only after reconciliation is clean and the governing-body guard passes.
9. Confirm `officials-source-health.json` references the promoted run.
10. Confirm the scheduled worker remains enabled.

## Worker Inputs

The durable identity worker accepts only a bounded `limit` input. Source refreshes are queued through allowlisted admin operations; arbitrary scripts, shell commands, branch names, URLs, or workflow names are not accepted as workflow inputs.

## Secrets And Variables

Repository secrets:

- `DATABASE_URL`
- `DIRECT_DEMOCRACY_EMAIL_PROVIDER`
- `DIRECT_DEMOCRACY_EMAIL_FROM`
- `DIRECT_DEMOCRACY_EMAIL_API_KEY`
- `IDENTITY_MFA_ENCRYPTION_KEY`
- `IDENTITY_EVIDENCE_ENCRYPTION_KEY`
- `PLAYWRIGHT_SESSION_STORAGE_KEY`
- `DIRECT_DEMOCRACY_RESTORE_TEST_DATABASE_URL`

Repository variables:

- `DIRECT_DEMOCRACY_WORKER_ENABLED`
- `DIRECT_DEMOCRACY_NETWORK_ENABLED`
- `DIRECT_DEMOCRACY_EMAIL_TEST_RECIPIENT_ALLOWLIST`
- `IDENTITY_EVIDENCE_STORAGE_BUCKET`
- `PLAYWRIGHT_SESSION_STORAGE_BUCKET`
- `DIRECT_DEMOCRACY_DATABASE_BACKUP_CONFIGURED`
- `DIRECT_DEMOCRACY_DATABASE_RESTORE_TESTED`
- `DATAOPS_MAX_DOWNLOAD_BYTES` optional.
- `DATAOPS_OCR_MAX_PAGES` optional.
- `DATAOPS_OCR_TIMEOUT_MS` optional.
- `DATAOPS_INSTALL_OCR_TOOLS` optional.

Environment:

- `production` protects worker secrets.

No secret values should be written to generated artifacts or workflow logs.

## Persistence Modes

Preferred durable path:

- If `PUBLIC_CIVIC_SOURCE_STORAGE=configured` is introduced later, verified official HTML can be persisted in durable public civic-source storage.

Current path:

- Network-enabled local sync caches verified HTML under `data/raw/official-directories/**`.
- The sync writes source manifest, hashes, timestamps, final URLs, reconciliation output, promotion audit, community report, and browse audit.
- Promotion is skipped when source hashes are unchanged.

Supported manual local operator flow:

```bash
cd "/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex"
OFFICIALS_EXECUTION_ENVIRONMENT=local_network_enabled OFFICIALS_NETWORK_ENABLED=true npm run officials:carson-city:sync
npm run typecheck
npm run build
```

`officials:carson-city:sync` is the repeatable network-enabled command for Carson City officials. It refuses to start unless `OFFICIALS_NETWORK_ENABLED=true` and DNS/HTTPS are available, generates the retrieval run ID automatically, passes that same run ID through reconciliation and guarded promotion, stops without promotion when reconciliation conflicts or the governing-body guard fail, skips promotion when canonical source hashes are unchanged, and then runs community regeneration plus browse audit when the canonical data is clean.

`npm run officials:source-verification:audit` writes `data/generated/carson-city-source-verification-diagnostic.json`. The diagnostic records response status, final URL, content type, byte counts, title/signals when available, classifier reason, parser eligibility, and confirms that raw HTML is not embedded in generated JSON. Rejected HTML is stored only under the raw source quarantine path.

GitHub artifact import:

```bash
cd "/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex"
npm run officials:import-evidence -- --path=<downloaded-artifact-directory>
npm run officials:reconcile
npm run officials:coverage-audit
npm run officials:promote -- --jurisdiction=carson-city --run-id=<run-id> --confirm=promote-carson-city-officials
```

The import command verifies the manifest, rejects unsafe paths, recomputes hashes, rejects modified evidence, and copies verified HTML only into `data/raw/official-directories`.

## Troubleshooting

- GitHub source blocking: preserve the diagnostic and use the Mac network path or an approved self-hosted worker. Do not attempt bot-protection evasion.
- Database connection failure: retrieval can still produce artifact evidence, but durable operation status will show blocked/unavailable until database access is restored.
- Missing durable public-source storage: use the artifact import command before promotion.
- Artifact-only result: expected on GitHub-hosted runners until durable public-source storage exists.
- Failed reconciliation: review conflicts before promotion; scheduled runs must not silently promote material conflicts.
- Pending environment approval: approve the `officials-production-promotion` environment only after reviewing reconciliation output.
