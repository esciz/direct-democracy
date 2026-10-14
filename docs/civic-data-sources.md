# Civic Data Sources And QA Plan

Direct Democracy uses stored, source-attributed civic records only. Public pages must not scrape during render and must not fall back to fake candidates, officials, districts, civic questions, or issue positions.

## Registry Model

The source registry lives in `Source` and is seeded from `lib/civic-data/source-definitions.ts`.

Tracked fields:

- `name`, `slug`, `url`, `sourceType`
- `jurisdictionId`
- `adapterKey`
- `dataCategory`
- `accessMethod`: `manual_download`, `csv`, `api`, `html`, `pdf`, `arcgis`, or `rss`
- `refreshFrequency`
- `importPriority`
- `isActive`
- `lastCheckedAt`, `lastSuccessAt`, `lastSyncAt`
- `syncStatus`, `errorLog`, `syncCursor`
- `notes`, `metadata`

Import runs live in `SourceSyncRun` and track records found, created, updated, unchanged, flagged for review, error logs, cursor movement, and optional checksum.

Version history lives in `ImportedRecordVersion`. Import jobs compare changed fields, keep previous values, and route protected approved or verified records to review instead of silently overwriting them.

Data quality issues live in `DataQualityIssue`.

## Priority Source Map

| Priority | Source | Purpose | Access | Status |
| --- | --- | --- | --- | --- |
| 1 | Nevada SOS candidate filings | Candidate filings, dates, status, public media info, campaign finance links | HTML/manual download | Registered; parser partially implemented through Nevada SOS adapter |
| 1 | Nevada SOS voter registration statistics | Monthly registration statistics | HTML/manual download | Registered stub |
| 2 | Nevada SOS election results | Official election results | HTML/manual download | Registered stub |
| 3 | Nevada SOS precinct-level results | Precinct reporting data | HTML/manual download | Registered stub |
| 2 | Washoe County voter data | Local candidates, results, registration reports, notices | HTML/manual download | Registered stub |
| 2 | Washoe Open Data boundaries | Precinct, commission, ward, school, and district boundary layers | ArcGIS | Registered stub |
| 4 | Clark County Elections | Local candidates, results, precincts, notices | HTML/manual download | Registered stub |
| 5 | Carson City Government/Elections | Local officials, elections, meetings | HTML | Registered |
| 6 | Nevada Legislature/NELIS | Bills, sponsors, committees, votes, incumbent evidence | HTML/API-like public portal | Registered |
| 6 | OpenStates Nevada API | Legislative backup source | API | Registered stub |
| 7 | Plural Open Data | Legislative cross-check source | API | Registered stub |
| 8 | LegiScan Nevada datasets | Downloaded legislative cross-check | Manual download | Evaluation only |
| 8 | Nevada state/federal official sources | Current officeholders and contact/source URLs | HTML | Registered |
| 9 | Reno Government | Municipal officials, wards, meetings | HTML | Registered |
| 10 | Nevada boards and commissions | Executive/state board records | HTML | Registered |

## Candidate Knowledge Rules

Candidate enrichment may use:

- official campaign websites
- official government profiles for incumbents
- Nevada SOS candidate media info
- candidate-submitted questionnaires
- Ballotpedia as cited secondary reference only
- reputable news as cited context only
- official public social links as source links only

Do not scrape or copy Vote Smart data. Do not invent bios, priorities, issue positions, or follower/sentiment values.

## QA Workflow

`/admin/data` shows:

- Data Sources
- Import Runs
- Pending Review
- Recently Updated Records
- Data Completeness
- Missing Candidate Bios
- Missing Campaign Websites
- Missing District Matches
- Duplicate Candidates
- Stale Sources
- Tracked Data Quality Issues

Quality issue types:

- `missing_required_field`
- `conflicting_source`
- `stale_source`
- `unmatched_district`
- `duplicate_candidate`
- `missing_bio`
- `missing_campaign_site`
- `missing_issue_positions`
- `low_confidence_match`

Manual override tools on `/admin/data` support adding candidate or official website URLs, marking records verified, flagging records for correction, resolving quality issues, and queuing duplicate candidate merge review. Duplicate merge review is intentionally non-destructive until a reviewer confirms the record-level merge.

## Public Display Rules

- Pages read stored/imported records only.
- Public records show source attribution and last updated when available.
- Missing data renders polished empty states.
- Approved/verified manual data is protected from silent importer overwrites.
- Public civic questions must be generated from reviewed real records through the existing `VoteQuestion` system.
- Issue positions reuse the existing issue taxonomy and `IssuePosition`, not a duplicate issue system.

## Scheduling Plan

Vercel cron jobs should call the existing import script/API routes:

- Monthly voter registration stats: `npm run import:monthly-voter-registration`
- Daily candidate/election checks during election season: `npm run import:daily-candidate-elections`
- Weekly county source checks: `npm run import:civic -- --job=county-election-daily`
- Weekly legislative updates during session: `npm run import:weekly-legislative`
- Manual admin run: `/admin/sources` or `/admin/imports`

## Roadmap

1. Finish Nevada SOS candidate filing parser coverage, including candidate public media fields and campaign finance links.
2. Add Nevada SOS voter registration statistics parser.
3. Add Nevada SOS election result and precinct result parsers.
4. Pin Washoe ArcGIS layer URLs and import precinct/district boundaries.
5. Add county election office parsers for Washoe, Clark, and Carson City.
6. Add OpenStates/Nevada Legislature vote imports for incumbent issue-position evidence.
7. Add review tooling for approved candidate issue positions and generated vote questions.
8. Expand public source attribution and stale-data warnings across all affected pages.
