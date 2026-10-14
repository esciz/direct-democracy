# Direct Democracy Governance

Direct Democracy is being designed as a future two-entity model while staying in one codebase for now.

## Future Entities

### Direct Democracy Foundation

The Foundation is the future nonprofit or public-benefit civic layer. Its purpose is to protect free public civic access, source transparency, voter education, issue exploration, public sentiment, and civic accountability.

The Foundation-aligned public layer includes:

- free public civic information
- Who Represents Me
- elections
- candidate profiles
- official profiles
- issue pages
- public voting and sentiment
- civic actions
- civic education
- open civic data
- source transparency

This layer must remain citizen-first.

### Direct Democracy GovCRM, Inc.

GovCRM, Inc. is the future for-profit government workflow SaaS layer. Its purpose is to help governments, agencies, school districts, and elected offices manage work more responsibly.

The GovCRM layer includes:

- constituent case management
- public comment workflows
- meeting intelligence
- staff task routing
- department routing
- service request intake
- public response tracking
- transparency reports
- compliance and workflow tools

GovCRM customers pay for workflow, not control over public civic truth.

## Shared Civic Graph

Both layers may use shared civic graph data:

- jurisdictions
- districts
- officials
- candidates
- elections
- issues
- meetings
- public comments
- documents
- actions
- source records

Public civic records must remain source-attributed, reviewable, and protected from customer manipulation. GovCRM workflow records may reference shared civic graph entities, but they must not overwrite or suppress public civic data.

Neither Direct Democracy Public nor GovCRM owns civic truth. All public-facing civic information must remain source-attributed, reviewable, auditable, and transparent.

## Public-to-GovCRM Integration Rules

Direct Democracy Public and GovCRM may work together through the shared civic graph, but public civic data and government workflow data are different classes of records.

Core rule:

- Public users create civic engagement.
- Government users process operational work.
- Public-originated actions may create GovCRM cases.
- GovCRM cases may generate transparency-safe public status updates.
- Neither side controls the other.

Public actions that may create GovCRM intake records include:

- report an issue
- submit public comment
- request information
- request records
- submit complaint
- report infrastructure problem
- submit permit or application materials
- candidate or campaign corrections
- official profile corrections
- service requests
- utility requests
- community issue reports

The intended flow is:

```text
Citizen Action
-> GovCRM Intake
-> Case
-> Department Routing
-> Staff Review
-> Official Response
-> Public Status Update
```

GovCRM may publish transparency-safe public statuses such as:

- Received
- Under Review
- Routed
- Awaiting Information
- Resolved
- Closed

Government staff may publish official responses and public outcomes, but publication must be deliberate, attributable, and permissioned.

## Privacy and Security Boundary

The following GovCRM tenant records must remain private unless a separate public-record publication process explicitly approves disclosure:

- internal staff notes
- routing information
- personnel assignments
- security-related details
- internal investigations
- compliance notes
- draft responses
- internal communications
- sensitive attachments
- privileged workflow metadata
- audit-only records

These items must never appear on public Direct Democracy pages by default.

Public users may see:

- submission status
- official responses
- public outcomes
- transparency-safe updates
- public documents
- public meeting records
- public issue trends
- public sentiment
- public source attribution

Public users must not see:

- internal staff discussions
- internal routing
- employee performance information
- sensitive investigations
- security information
- non-public records

## Governance Rules

Government customers cannot:

- alter public sentiment results
- suppress criticism
- delete public civic responses
- pay to improve ratings
- change candidate or official records except through normal verified correction workflows
- hide negative issue trends
- control issue rankings
- manipulate voting or question results
- suppress public participation
- modify candidate records without the review workflow
- modify official records without the review workflow

Government customers can:

- manage constituent cases
- respond to requests
- categorize public comments internally
- route issues to departments
- assign work
- process submissions
- review documents
- publish official responses
- view aggregate public trends
- manage their own meeting and workflow records
- use GovCRM document intake to digitize their own submissions, forms, comments, agendas, and workflow documents
- use GovCRM submission workflows to intake service requests, filings, public comments, forms, and resident requests
- export operational reports

## Permission Direction

Future government roles should manage GovCRM workflow data only:

- `government_admin`
- `government_staff`
- `government_observer`

Future platform roles should administer platform operations and reviewed corrections:

- `platform_admin`

Citizen/public roles should keep access to the core civic platform:

- `public_user`
- `verified_resident`
- `candidate`
- `official`

Government roles must not gain direct write access to the public civic layer. Corrections to public civic records should go through reviewed, source-attributed workflows.

## FedRAMP-Ready Direction

GovCRM should be designed for public-sector security expectations without claiming FedRAMP authorization until that authorization exists.

Design direction:

- role-based access control
- least privilege
- tenant isolation
- immutable audit logs
- permission boundaries
- data classification
- exportable audit history
- explicit public/private publication controls
- source-attributed public record changes

Documentation, product copy, and sales material must not imply FedRAMP authorization unless the product has actually achieved it.

## Civic Document Intake

Direct Democracy may use public documents to enrich the public civic graph, including candidate statements, campaign finance filings, ballot measure documents, meeting agendas, meeting minutes, and public comments.

GovCRM may use the same document intake capability to digitize government workflow documents and make them searchable for authorized staff. This does not give government customers control over public civic records.

GovCRM may also digitize government workflows and submissions through the Submission Engine. Resident submissions, form-fill data, attachments, service requests, and staff notes are workflow records. They must not become public civic data without explicit consent, legal basis, or a reviewed public-record publication workflow.

Document governance rules:

- low-confidence OCR and handwriting extraction must be reviewed before publication
- extracted public fields must preserve source attribution
- public users should be able to see source name, source URL when available, document title, review status, and verification status
- government customers cannot suppress, hide, or alter public civic records derived from public documents
- verified/manual public data must not be overwritten by extracted document fields without review
- privacy-safe aggregate trends may be shared, but individual resident submission data requires purpose limits and access controls
