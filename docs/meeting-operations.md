# Meetings are the foundation of civic tracking

Direct Democracy must follow the complete record: official calendar → dated meeting → agenda and packet → minutes and decisions → reviewed official actions → issues, projects, and civic voting. Registration of a calendar is not evidence of coverage, and downloading a PDF is not evidence of an extracted decision.

## September 2026 diagnosis

The September 6 daily run failed while collecting financial data, before importing meetings. The last meeting import was August 29. At the start of this repair the local archive contained 1,056 meetings, only one future meeting, and 449 minutes links. The existing importer could replace history with the current source listing. Retrieval permanently skipped cached documents, and a strict coverage audit could prevent recovery work from running. The minutes audit could count agenda or summary text as minutes.

## Operating loop

```bash
# The complete meeting workflow, independent of financial and case collection:
npm run meetings:refresh -- --limit=100

# Read-only preview of the commands, without collection or artifact writes:
npm run meetings:refresh -- --dry-run

# New public bodies, school calendars, and PTA/PTO source leads:
npm run meetings:sources:discover

# Rebuild archive/minutes/source-check status from current evidence:
npm run meetings:lifecycle

# Recover one source while retaining every other source and historical record:
npm run meetings:import -- --source=nv-cannabis-public-meetings

# Recover scanned minutes for one source without losing earlier OCR results:
node --import tsx scripts/run-public-meeting-ocr.ts --source=carson-city-school-district --document-type=minutes --limit=32 --max-pages=20
node --import tsx scripts/extract-public-meeting-document-text.ts --source=carson-city-school-district
npm run meetings:items:reprocess -- --source=carson-city-school-district
```

The meeting workflow refreshes calendars, imports discovered dates, merges historical records and reviewed manual caches, discovers source documents, retrieves a bounded batch, verifies files, extracts text, attempts OCR, parses numbered agenda/minutes topics, and regenerates civic tracking and audits. OCR keeps a persistent ledger and compares document hashes; source/type filters allow a priority backfill without the statewide queue consuming its batch. Check attempted versus detected pages before treating capped OCR as a complete document. New topics keep document hashes, text paths and source URLs; changes to reviewed items enter `public-meeting-item-review-candidates.json`. Failed commands remain failed in the final report and produce a nonzero exit; remaining recovery work continues. `--meetings-only` excludes independent finance, officials-directory, case, ad, and organization collection.

The cloud workflow in `.github/workflows/civic-data-production.yml` owns scheduled production collection and publication. It checks meetings every six hours and broader civic sources daily, restoring persistent source state and verifying the exact runtime release on the public site. See [launch operations](launch-operations.md) for configuration and recovery. Local commands remain useful for repair, but a desktop collector must not operate as a second independent production writer.

## Source coverage

Keep the existing 17 county/county-equivalent governments, 19 incorporated cities, and 17 county school districts. Expand the body registry beneath those jurisdictions: planning, zoning, licensing, health, transportation, budget, school committees, regulatory workshops, advisory commissions, and subcommittees each need their own identity and source routes.

The added first-party intake includes:

| Source | What it contributes |
| --- | --- |
| [Cannabis Compliance Board](https://ccb.nv.gov/public-meetings/) | Board, Cannabis Advisory Commission, taxation/hemp and other named subcommittees; dated agendas, minutes, cancellations and reschedules. |
| [Department of Taxation](https://tax.nv.gov/boards-meetings/) | Tax Commission and other department meeting pages. Cannabis policy work also appears under CCB, so both roots matter. |
| [Nevada Public Notice](https://notice.nv.gov/) | Discovery of additional public bodies and source links. Leads require source review; they are not automatically published as duplicate meetings. |
| [State Board of Education](https://doe.nv.gov/boards-commissions-councils/state-board-of-education) and [education meeting directory](https://doe.nv.gov/boards-commissions-councils/publicmeetings/) | State education bodies, committees, dated records and additional discovery routes. |
| [School and district directory](https://doe.nv.gov/school-and-district-information) | First-party roots for statewide school-level calendar discovery. |
| [Carson City school calendars](https://www.carsoncityschools.com/families-and-students/calendars) | Published PTA/PTO and parent-organization meetings, with school identity. Routine school holidays and sports are excluded. |
| [Carson City school board](https://www.carsoncityschools.com/our-district/school-board) | Official dated board calendar and linked public folders containing dated agendas and approved minutes. Replaces reliance on the inaccessible legacy BoardDocs route. |
| [Nevada PTA](https://www.nevadapta.org/running-your-pta/pta-basics/) | Parent-organization discovery/contact route. Directory membership does not establish a meeting date or access to private minutes. |

Carson City is the first operational priority; all Nevada jurisdictions remain in the denominator. PTA/PTO meetings remain parent-organization activities, with no assumption that government minutes publication requirements apply.

The source-discovery queue is `data/generated/nevada-meeting-source-discovery.json`. Each lead preserves the source URL, discovery origin, first/last seen times, source category, and review state. Review the parent body, jurisdiction, official calendar, agenda/minutes archives, timezone, parser support, and a real dated sample before adding a source to the registry. A private PTA calendar needs an authorized organizer-provided calendar or reviewed file; never infer a recurring event from last year's schedule.

## Lifecycle and evidence rules

- Preserve previously discovered meetings when source pages disappear, calendars roll over, or requests fail. Absence is not cancellation. Preserve original creation times and evidence links.
- Keep stable provider event IDs where available. Reconcile revised dates and titles against those IDs. Keep distinct bodies on the same day separate.
- Use Pacific local calendar days for Nevada. Meetings with no known end remain on today's calendar until the local day ends. Date-only notices never display an invented time.
- Show confirmed cancellations/postponements separately. Keep undated calendar sources separate from dated upcoming meetings.
- Archive elapsed meetings automatically in the read path. Archiving does not stop minutes collection or delete evidence.
- Check recent missing minutes daily for 45 days, weekly through 180 days, and monthly afterward. A 30-day flag means an operational follow-up target, not a legal deadline. Source calendars may be checked more frequently than individual document refreshes.
- Revisit cached documents for corrections. Preserve hashes and versions. Apply retry backoff and spread retrieval across sources so one broken archive cannot consume the whole batch.
- Bound native PDF extraction in a separate process (15 seconds, 50 MiB source, 384 MiB heap by default). Failures stay visible and the batch continues. Source/document filters support targeted recovery; content-versioned text paths and atomic ledger writes preserve earlier text when a run is interrupted.
- Treat a minutes URL as “link available.” Count extracted minutes only from the actual minutes text; agendas, calendar summaries, snippets and missing files do not qualify.
- Keep named votes, attendance, outcomes and candidate/official attribution tied to identifiable source evidence and review. Do not derive a person's vote from attendance, a unanimous result, an agenda recommendation, party membership, or candidacy.

## Operator views and reports

- `/events`: upcoming meetings, archive, changed schedules, and calendar sources; search includes meeting titles and agenda text.
- `/admin/meeting-health`: source checks and successful checks separately, minutes follow-up, and Carson City prioritization.
- `/admin/meeting-sources`: source registry and existing manual import/review routes.
- `/admin/operations`: “Refresh calendars and minutes” uses the isolated workflow in the configured local operator environment.
- `public-meeting-discovery-state.json`: actual source attempts/successes. Regenerating a report does not advance these timestamps.
- `public-meeting-document-refresh-state.json`: per-document attempts, next due time, success, and failure backoff.
- `public-meeting-lifecycle.json`: upcoming/archive state, missing minutes, source health and next actions.
- `meetings-pipeline-run.json`: complete meeting workflow execution, failed/skipped commands and metrics.
- `dataops-pipeline-run.json`: separate broader civic workflow execution.

The deployment bundle uses `events-runtime.json`, `public-meeting-items-runtime.json`, and `voting-cards-runtime.json` when their full source files are absent. Compact topics preserve IDs, source links, and bounded evidence excerpts. Public topic and question eligibility is the same locally and in deployment; review candidates remain in the full operator datasets. Worker PDF/text caches and local logs are excluded from the web function trace, matching the existing deployment upload exclusions. Source links and runtime/report metadata remain available. `npm run meetings:runtime:publish` rebuilds these **local files** and does not deploy or update a remote site.

Use the focused regression commands before application validation:

```bash
npm run meetings:adapters:nevada:test
npm run meetings:lifecycle:test
npm run events:lifecycle:test
npm run minutes:evidence:test
npm run meetings:items:test
npm run meetings:documents:test
npm run meetings:runtime:test
npm run meetings:ocr:test
npm run meetings:text:test
npm run meetings:pdf:test
npm run typecheck
npm run build
npm run meetings:bundle:audit
```

## Initial repair baseline · September 6, 2026

These historical counts describe the first repair, before the subsequent priority-provider launch pass. Current results are in the generated coverage audits and deployment release record.

The refreshed dataset contains 1,310 meetings: 36 upcoming and 1,274 archived. Every one of the original 1,056 meeting IDs remains accessible directly or through an explicit alias. Minutes links increased from 449 to 586; 528 meeting records have usable minutes text. These are local artifact counts, not a claim about the deployed site.

The Carson school-board collector added 41 meetings, including six published upcoming dates, 36 agenda PDFs, and 32 minutes PDFs. All 32 minutes now have usable text: three native-text documents and 29 scanned documents recovered across all 231 pages without truncation. Twenty older OCR caches affected during version-metadata migration were also rebuilt from their intact PDFs (86 pages); no high/medium-quality text records still point at empty page markers. New text writes use versioned paths to prevent that interruption failure from recurring.

The source-discovery crawl checked 36 pages without transport errors and produced 883 leads, including 849 not yet associated with registered providers. Leads are links for review, not 883 new organizations or meetings. The latest topic pass retained 15,295 items, with no orphan meeting references and one changed reviewed item held for review. Extracted topics and named-action candidates are not equivalent to approved public findings.

All ten focused regression suites, TypeScript checking, and the production build passed. The final event-bundle audit found 385 traced files totaling 255,836,225 bytes, including the source registry and no worker-cache files. Browser checks verified meeting dates, Pacific times, official source links, archive behavior, and the existing core routes. These checks validate the local application and build, not a cloud deployment. The recovery workflow from source-completeness through community/freshness generation also passed every stage. The strict upcoming-coverage audit still reports 35 adapter gaps and 11 priority providers requiring attention; its failed status must not be suppressed to claim launch readiness.

## Priority launch pass · September 7, 2026 UTC

The subsequent local pass repaired all eleven priority collectors: Clark/Washoe schools and commissions, Reno, Sparks, Henderson, Elko city/county, Eureka and NSHE. The resulting archive contains 2,401 meetings: 118 upcoming and 2,283 archived. All 1,319 records present before this pass remain accessible directly or through aliases, with zero ambiguous aliases and zero orphan topic references. Cross-provider school/legislative duplicates and an amended Clark school work session now reconcile to one event while retaining original links and evidence.

There are 691 meetings with usable primary minutes, 23,550 topic records and 16 changed reviewed items held for review. The bounded evidence recovery produced 250 usable newly cached documents, including 159 minutes; another 208 existing cached documents received missing native-text records. Uncached documents remain pending. These different counts describe meetings, topics and documents; they are not interchangeable or automatic approvals of named actions.

The strict upcoming audit still flags two priority providers with no future dates on their current official indexes: Clark Commission and Eureka. Thirty-one broader adapter gaps remain in the statewide report. Never invent recurring dates to clear this audit. Expand tested adapters and review the discovery queue systematically, including school/PTA sources where their organizers publish dates. Exact provider counts and checks are recorded in `public-meeting-priority-recovery.json`; deployed counts must be verified through the release endpoint described in [launch operations](launch-operations.md).

## Public launch gate

A passing build proves that the application compiles. It does not prove statewide meeting coverage or that the live site contains the latest local data.

Before inviting the public:

1. Check the Carson City Board of Supervisors, school board, school/PTA sources, and priority state agencies against their official calendars. Resolve each zero-upcoming source as a verified quiet horizon or a tracked source/parser failure. Do not claim complete statewide coverage while sources remain unresolved.
2. Verify newly discovered agenda and minutes documents through retrieval, text extraction, topic parsing and the applicable review queue. Show “minutes pending” when evidence is missing.
3. Publish the reviewed runtime artifacts through the deployment path, then verify an actual new meeting on the deployed `/events` page, including its source link and local time. Local collection and GitHub artifact upload do not update Vercel's deployed filesystem.
4. For unattended public operation, move the same workflow to a durable worker with persistent source state/document storage and an atomic reviewed runtime publication path. Keep versioned releases and rollback. The repository's existing `publish_runtime_artifacts` operation remains explicitly unavailable until that durable publication/review path is configured; do not silently claim it is active.

The present repair makes the local acquisition and follow-up loop systematic. Production worker/storage/publication and remaining provider adapters are explicit launch work, not a reason to discard or conceal the records already collected.
