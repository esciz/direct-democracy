# Data Governance And Trust

The public Direct Democracy platform keeps trust services in the public app boundary, not GovCRM.

## Separation Rules

- Public civic source caches are separate from private identity evidence.
- Current officeholders are separate from historical meeting attendance and vote attribution.
- Browser-session storage is separate from verification evidence.
- Generated public artifacts contain summaries, hashes, counts, statuses, and source references, not secrets or raw private evidence.
- Verified Resident and Verified Voter remain equal-weight cohorts.
- Official scorecards remain disabled until a later explicit readiness decision.

## Audit Provenance

Production trust audits must record:

- run ID
- timestamp
- execution environment
- network capability
- database connectivity
- worker backend
- provider statuses
- git commit
- canonical promotion status

Sandbox or local blocked audits must not overwrite a successful canonical network-enabled audit. Promote only with:

```bash
npm run audit:promote -- --run-id=<run-id>
```

## Production Readiness Rule

Provider adapters and configuration flags are not enough. A service is ready only when the matching smoke test or provider verification has actually succeeded and the generated audit says so without sensitive values.
