# Direct Democracy Product Architecture

Direct Democracy has two long-term product surfaces that share civic data but serve different users. The public platform remains citizen-first. GovCRM is a separate government-facing workflow product that can help offices respond to the public without controlling the public civic record.

## Direct Democracy Public

Direct Democracy Public is the free citizen-facing civic platform. It exists to help people understand, discuss, and act on real civic information.

Core public modules:

- Who Represents Me district matching
- voting questions and one-question-at-a-time participation
- issue exploration
- action flows
- candidate and official profiles
- elections, ballot measures, courts, and civic records
- public sentiment and community signals
- source transparency, review status, and data completeness

The public platform is not a production government voting system. Vote remains the flagship product action, but public voting results are civic sentiment signals, not official election outcomes.

## Direct Democracy GovCRM

Direct Democracy GovCRM is a separate paid workflow product for local governments, school districts, public agencies, and elected offices.

GovCRM helps government teams manage:

- constituent request tracking
- public comment management
- casework
- meeting intelligence
- issue routing
- transparency reporting
- official responses and service follow-up

GovCRM customers pay for workflow, reporting, routing, and response tools. They do not buy influence over the public civic platform.

## Shared Civic Graph

Both products can read from a shared civic graph containing public civic entities and relationships:

- jurisdictions and districts
- offices and officials
- candidates and elections
- issues and issue taxonomies
- action opportunities
- public sentiment summaries
- meetings and public records when imported
- source documents, review status, and attribution

The shared graph should be treated as source-attributed civic infrastructure. GovCRM may attach government workflow records to the graph, such as cases linked to an issue or district, but GovCRM must not silently rewrite public civic facts.

## Strict Separation Rules

GovCRM and Direct Democracy Public must remain separated by product boundary, permission boundary, and data boundary.

GovCRM customers can:

- respond to constituent cases
- categorize requests
- route work to staff
- publish official responses
- attach documents to government workflow records
- review public comments routed to their organization
- see aggregate issue trends
- generate transparency reports from their own workflow data

GovCRM customers cannot:

- manipulate public sentiment
- hide criticism from public civic pages
- change public voting results
- delete or suppress negative public feedback
- alter candidate, official, election, district, or source records unless separately verified and admin-authorized
- change the public issue taxonomy for their own benefit
- create fake civic records, fake supporters, fake comments, or fake voting questions

Public civic records require source attribution, review status, and data provenance regardless of whether a government customer is involved.

## Data Ethics Rules

Direct Democracy should make government more responsive without giving government customers improper control over public speech or civic memory.

Data ethics rules:

- Public sentiment belongs to the public civic platform, not to GovCRM customers.
- Government workflow data should be clearly distinguished from citizen-facing civic records.
- Official responses should be attributed to the organization or office that published them.
- Corrections to public records should go through the same review and source-attribution path as other civic data.
- Verified or manually reviewed data must not be silently overwritten by imports or customer edits.
- Aggregate reports should avoid exposing sensitive constituent details.
- Public comment moderation should be auditable and should not become viewpoint suppression.
- GovCRM analytics should help offices respond better, not identify critics for retaliation.

## What Governments Can Pay For

GovCRM monetization can include:

- casework inboxes and assignment workflows
- 311-style request intake
- staff collaboration and internal notes
- public comment triage
- meeting agenda, minutes, video, and transcript intelligence
- service request routing
- constituent communication history
- district-level issue reports
- response-time analytics
- transparency portal publishing tools
- official response publishing
- CRM integrations and data export
- administrative controls, retention settings, and audit logs

## What Governments Cannot Control

Government customers cannot purchase:

- removal of criticism from public sentiment
- alteration of public voting or polling data
- suppression of public issue pages
- preferential candidate or official profile treatment
- deletion of public source attribution
- hidden editing access to civic records
- control over whether citizens can compare candidates, officials, issues, or government performance

Any customer-facing correction path must preserve review history, source attribution, and platform accountability.

## Intended GovCRM Models

These models are planned as GovCRM-specific workflow data. They should connect to the civic graph by reference, not replace public civic records.

### GovernmentOrganization

- name
- jurisdiction
- organization_type
- subscription_status

### GovernmentStaffUser

- organization_id
- user_id
- role

### ConstituentCase

- organization_id
- submitter_id nullable
- source
- category
- issue_id nullable
- district_id nullable
- status
- priority
- assigned_to
- summary
- public_visibility
- created_at
- updated_at

### PublicComment

- organization_id
- meeting_id nullable
- issue_id nullable
- submitter_id nullable
- comment_text
- source
- sentiment_label nullable
- review_status

### MeetingRecord

- organization_id
- title
- date
- agenda_url
- minutes_url
- video_url
- transcript_status
- summary_status

## Civic Graph Integration

GovCRM should integrate with existing public modules by reference:

- Issues: categorize cases and comments without changing public issue definitions.
- Actions: route official responses and service requests without overwriting citizen actions.
- Districts: summarize activity by district where reliable district assignments exist.
- Officials: connect offices to casework and response publishing without editing public profile facts.
- Meetings: attach comments, agendas, minutes, transcripts, and summaries when imported.
- Public sentiment: display aggregate trends to government users without allowing edits or suppression.

The platform should preserve a clear distinction between government-authored responses, citizen-created civic signals, and source-imported public records.

## Future GovCRM Modules

Planned modules:

- 311-style request intake
- constituent inbox
- meeting AI summaries
- public records request tracking
- district-level issue reports
- official response publishing
- service request routing
- transparency portal

## Future Monetization Paths

Possible monetization paths:

- GovCRM subscriptions for municipalities, school districts, agencies, and elected offices
- premium workflow modules for casework, public comments, meetings, and reporting
- implementation and data integration services
- transparency portal hosting
- enterprise retention, audit, and export controls
- statewide or regional civic data partnerships

The public civic platform should remain free for citizens. Monetization should improve government responsiveness and data quality without compromising public trust.
