# GovCRM Service Catalog Opportunities

The Submission Engine turns government service catalogs into configurable resident portals, staff queues, document ingestion workflows, and form-fill handoffs. Initial catalogs are scaffolded for Nevada State / Secretary of State, Washoe County, City of Reno, and Carson City, while keeping the architecture reusable for future cities, counties, agencies, school districts, universities, and special districts.

## Nevada SOS Observations

The Nevada Secretary of State service surface has several strong Submission Engine candidates:

- elections information and voter service navigation
- candidate filing guidance
- candidate public media information documents
- campaign finance reporting requirements
- financial disclosure statements
- judicial and non-judicial office filing
- party, committee, initiative, referendum, and petition information
- business entity search, business formation, state business license, UCC, trademarks, and apostille/certification
- notary, securities, document preparation, and complaint workflows
- public records requests, forms, data downloads, and public notices

High-value first workflows:

- candidate media PDF intake into candidate profile enrichment
- campaign finance PDF ingestion into pending review finance context
- candidate filing checklist and document handoff
- public records request tracking

## Washoe County Likely First Services

Likely first Washoe County service catalog opportunities:

- register/check voting info
- view election results
- candidate/local election information
- request public records
- apply for permits
- submit code complaints
- report road, pothole, and public works issues
- animal services complaint/request
- property tax lookup/payment
- marriage and recording services
- board meeting agendas/comments

High-value first workflows:

- public records request intake
- public works issue reporting
- permit/application document upload
- meeting/public comment queue

## City of Reno Likely First Services

Likely first Reno service catalog opportunities:

- start/stop/transfer utility service
- pay utility bill
- report water/sewer issue
- building permit applications
- business license applications
- planning/development applications
- pothole, streetlight, and graffiti reports
- code enforcement complaints
- public comment
- public records requests
- council agendas/minutes
- parks/facility reservations

High-value first workflows:

- utility-start-service guided handoff
- public works issue reporting
- code enforcement complaint intake
- planning/development document intake

## Carson City Likely First Services

Likely first Carson City service catalog opportunities:

- building permits
- land use permits
- public works service requests
- pothole reports
- street lighting issues
- graffiti reports
- business licenses
- community event permits
- public records requests
- board agenda/minutes/records
- public comments
- animal adoption/complaints
- code enforcement complaints
- property tax payment
- court fines and fees
- marriage license/certificate
- current/past elections
- recorder/deeds search
- parks reservations

High-value first workflows:

- permit/application intake
- public works service request routing
- board/public comment processing
- public records request tracking

## Form-Fill Opportunities

Form-fill is most useful when a resident needs to complete a structured government PDF or staff-facing intake form.

Potential workflows:

- utility service start/stop/transfer
- business license applications
- building permit applications
- candidate filing checklists
- public records request forms
- complaint forms
- notary or compliance forms

Rules:

- do not impersonate users
- do not submit into third-party portals without an authorized integration
- generate PDFs or staff review packages only where the agency is enrolled or the workflow is configured

## PDF Ingestion Opportunities

Civic Document Intake connects directly to service actions with `supports_document_ingestion=true`.

Good early PDF ingestion paths:

- candidate statement PDFs
- candidate public media PDFs
- campaign finance filings
- public comment PDFs
- meeting agendas/minutes
- permit applications
- service request attachments

Low-confidence OCR or handwriting extraction must go to review.

## Utility-Start-Service Handoff Opportunity

Utilities often require identity, service address, start date, billing details, and acknowledgements. The Submission Engine can provide a guided form-fill workflow and generate an internal review package or completed PDF where the client authorizes it.

For non-client agencies, the product should provide instructions and official links only.

## Public Records Request Opportunity

Public records requests are a strong cross-agency workflow:

- resident-facing request form
- department routing
- deadline tracking
- communication history
- document upload
- fulfillment status
- transparency reporting

Resident submission data should not become public without consent or legal basis.

## Campaign Finance / Candidate Filing Opportunity

Campaign finance and candidate filing workflows connect the public civic graph and GovCRM:

- public documents can enrich public candidate profiles after review
- filings and statements can become structured source-attributed records
- staff can track incomplete submissions and review tasks

Public candidate and campaign finance facts must remain source-attributed and reviewable.

## Permit / Application Opportunity

Permits and applications often combine forms, PDF attachments, payments, staff review, and department routing. This is a natural GovCRM workflow but should not alter public civic truth unless a reviewed public record is produced.

## Meeting / Public Comment Opportunity

Meeting and public comment workflows can combine:

- agendas
- minutes
- video/transcript links
- public comments
- staff review
- official responses
- transparency reports

Public comments should be auditable. Individual-level data should be handled with privacy controls.
