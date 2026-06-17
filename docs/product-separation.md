# Product Separation

Direct Democracy is one codebase today, but the product architecture separates the citizen-first public civic platform from the government-facing GovCRM workflow product.

## Public Civic Layer

The public civic layer is free, citizen-first, and focused on civic understanding and participation.

It includes:

- public civic records
- Who Represents Me
- elections and ballot information
- candidate and official profiles
- issues and actions
- public voting questions
- sentiment and accountability signals
- source attribution and review status

The public layer should not depend on a government customer paying for access. Citizens should not lose access to core civic information if a GovCRM customer cancels.

## Government Workflow Layer

GovCRM is a paid workflow layer for governments, school districts, agencies, and elected offices.

It includes:

- constituent case workflows
- public comment review queues
- staff and department routing
- service request intake
- meeting records and summaries
- official response publishing
- transparency reporting
- compliance and operational exports

GovCRM may read shared civic graph records and attach workflow records to them by reference. It must not take ownership of public civic truth.

## Civic Document Intake Boundary

Civic Document Intake is shared infrastructure used by both product layers.

Direct Democracy Public uses document intake to enrich the public civic graph from public records such as candidate statements, ballot measure documents, campaign finance filings, meeting agendas, meeting minutes, and public comments.

GovCRM uses document intake as a workflow feature for governments that need to digitize submissions, forms, public comments, meeting packets, and service request paperwork.

GovCRM also includes the Submission Engine: configurable service catalogs, resident-facing portal previews, staff intake queues, document/PDF ingestion, optional form-fill workflows, and staff review/routing dashboards.

The boundary is strict:

- GovCRM customers may manage their own document workflow records.
- GovCRM customers may publish official responses and workflow documents they control.
- GovCRM customers may not suppress or alter public civic records derived from public documents.
- Low-confidence OCR, handwriting, and uncertain extraction must go to review before public display.
- Public pages must preserve document source attribution and review status.
- Individual resident submission data must not become public without explicit consent or legal basis.
- Privacy-safe aggregate trends can be shared where they do not expose individual residents or suppress criticism.

## Shared Civic Graph Boundary

The shared civic graph may contain:

- jurisdictions
- districts
- officials
- candidates
- elections
- issues
- meetings
- actions
- public comments
- documents
- source records
- public sentiment summaries

GovCRM workflow data can reference these records through IDs or source-attributed relationships. It cannot silently rewrite them.

## Public-to-GovCRM Boundary

Public-originated actions may create GovCRM cases. GovCRM cases may publish public-facing status updates. That integration does not merge the two data layers.

Public users create engagement:

- report an issue
- submit public comment
- request information
- request records
- submit complaint
- report infrastructure problems
- submit permit or application materials
- submit candidate, campaign, or official profile corrections
- create service, utility, or community issue requests

Government users process work:

- create and manage cases
- route requests to departments
- assign staff
- review documents
- draft and publish official responses
- manage workflow
- generate reports

The standard flow is:

```text
Citizen Action
-> GovCRM Intake
-> Case
-> Department Routing
-> Staff Review
-> Official Response
-> Public Status Update
```

GovCRM may send transparency-safe statuses back to public pages:

- Received
- Under Review
- Routed
- Awaiting Information
- Resolved
- Closed

GovCRM may also publish official responses, public outcomes, public documents, public meeting records, and aggregate issue trends when those items are appropriate for public visibility.

GovCRM must not expose private tenant workflow data on public pages. Private data includes internal staff notes, routing, assignments, security details, internal investigations, compliance notes, drafts, internal communications, sensitive attachments, privileged metadata, and audit-only records.

## Control Boundary

GovCRM customers may not:

- alter public sentiment
- delete criticism
- change public voting results
- modify candidate records outside reviewed correction workflows
- modify official records outside reviewed correction workflows
- hide issue trends
- suppress public participation
- control public issue rankings

GovCRM customers may:

- manage cases
- route requests
- assign work
- publish official responses
- process submissions
- review documents
- generate transparency reports
- view aggregate trends

Public civic records remain source-attributed, reviewable, auditable, and transparent. Government workflow records remain tenant-scoped, permissioned, and private unless intentionally published through a public-safe workflow.

## Security Direction

GovCRM should be built toward public-sector readiness:

- RBAC
- least privilege
- tenant isolation
- immutable audit logs
- permission boundaries
- data classification
- exportable audit history

This is a design direction only. The product must not claim FedRAMP authorization unless authorization is actually achieved.

## Codebase Boundary

For now:

- keep one repository
- keep `/gov` routes gated by `GOV_CRM_ENABLED`
- keep GovCRM out of public navigation unless explicitly enabled
- use empty states when real GovCRM records do not exist
- do not create fake government customers or fake workflow data

Future extraction into separate apps or repos should happen only after the shared civic graph, permission model, billing model, and data governance rules are stable.
