# GovCRM Tenant Model

GovCRM is one universal government CRM product. It is not a collection of separate products for cities, counties, school districts, courts, legislatures, universities, agencies, or special districts.

The product uses a shared tenant framework:

- `GovTenant` identifies the workspace.
- `GovTenantType` describes the actor profile.
- `GovTenantProfile` defines workflow emphasis and separation policy.
- `GovTenantModule` and `GovTenantCapability` configure what the workspace can show.
- `GovDepartment`, `GovStaffRole`, and `GovWorkflowType` describe internal routing.

## Tenant Types

Supported tenant types:

- `CITY`
- `COUNTY`
- `SCHOOL_DISTRICT`
- `STATE_AGENCY`
- `LEGISLATURE`
- `COURT`
- `UNIVERSITY`
- `SPECIAL_DISTRICT`

Every tenant receives the universal GovCRM modules: cases, submissions, comments, documents, meetings, reports, and audit log. Tenant type then enables actor-specific modules and capabilities.

Examples:

- City tenants can enable public works, code enforcement, and permits.
- County tenants can enable roads, elections, and county services.
- School district tenants can enable parent requests, board comments, and student services.
- Legislature tenants can enable bill tracking, testimony, and committees.
- Court tenants can enable public inquiry, docket questions, and document requests.
- University tenants can enable student requests, campus governance, and public engagement.
- State agency tenants can enable regulatory comments, licensing, and program inquiries.

## Demo Fixtures

Current fixture tenants are demo/dev only:

- Carson City GovCRM tenant: `CITY`
- Washoe County tenant: `COUNTY`
- Washoe County School District tenant: `SCHOOL_DISTRICT`
- Nevada Legislature tenant: `LEGISLATURE`
- Nevada agency tenant: `STATE_AGENCY`

Fixtures are marked `DEMO_DEV_ONLY`. They are not live government accounts and do not imply real staff access, real publishing, real messaging, or real workflow state.

## Separation From Admin Operations

`/gov` owns customer-facing government CRM workflows only:

- case triage
- assignment
- internal notes
- official response drafting
- comment and submission intake
- document and meeting context
- tenant audit views

`/admin/operations` owns Direct Democracy platform operations:

- DataOps
- ingestion
- source adapters
- evidence acquisition
- OCR/source health
- trust artifacts
- platform audits
- background operation dispatch

GovCRM must not import admin operation runners, ingestion controls, source acquisition workers, or platform DataOps commands.

## Public Civic Record Policy

GovCRM may reference public Direct Democracy civic records as read-only context.

GovCRM must not edit:

- public civic truth
- public votes
- public records
- source attribution
- accountability data
- public sentiment
- candidate records
- ingestion artifacts

Any future publishing or status synchronization workflow must be explicitly audited and separated from public civic records by default.

## Validation

Run:

```bash
npm run govcrm:tenant-audit
```

The audit verifies:

- required tenant types exist
- fixture tenants are demo-labeled
- universal modules are present on every tenant
- public civic record links remain read-only
- GovCRM code does not import admin operations or ingestion controls
