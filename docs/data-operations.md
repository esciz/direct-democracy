# Data Operations, Freshness, and Reprocessing

Sprint 2E turns public evidence handling into a repeatable operations loop:

1. Discover known source documents and feeds.
2. Retrieve and cache source material when network access is available.
3. Preserve hashes, versions, timestamps, and original URLs.
4. Extract text and identify OCR/manual-review blockers.
5. Reprocess cached evidence as parsers improve.
6. Audit source health, freshness, and accountability readiness.

## Retrieval Worker

`npm run meetings:documents:retrieve` reads `data/generated/public-meeting-source-documents.json`, attempts a bounded retrieval batch, and writes:

- `data/generated/public-meeting-document-cache-index.json`
- `data/generated/dataops-retrieval-run.json`
- `data/generated/dataops-change-log.json`

The worker never marks a document downloaded unless a real local file exists. If the environment blocks network access, the run records `blocked_by_network` instead of fabricating cache availability.

Sprint 2F hardens retrieval with URL validation, HTTP/HTTPS-only sources, private/loopback host rejection, redirect target validation, request timeouts, download-size limits, stable generated filenames, descriptive user-agent support, and filters:

```bash
node --import tsx scripts/retrieve-public-meeting-documents.ts --limit=100
node --import tsx scripts/retrieve-public-meeting-documents.ts --host=carsoncity.granicus.com
node --import tsx scripts/retrieve-public-meeting-documents.ts --jurisdiction="Carson City, NV"
node --import tsx scripts/retrieve-public-meeting-documents.ts --document-type=packet
node --import tsx scripts/retrieve-public-meeting-documents.ts --retry-only
```

## Document Cache Strategy

Cached records preserve:

- stable local path
- source URL and original provenance
- content hash
- content type and file size
- source version
- first/last seen timestamps
- last changed timestamp
- retrieval attempt counts
- extraction and OCR status

Prior versions are retained in the cache index so corrected or replaced documents keep provenance.

## Cache Verification

`npm run meetings:documents:verify-cache` generates:

- `data/generated/public-meeting-content-verification.json`
- `data/generated/public-meeting-cache-reconciliation.json`
- `data/generated/public-meeting-cache-quarantine.json`

Verification reads the local file bytes and does not trust URL extensions or HTTP headers alone. Classifications include:

- `verified_pdf`
- `verified_html`
- `verified_text`
- `mime_mismatch`
- `html_saved_as_pdf`
- `empty_file`
- `unsupported_binary`
- `probable_error_page`
- `ocr_candidate`
- `quarantined`

## Change Detection

Change detection compares the latest content hash to the previous known hash:

- `downloaded`: first successful retrieval
- `unchanged`: same hash as prior version
- `changed`: different hash from prior version
- `unavailable`: source returns a removed/not-found response
- `blocked_by_network`: runtime could not reach the source

## Monitoring Model

`npm run dataops:monitor` generates:

- `data/generated/dataops-source-registry.json`
- `data/generated/dataops-monitoring-status.json`

Health statuses are:

- `healthy`
- `stale`
- `degraded`
- `failing`
- `blocked`
- `unknown`

The monitoring artifact tracks last check, next check, source health, freshness, document counts, extraction counts, OCR counts, and accountability-readiness impact.

## Statewide Financial Coverage

`npm run financials:nevada:first-pass` performs the launch acquisition for every candidate and current official in the database. It writes:

- `data/generated/nevada-financial-coverage.json`
- `data/generated/nevada-financial-coverage-audit.json`
- cached public source responses under `data/raw/nevada-financials/`

Campaign money and personal financial disclosures are separate evidence layers:

- Federal campaign committees use official OpenFEC totals and cycle history.
- Nevada state, judicial, and local campaign committees use Nevada Secretary of State Aurora as the primary filing authority.
- Transparency USA is a clearly labeled derived cross-check and aggregate adapter for Nevada totals and published top-contributor samples.
- Nonjudicial Nevada personal disclosures use the Secretary of State filing route when the office is covered.
- Judicial personal disclosures use the Nevada Administrative Office of the Courts.
- Federal personal disclosures use the House, Senate, or Office of Government Ethics portal appropriate to the office.

The daily pipeline runs `npm run financials:nevada:collect` once. Direct totals and source routes are checked daily; aggregate and historical-cycle page retrieval is divided into seven deterministic shards so every matched profile is revisited within seven days. Historical periods count only after a candidate-specific cycle page is parsed with nonzero activity. `npm run financials:nevada:audit` verifies that every database candidate and current official has a campaign-finance source route and a personal-disclosure source route. It reports unmatched filing extraction as backlog instead of converting missing data to `$0`.

The official Nevada SOS application can require a browser challenge session. Cached official records remain usable during a blocked session, derived aggregates remain labeled as derived, and a registered search route never counts as a matched filing or financial total.

## Statewide Case Coverage

`npm run cases:nevada:refresh` checks the statewide case-source catalog, reconciles approved public records from the database and generated runtime, and writes:

- `data/generated/nevada-case-coverage.json`
- `data/generated/nevada-case-coverage-audit.json`

The catalog registers Nevada appellate opinions and ACIS, district/justice/municipal court directories for all 17 counties, CourtListener RECAP, official Ninth Circuit opinions, official U.S. Supreme Court dockets and opinions, Nevada Ethics Commission opinions, Tax Commission appeals, and State Bar discipline. A reachable directory counts as a source route, not as a parsed case. Public case cards require an approved, public, source-backed record and deduplicate by court plus case number.

Federal appellate records must carry a verified Nevada connection: a District of Nevada origin or another documented Nevada nexus for Ninth Circuit records, and an official Nevada lower court, Nevada party, or direct Nevada legal connection for U.S. Supreme Court records. Local trial, federal district, and administrative source routes remain separate backlogs. Trial-court collection must stay document-specific and privacy-aware; directory access does not authorize bulk publication of party names, sealed records, addresses, or sensitive case details.

## Statewide Political Ad Coverage

`npm run ads:nevada:backfill` performs the historical launch pass across official FEC independent-expenditure bulk files for the 2012 through 2026 cycles. `npm run ads:nevada` is the scheduled refresh: it checks the current cycle and one stable historical cycle, preserves prior records, falls back to the official FEC bulk file when the API is rate-limited, rebuilds entity matches, and writes:

- `data/generated/nevada-political-ads.json`
- `data/generated/nevada-political-ads-audit.json`
- `data/generated/nevada-political-ad-coverage.json`
- `data/generated/nevada-political-ad-coverage-audit.json`

Coverage is generated for every database candidate and current official. Matching uses local entity IDs, FEC candidate IDs, and normalized names. The public UI separates reviewed creative from filing-only spend/dissemination records. An FEC Schedule E row proves a reported expenditure and described communication; it does not prove that the creative was captured, that every airing or impression occurred, or that a claim was reviewed.

FCC station political files, Nevada SOS expenditures, Meta Ad Library, Google Ads Transparency Center, and reviewed creative intake remain registered source layers. FCC station-level acquisition is pending a Nevada station registry. Meta automation requires approved credentials, and Google creative retrieval requires export or manual review. Those barriers are shown as coverage state instead of being converted to zero ads.

## Public Organization Directory

`npm run organizations:nevada:first-pass` validates the launch catalog and `npm run organizations:nevada:refresh` performs the scheduled shard plus strict audit. Generated artifacts are:

- `data/generated/nevada-public-organizations.json`
- `data/generated/nevada-public-organizations-audit.json`

The launch catalog covers common civic, civil-rights, advocacy, environmental, labor, chamber/business, professional, service, faith, health, youth, veterans, education, service-club, arts/culture, public-institution, public-association, and political-party affiliations. Each row needs an official website or first-party directory source, an involvement or membership route, scope, community links, and provenance.

Official websites are checked in seven stable daily shards. The IRS Nevada Exempt Organizations Business Master File refreshes weekly and is used only to cross-reference legal nonprofit records. An IRS or Nevada business-registry match does not establish current activity, membership size, endorsement, ownership, or political position, and the UI does not synthesize those attributes.

The party-network seed adds the Nevada State Democratic Party and Nevada Republican Party, all 17 county organizations published by each state party, the 14 statewide Democratic caucuses and clubs in the party directory, and the Republican clubs published in the state party directory. State-party records link to party platforms, leadership, county and club directories, party updates, and FEC committee profiles. Platform topics, priorities, leadership, news, and organization relationships from these sites are labeled as party-authored material. A directory listing proves only that the state party published the listing; it does not establish a legal affiliation. The Nevada Republican Club record retains the source directory's explicit “no affiliation” disclosure.

## Official Directory Monitoring

`npm run officials:sources` generates:

- `data/generated/officials-source-registry.json`
- `data/generated/officials-source-health.json`

`npm run officials:retrieve` attempts network retrieval for official-directory pages and writes `data/generated/officials-retrieval-run.json`. A source is marked retrieved only when a real cached HTML file exists. Network-restricted Codex runs record `blocked_by_network`; that is an environment blocker, not a source-health failure.

`npm run officials:reconcile` parses the latest cached Carson City official-source evidence and writes:

- `data/generated/carson-city-officials-source-evidence.json`
- `data/generated/carson-city-officials-source-reconciliation.json`
- `data/generated/carson-city-officials-promotion-audit.json`

The generated artifacts include source URLs, hashes, timestamps, parser status, review conflicts, and promotion eligibility. They do not include raw official-directory HTML.

`npm run officials:promote -- --jurisdiction=carson-city --run-id=<run-id> --confirm=promote-carson-city-officials` is the only command that updates canonical current-official source evidence after network retrieval. Promotion requires verified cached source files, content hashes, successful parsing, the Carson City governing-body guard, and network-enabled or reviewed-manual provenance. A Codex sandbox run with zero downloads cannot overwrite a promoted canonical result.

`npm run officials:audit` regenerates:

- `data/generated/current-officials.json`
- `data/generated/current-officials-runtime.json`
- `data/generated/nevada-community-officials.json`
- `data/generated/carson-city-officials-root-cause-audit.json`
- `data/generated/officials-coverage-audit.json`

Carson City official-directory sources are monitored daily with a weekly full validation recommendation. Admin operations expose `Refresh officials` and `Refresh Carson City officials` through the public platform operations console. Current officials remain separate from historical official actions, attendance, and vote attribution.

Supported network-enabled local operator flow:

```bash
cd "/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex"
OFFICIALS_EXECUTION_ENVIRONMENT=local_network_enabled OFFICIALS_NETWORK_ENABLED=true npm run officials:carson-city:sync
npm run typecheck
npm run build
```

The sync command preserves the lower-level commands while making the manual operator workflow repeatable: retrieval and source verification, reconciliation, coverage audit, guarded promotion, community relationship/report regeneration, and browse audit run in order. It prints one final JSON summary with downloads, cached sources, hashes, parsed officials, conflicts, promotion status, and canonical health. It stops before promotion on conflicts and is idempotent when source hashes are unchanged.

For verification diagnostics, run `npm run officials:source-verification:audit`. For local regression coverage of the Carson City/Granicus verifier, run `npm run officials:source-verification:test`.

Worker-backed admin flow:

- Admin web requests create allowlisted `AdminOperation` records.
- Network officials operations enqueue durable `dataops_operation` jobs.
- The GitHub Actions/local worker claims jobs, heartbeats, retries with backoff, and dead-letters through the existing durable worker queue.
- Long-running source retrieval does not run inside a web request handler.
- GitHub-hosted evidence is uploaded as an artifact handoff and must be imported with `npm run officials:import-evidence -- --path=<downloaded-artifact-directory>` before promotion unless durable public-source storage is configured.

See `docs/officials-network-worker.md` for the GitHub setup guide, required secret/variable names, promotion environment, and troubleshooting flow.

## RSS / Feed Role

`npm run rss:registry` generates `data/generated/rss-source-registry.json`.

RSS is treated as a supplemental freshness and discovery source for official updates, public notices, meeting updates, election updates, press releases, community news, and organization updates. RSS does not replace agenda, minutes, packet, court, election, budget, or campaign-finance ingestion.

## Reprocessing

`npm run dataops:reprocess` records a reprocessing scope in `data/generated/dataops-reprocessing-runs.json`.

Supported scopes include:

- all cached documents
- single source
- jurisdiction
- document type
- extraction method
- accountability outputs

This lets improved OCR, attendance parsing, vote parsing, fiscal parsing, court parsing, issue generation, and accountability generation reuse cached evidence without recollecting source material.

## OCR Unlock Path

`npm run meetings:documents:ocr` now detects OCR tools, runs bounded OCR for verified candidates, and distinguishes:

- no cached binary available
- cached binary exists but OCR is not needed
- cached binary exists and OCR is ready
- OCR runtime unavailable
- manual review needed

OCR text is never faked. When OCR dependencies are missing, the artifact records the blocker.

OCR artifacts:

- `data/generated/dataops-ocr-capabilities.json`
- `data/generated/public-meeting-ocr-results.json`
- `data/generated/public-meeting-ocr-audit.json`

Install/runtime requirements for actual page OCR:

- Poppler utilities: `pdfinfo`, `pdftotext`, `pdftoppm`
- Tesseract: `tesseract`

Downloaded files are treated as untrusted. OCR uses generated local paths, size/page/time limits, safe temporary directories, no shell interpolation, and cleanup after each page render.

## Deterministic Pipeline

`npm run dataops:pipeline` runs the DataOps chain through a single orchestrator and writes `data/generated/dataops-pipeline-run.json`.

Useful modes:

```bash
npm run dataops:pipeline -- --limit=25
npm run dataops:pipeline -- --from=verify-cache --to=ocr
npm run dataops:pipeline -- --offline --from=verify-cache
npm run dataops:daily
npm run sources:refresh:daily
npm run site:launch-audit
npm run meetings:upcoming-audit
npm run meetings:coverage:nevada
npm run meetings:bootstrap:nevada-scheduled
npm run meetings:bootstrap:nevada-sources
npm run dataops:dev
```

The orchestrator records a run ID, network status, stage start/end/status, skips network stages when offline or DNS-blocked, prevents overlapping runs with a lock file, and supports `--from` / `--to` stage ranges. Complete runs write `dataops-pipeline-run.json`; targeted diagnostic runs write `dataops-pipeline-targeted-run.json` so they cannot overwrite evidence of the latest complete daily refresh.

Every run writes `data/generated/nevada-jurisdiction-meeting-coverage.json` and `data/generated/upcoming-meeting-coverage-audit.json`. The statewide contract requires 17 county or county-equivalent governments, 19 incorporated cities, 17 county school districts, and three statewide layers. The audits check the required denominator, each provider independently, the next known meeting, zero-upcoming calendars, source failures, and adapter gaps. A statewide meeting total is never treated as proof that every jurisdiction has current coverage.

The advanced collector starts from official roots verified through the Nevada Association of Counties, Nevada League of Cities, and Nevada Department of Education. It follows bounded meeting-related links, hands off only to known public civic platforms, renders JavaScript pages, captures public JSON loaded by those pages, expands dated API meeting records, downloads linked agendas/packets/minutes, and feeds documents into native text extraction and OCR. CAPTCHA or authenticated content is not bypassed.

## Scheduled Automation

The canonical source refresh runs once daily at 6:00 AM America/Los_Angeles through the active local Codex automation. Daily is recommended because public bodies can post, cancel, or revise meetings with only a few days of notice. Do not add another recurring trigger without first disabling the existing one.

The daily process is:

1. Regenerate and validate the statewide provider registry, refresh every direct/API-capable calendar, and run one of seven deterministic advanced-browser shards.
2. Refresh reviewed case coverage, political-ad records and profile matches, and the public-organization directory.
3. Import direct calendar records and merge reviewed official-source caches.
4. Check every configured provider for upcoming-meeting coverage, then retrieve a bounded batch of changed documents.
5. Verify cache content, extract text, and run bounded OCR where required.
6. Regenerate accountability records, all source-backed issue hubs, community relationships, and public event views.
7. Run issue, event-freshness, browse no-demo, source-health, DataOps freshness, and public site integrity audits.

The public site integrity artifact is `data/generated/public-site-integrity-audit.json`. It separates critical code-integrity regressions from high-severity collection barriers so a clean build cannot be mistaken for complete source coverage. In particular, a registered provider with zero parsed records is reported as a barrier even when no exception was thrown.

Meeting calendars, OpenFEC totals, statewide financial source registration, derived aggregate shards, and source-health checks run daily. Full Nevada SOS filing acquisition should run weekly, or sooner during an active filing window, because it requires a usable browser challenge session. The daily pipeline regenerates the cached finance quality and operational-status reports without retrying blocked live URLs. When `data/generated/nv-sos-operational-status.json` reports `stale_blocked_session`, run `npm run nv-sos:bootstrap` interactively and then `npm run nv-sos:all`; do not schedule repeated blocked fetches.
8. Write `data/generated/dataops-pipeline-run.json`, including required and configured jurisdictions, sources checked, upcoming meetings, source-backed issues, public-record totals, separate Ninth Circuit and U.S. Supreme Court counts, and provider failures.

Direct source checks and statewide coverage audits run once daily. Advanced rendered-browser collection is divided into seven stable shards, so every provider receives an advanced pass at least once every seven days without adding a second recurring job. `npm run meetings:bootstrap:nevada-sources` remains the explicit full-state recovery command.

`.github/workflows/dataops-daily.yml` remains a manual recovery hook. It can execute the same pipeline, refresh official-directory sources, typecheck the repo, and upload generated artifacts, but it has no recurring schedule. It does not push generated files to the primary branch; promotion into the deployed public runtime still requires the existing reviewed deployment path until durable production source storage is configured.

`.github/workflows/identity-worker.yml` provides the first durable trust-service worker path. It runs from a protected environment, diagnoses database reachability, claims bounded durable jobs, heartbeats through the existing identity queue, and uploads only non-sensitive worker/trust audit artifacts.

Operational audits now include provenance and write run-scoped artifacts under `data/generated/audits/<run-id>/`. The canonical production trust artifact is updated only through:

```bash
npm run audit:promote -- --run-id=<run-id>
```

Do not promote Codex sandbox runs as production readiness.

## Admin Operations Console

Sprint 2G adds the platform admin operations console at `/admin/operations`. This belongs to the public platform admin surface, not GovCRM.

The console uses:

- server-side admin session checks
- admin permission checks under the existing Admin role
- allowlisted operation IDs
- validated arguments only
- local JSON-backed operation records for development
- sanitized stdout/stderr log capture
- explicit backend states for local process, GitHub Actions, and future production workers

Production limitations are reported honestly:

- `worker_unconfigured`
- `github_actions_worker_available_pending_run`
- `durable_storage_unconfigured`
- `encrypted_session_storage_unconfigured`

The admin runner never accepts arbitrary shell commands or browser-submitted workflow names.

## Ingestion Capability Registry

`npm run ingestion:registry` generates:

- `data/generated/ingestion-capability-registry.json`
- `data/generated/ingestion-coverage-report.json`
- `data/generated/source-adapter-health.json`

Every registered source receives an acquisition adapter, acquisition mode, trigger path, execution backend recommendation, health state, manual fallback, and review requirement.

## Guided And Manual Acquisition

Guided/browser acquisition is a fallback, not the default downloader. Direct HTTP/API/RSS retrieval should be used wherever possible.

Playwright modes are represented as operation boundaries:

- public browser adapter for JavaScript-rendered public pages
- authenticated session bootstrap for authorized portals only

Session-state rules:

- never commit Playwright storage state
- never upload raw session state as public artifacts
- do not log cookies, tokens, or authorization headers
- do not bypass CAPTCHA, paywalls, access controls, private endpoints, or bot protection
- classify blocked sources for guided/manual acquisition instead

Manual URL/file/manifest imports are review-gated and must pass cache verification, MIME/magic-byte checks, hashing, quarantine rules, extraction, and OCR readiness before any public runtime promotion.

## Publication Boundary

Successful ingestion does not automatically publish ambiguous records. The promotion boundary remains:

reviewed source-backed records -> compact runtime generation -> audit -> public eligibility

Official scorecards remain blocked until a later readiness decision explicitly enables them.

## Scheduled Ingestion Guidance

Current production cadence:

- canonical pipeline: once daily
- meeting direct/API and source-health checks: once daily
- advanced rendered-browser meeting collection: one stable shard daily, every provider within 7 days
- campaign finance: weekly, with manual session recovery when challenged
- cached document extraction and OCR: once daily
- RSS/public notices: once daily until a separate approved scheduler replaces the canonical job

Suggested loops:

- `npm run dataops:dev`
- `npm run dataops:daily`
- `npm run dataops:audit`

## Known Limitations

Network-restricted environments can generate truthful queue, cache, freshness, and blocked-network artifacts, but cannot increase downloaded document counts from remote sources. Actual source-gap reduction requires network-enabled retrieval or preloaded local source files.

## Production Trust Worker Boundary

Sprint 2I-D-B2 keeps DataOps, officials refresh, email delivery, evidence purge, browser-session health checks, OCR, and production trust audits on the existing durable queue instead of introducing a second worker system.

Operator commands:

```bash
npm run production:trust-plan
npm run worker:smoke-test
npm run worker:audit
npm run production:trust-audit
```

`production:trust-audit` reports readiness from exercised artifacts: email must pass `email:production-test`, evidence and browser sessions must pass smoke tests, the worker must claim and complete durable jobs, and backup/restore must be verified. Adapter presence alone is not a ready state.
