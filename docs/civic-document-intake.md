# Civic Document Intake

Civic Document Intake is the shared document acquisition and extraction module for Direct Democracy Public and Direct Democracy GovCRM.

Government sources often publish civic information as messy PDFs, scanned forms, handwritten filings, saved web pages, campaign finance documents, agendas, minutes, or paper submissions. This system supports manual acquisition and local processing without bypassing bot protections or fetching documents during page render.

## Why This Exists

Civic data often starts as documents, not APIs. Document Intake turns manually acquired public records into reviewable structured fields that can enrich:

- candidate profiles
- official profiles
- issue pages
- campaign finance sections
- voting context cards
- source attribution cards
- GovCRM document workflows

No extracted field should become public civic truth until it has source attribution and review status.

## Manual Acquisition Workflow

1. Open the source page in a normal browser.
2. Download public PDFs, images, HTML, or CSV/JSON manifests manually.
3. Place files in the appropriate local import folder.
4. Run `npm run civic:import-documents`.
5. Review extracted fields in `/admin/documents/review`.
6. Approve, edit, reject, link, or flag fields before public display.

Do not attempt to bypass bot protections. Do not run scraping or OCR during page render.

## Folder Structure

```text
data/imports/documents/
data/imports/nvsos-candidate-media/
data/imports/campaign-finance/
data/imports/meeting-documents/
```

Supported file types:

- PDF
- PNG, JPG, JPEG, TIFF, WEBP
- saved HTML
- TXT
- CSV manifest
- JSON manifest

## Manifest Format

CSV manifests should use this header:

```csv
document_id,civic_entity_type,civic_entity_name,office_or_topic,jurisdiction,document_type,source_name,source_url,local_file_path,election_year,notes
```

JSON manifests may be either an array of document objects or an object with a `documents` array.

## Candidate Media Documents

For Nevada SOS Candidate Public Media Information documents, place manually downloaded files in:

```text
data/imports/nvsos-candidate-media/
```

Then run:

```bash
npm run civic:import-documents
```

The importer attempts to extract:

- candidate name
- office or race
- party
- biography or statement
- campaign website
- email
- phone
- social links
- occupation
- experience
- issues or priorities
- document source URL

Candidate profile content is stored as pending review through `CandidateKnowledgeEnrichment`. Approved or verified content can appear on candidate profiles under Candidate's own words, Bio/background, and Issues/priorities with source attribution.

## Campaign Finance Documents

Place campaign finance filings in:

```text
data/imports/campaign-finance/
```

The importer attempts to extract:

- candidate or committee name
- office or race
- reporting period
- total contributions
- total expenditures
- cash on hand
- PAC or committee names where visible
- filing date
- amended filing flag

Finance totals remain pending review. Do not publish uncertain finance totals without reviewer approval.

## Meeting Documents

Place agendas, minutes, public comment files, and meeting packets in:

```text
data/imports/meeting-documents/
```

Text-based documents may produce summaries or structured fields. Scanned or handwritten files are marked OCR/manual review needed.

## OCR Architecture

The system has pluggable OCR interfaces:

- `LocalOCRProvider`
- `CloudOCRProvider`
- `ManualReviewProvider`

OCR providers are stubs for now. Text-based PDFs are supported first. Scanned and handwritten documents should go to review until OCR confidence and review workflows are mature.

## Review

Reviewers can use:

- `/admin/documents`
- `/admin/documents/review`

Admin review supports:

- approve extracted fields
- edit extracted fields
- reject fields
- link documents to candidates, officials, elections, issues, meetings, or campaign finance records
- mark a source verified
- flag OCR or parse problems
- view original source URL or local file path

## GovCRM Usage

GovCRM uses the same intake capability for government workflow documents:

- paper submissions
- service request forms
- public comments
- meeting packets
- agendas
- minutes
- department routing documents

GovCRM customers can digitize their own workflows, but they cannot suppress or alter public civic records derived from public documents.

## Public Attribution

Every public field derived from a document should show:

- source name
- source URL when available
- document title
- extracted or reviewed date
- verification status

## Known Limitations

- Scanned PDFs without embedded text are marked OCR needed.
- Handwritten forms are not reliably extracted yet.
- Low-confidence fields require manual review.
- The importer does not fetch documents from protected sources.
- The importer does not overwrite verified/manual public civic data.
