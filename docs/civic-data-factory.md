# Direct Democracy Civic Data Factory

The Civic Data Factory is the repeatable import, review, and attribution layer for high-value civic records. It keeps the public app citizen-first while giving admins a durable way to import, inspect, fix, merge, reject, and verify real source data.

## Priorities

1. Candidate Knowledge
2. Campaign Finance
3. Issue Positions
4. Meeting / Agenda / Vote Data

Public pages must read stored data only. No candidate, official, issue, election, voting, or meeting page should scrape or fetch source websites during render.

## Core Models

- `Source`: source registry for government portals, election offices, APIs, RSS feeds, manual-download sources, and local document workflows.
- `SourceSyncRun`: import run history with records found, created, updated, unchanged, flagged, errors, and timestamps.
- `SourceRecord`: normalized raw-source capture with checksum, dedupe key, optional entity link, raw data, normalized data, and review status.
- `ImportedRecordVersion`: record history with previous values, new values, changed fields, source, and review status.
- `SourceAttribution`: field-level source attribution for public trust surfaces.
- `DataQualityIssue`: persisted QA issue for bad or incomplete data.
- `ReviewQueueItem`: human review queue for approval, rejection, verification, merge review, and source attachment.

Verified/manual data must not be silently overwritten. Importers should create versions, flag conflicts, or queue review items when source data disagrees with verified fields.

## Import Commands

```bash
npm run civic:import-candidate-knowledge
npm run civic:review-candidate-knowledge
npm run civic:import-campaign-finance
npm run civic:review-campaign-finance
npm run civic:extract-issue-positions
npm run civic:review-issue-positions
npm run civic:import-meetings
npm run civic:review-meetings
```

The factory runner is `scripts/run-civic-data-factory.mjs`. It orchestrates existing source-specific scripts and document intake jobs, then leaves uncertain data in review.

## Candidate Knowledge

Sources:

- Nevada SOS candidate filings
- Nevada SOS candidate public media documents from manual/local PDF imports
- campaign websites
- official government bios
- Ballotpedia reference links
- NewsAPI/news mentions
- social links

Outputs:

- bio
- candidate's own words
- campaign website
- public contact info
- social links
- issue priorities
- experience/background
- source list
- data completeness score

Approved or verified enrichment can display publicly. Pending enrichment appears only in admin/local preview states.

## Campaign Finance

Sources:

- Nevada campaign finance filings
- Nevada SOS campaign finance pages or manually downloaded PDFs
- FEC for federal candidates
- future FollowTheMoney/OpenSecrets references

Outputs:

- committee
- filing period
- total contributions
- total expenditures
- cash on hand
- top donors if available
- PACs/committees
- filing source
- confidence and review status

Many filings may be PDFs or scanned records, so the first workflow is manual document intake through `data/imports/campaign-finance/` and `npm run civic:import-campaign-finance`.

## Issue Positions

Sources:

- candidate websites
- candidate media documents
- official bios
- legislative votes
- news mentions
- public statements
- campaign finance context

Outputs:

- issue
- position summary
- stance: official, inferred, unknown, mixed, changed
- confidence score
- evidence records
- timeline events
- source attribution

Issue positions reuse the existing issue architecture. Do not create a second issue taxonomy or parallel action/voting model. Approved positions can feed candidate/official profiles, issue pages, actions, and one-at-a-time voting questions.

## Meeting / Agenda / Vote Data

Sources:

- Reno City Council
- Washoe County Commission
- Carson City Board/Supervisors
- school board meetings
- planning commission meetings
- agendas
- minutes
- packets
- videos/transcripts where available

Outputs:

- meeting
- agenda items
- issue links
- official votes
- public comments
- action items
- documents
- source attribution

Manual meeting documents belong in `data/imports/meeting-documents/` until source-specific meeting adapters are approved.

## Admin QA Dashboard

The dashboard lives at `/admin/data-factory`.

Sections:

- Data Sources
- Import Runs
- Candidate Knowledge Gaps
- Campaign Finance Gaps
- Issue Position Gaps
- Meeting Data Gaps
- Duplicate Records
- Conflicting Sources
- Stale Sources
- Unmatched Documents
- Pending Review
- Recently Updated

Rows expose the safe first-step actions: open record, approve, reject, mark verified, rerun import, and queue follow-up actions such as edit, merge duplicate, attach source, or flag issue.

## QA Rules

Bad data checks include:

- duplicate candidate names
- candidate name order mismatch
- missing bio
- missing website
- missing campaign finance
- unmatched source document
- stale source
- conflicting party, office, or race
- low-confidence news match
- low-confidence OCR field
- broken source URL
- missing district match

Low-confidence data should not publish without review.

## Source Explorer

Candidate, official, issue, and election pages can show a Source Explorer section.

It displays:

- source type
- source URL
- last imported
- fields derived from source
- review status
- confidence

This is the public trust layer. It should show polished pending states when records are not imported or not approved yet.

## Refresh Schedule

Election season:

- candidate filings: daily
- candidate knowledge/news: daily or every few days
- campaign finance: daily/weekly near deadlines
- meetings/agendas: weekly
- issue positions: after new candidate source imports

Off-season:

- candidate/official data: monthly
- news: weekly/monthly
- finance: monthly/quarterly
- meetings: weekly/monthly depending on source

## Vercel Cron

Recommended cron jobs:

```json
{
  "crons": [
    { "path": "/api/admin/cron/candidate-election-daily", "schedule": "0 12 * * *" },
    { "path": "/api/admin/cron/voter-registration-monthly", "schedule": "0 12 1 * *" },
    { "path": "/api/admin/cron/legislative-weekly", "schedule": "0 12 * * 1" }
  ]
}
```

Factory-specific cron routes can call the same script/job logic as manual commands. They should require an internal secret and should never run from public page rendering.

## Manual Document Workflow

1. User/admin downloads real source files manually when source access is protected.
2. Files are placed in one of:
   - `data/imports/nvsos-candidate-media/`
   - `data/imports/campaign-finance/`
   - `data/imports/meeting-documents/`
3. Run the matching import command.
4. Extracted fields and source records go to pending review.
5. Admin approves, rejects, edits, verifies, or attaches the source.

Do not attempt to bypass protected browser access.

## GovCRM Intake

GovCRM document intake can support public data when a government customer uploads agendas, minutes, public comments, or source documents. GovCRM users may attach and categorize documents, but they cannot manipulate public sentiment, public voting results, candidate/official source records, or verified public civic data without separate platform-admin authorization.

## Public Display Rules

- no data: polished empty states
- pending data: admin/local preview only
- approved data: public display
- verified data: public display with verified badge

No fake fallback content should appear in production/default mode.
