# Data Ethics

Direct Democracy should make civic life easier to understand and government easier to respond to. It must not become a tool for manipulating public opinion or suppressing criticism.

## Core Principles

- Public civic truth must be source-attributed.
- Public sentiment must not be edited by paying customers.
- Government workflow tools must not control public civic records.
- Public-originated actions may create government workflow cases, but cases are not public civic truth.
- Government workflow records may create public status updates, but only through transparency-safe publication rules.
- Verified or manually reviewed data must not be silently overwritten.
- Citizens should retain access to core civic information regardless of customer contracts.
- Individual-level civic sentiment should not be exposed without consent.
- Aggregate analytics should protect people from retaliation or targeting.
- Public comment handling should be auditable.
- Official responses should be clearly attributed.

## Prohibited GovCRM Outcomes

GovCRM features must not allow:

- pay-to-rank issue visibility
- pay-to-improve public ratings
- hiding negative issue trends
- suppressing criticism
- deleting public civic responses
- changing candidate or official records outside reviewed correction workflows
- manipulating voting, question, or sentiment results
- exposing individual citizen sentiment without consent
- exposing internal staff notes, routing, assignments, drafts, sensitive attachments, privileged metadata, or audit-only records
- using tenant workflow controls to suppress public participation

## Allowed GovCRM Outcomes

GovCRM features may allow:

- operational case tracking
- internal public comment categorization
- service request routing
- staff assignment
- department routing
- official response publishing
- aggregate trend review
- compliance exports
- transparency reports
- transparency-safe public status updates such as Received, Under Review, Routed, Awaiting Information, Resolved, or Closed

## Public-to-GovCRM Ethics Boundary

Public users create engagement. Government users process work. Neither side controls the other.

Public actions may become GovCRM intake records when a resident reports an issue, submits a public comment, requests information or records, submits a complaint, reports infrastructure problems, submits application materials, requests service, or suggests candidate/official profile corrections.

The ethical flow is:

```text
Citizen Action
-> GovCRM Intake
-> Case
-> Department Routing
-> Staff Review
-> Official Response
-> Public Status Update
```

Public users may see submission status, official responses, public outcomes, transparency-safe updates, public documents, public meeting records, public issue trends, public sentiment, and public source attribution.

Public users must not see internal staff discussions, internal routing, employee performance information, sensitive investigations, security information, non-public records, draft responses, internal communications, sensitive attachments, privileged metadata, or audit-only records.

Government staff may publish official responses and public outcomes. They may not use GovCRM to alter public sentiment, delete criticism, change public voting results, hide issue trends, suppress participation, or modify candidate/official records outside reviewed, source-attributed workflows.

## Shared Civic Graph Ethics

Direct Democracy Public and GovCRM may both reference jurisdictions, districts, officials, candidates, elections, issues, meetings, public comments, documents, and source records.

Neither product owns civic truth. All public-facing civic information must remain:

- source-attributed
- reviewable
- auditable
- transparent

GovCRM workflow data should be tenant-isolated and permissioned. Public civic data should be transparent and protected from customer manipulation.

## FedRAMP-Ready Ethics Direction

GovCRM should be designed with role-based access control, least privilege, tenant isolation, immutable audit logs, permission boundaries, data classification, and exportable audit history.

This is a readiness direction, not a certification claim. The product must not represent itself as FedRAMP-authorized unless that authorization has been achieved.

## Review Standard

When a feature touches both the public civic layer and GovCRM, default to preserving the public civic record. If a government user submits a correction, response, document, or categorization, it should be stored with attribution and review status rather than treated as unquestioned public truth.
