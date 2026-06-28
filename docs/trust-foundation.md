# Trust Foundation

Sprint 2D formalizes trust as two separate questions:

- Can we trust the evidence?
- Can we trust the participants?

## Evidence Trust

Public meeting evidence is tracked through generated artifacts:

- `data/generated/public-meeting-source-documents.json`
- `data/generated/public-meeting-document-text.json`
- `data/generated/public-meeting-retrieval-queue.json`
- `data/generated/public-meeting-source-health.json`
- `data/generated/public-meeting-ocr-audit.json`
- `data/generated/public-meeting-source-completeness.json`
- `data/generated/public-meeting-accountability-readiness.json`

Remote documents that are not cached are classified as source gaps. OCR-needed documents are classified separately from parser gaps. The pipeline must not infer attendance, votes, or accountability facts from missing or unreadable evidence.

## Participant Trust

Platform roles are defined in `lib/trust/platform-roles.ts`:

- Public
- Verified Resident
- Verified Voter
- Trusted Citizen
- Government
- Admin

Verified Residents and Verified Voters have equal participation rights. Voter registration is a segmentation signal, not a vote-weighting mechanism.

## Claims

Claims are defined in `lib/trust/claims.ts` and support:

- identity claims
- residency claims
- voter claims
- stakeholder claims
- organization claims
- trust claims
- optional demographic claims

Verification should follow this model:

```text
Verify -> Create Claim -> Remove Source Evidence
```

Political affiliation is optional, private by default, never required, never used for weighting, and never used to determine participation rights.

## Security Boundaries

Security controls and data-domain separation live in `lib/trust/security.ts`.

The four data domains are:

- Public Civic Data
- User Identity Data
- Verification Data
- GovCRM Tenant Data

These domains should remain architecturally separate so that compromise or misuse in one domain does not expose all civic, identity, verification, and tenant data.

## Non-Goals

Sprint 2D does not build scorecards, vote weighting, public reputation scores, citizen rankings, or trusted-citizen promotion workflows.
