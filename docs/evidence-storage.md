# Private Evidence Storage

Sprint 2I-D-B2 keeps verification evidence separate from public civic caches, officials source HTML, generated artifacts, browser-session state, identity exports, and GovCRM.

## Required Production Configuration

- `IDENTITY_EVIDENCE_STORAGE_BUCKET`
- `IDENTITY_EVIDENCE_ENCRYPTION_KEY`
- `IDENTITY_EVIDENCE_KEY_VERSION` optional metadata

The MFA, evidence, and browser-session encryption keys must be independent.

## Commands

```bash
npm run evidence:storage-audit
npm run evidence:smoke-test
npm run evidence:purge
npm run evidence:purge-audit
```

Local fixture smoke tests may use:

```bash
npm run evidence:smoke-test -- --allow-ephemeral-dev-key
```

That proves the local encrypted boundary only. It does not make production evidence collection ready.

## Production Gate

Real residency evidence collection remains blocked until the configured private backend proves:

- encrypted upload
- authorized read
- unauthorized read denial
- metadata and hash correctness
- purge removes raw content
- minimum audit metadata remains
- repeated purge is idempotent

Generated audits must never include raw evidence, exact private object references, encryption keys, or user-controlled paths.
