# Sprint 2H Identity Foundation

Direct Democracy keeps public civic browsing open while separating account state, verification state, participation eligibility, analytics cohorts, admin capabilities, and GovCRM tenant data.

## Public Rules

- Logged-out visitors can browse public civic information.
- Account creation alone does not allow civic voting.
- Verified Residents and Verified Voters have the same core participation rights.
- Verified Voter is an analytics cohort, not a heavier vote.
- Trusted Citizen grants stewardship capabilities only; they never change vote weight.
- Optional demographic, stakeholder, organization, and political-affiliation claims are private by default and never required for registration or verification.
- Political affiliation is not used for eligibility, moderation, trust, or vote weight.
- Official accountability scorecards remain disabled.

## Local Development Identity Store

The current implementation uses a development adapter at:

`data/private/identity/identity-store.json`

That path is gitignored. It stores local account credentials, verification claims, consent records, privacy requests, Trusted Citizen grants, and security events for development only.

Generated audit files contain aggregate counts and configuration states only. They must not contain passwords, reset tokens, exact addresses, dates of birth, proof-document contents, voter-match input, or private profile values.

Production status is reported honestly as `durable_identity_storage_unconfigured` until the Prisma schema and deployment database are finalized for the identity boundary.

## Owner Admin Bootstrap

Use:

```bash
npm run admin:bootstrap
npm run admin:bootstrap -- --email=<email>
npm run admin:rotate-password -- --email=<email>
```

In development, the bootstrap command uses `OWNER_ADMIN_EMAIL` when configured; otherwise it creates `owner-admin@direct-democracy.local`.

The command generates a one-time temporary password, stores only a hash, marks the email verified, grants Admin role permissions, and requires password rotation plus MFA enrollment. It is idempotent and will not silently overwrite an existing owner.

Production bootstrap refuses to run unless an explicit production confirmation flag is supplied.

## Verification Providers

Residency and voter verification use provider abstractions. No live official verification provider is configured yet.

Current provider states:

- Residency: `provider_unconfigured_with_manual_review_foundation`
- Voter registration: `provider_unconfigured_requires_verified_resident`
- Evidence storage: `adapter_boundary_present_provider_unconfigured`
- Email provider: `email_provider_unconfigured`
- MFA provider: `mfa_provider_unconfigured`

## Audits

Run:

```bash
npm run admin:auth-audit
npm run identity:audit
npm run verification:audit
npm run privacy:audit
npm run signals:audit
npm run security:audit
npm run trusted-citizen:audit
npm run evidence:purge
```

Primary generated reports:

- `data/generated/admin-auth-audit.json`
- `data/generated/identity-foundation-audit.json`
- `data/generated/verification-foundation-audit.json`
- `data/generated/privacy-controls-audit.json`
- `data/generated/signal-segmentation-audit.json`
- `data/generated/trusted-citizen-foundation-audit.json`
- `data/generated/security-foundation-audit.json`
- `data/generated/production-readiness-audit.json`
