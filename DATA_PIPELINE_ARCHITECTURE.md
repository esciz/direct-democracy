# Data Pipeline Architecture

Direct Democracy keeps ingestion, review, and public runtime delivery as separate layers. This protects public routes from raw archive weight, keeps parser uncertainty visible, and lets admin workflows improve source-backed records without forcing every page request to run import logic.

## Pipeline Layers

1. Source acquisition

Official source pages, meeting archives, agenda packets, minutes, journals, vote pages, campaign-finance documents, and manually saved public records are collected into source-specific folders and generated reports. Public browser-assisted collection must not bypass authentication, CAPTCHA, bot protection, paywalls, or private endpoints.

2. Build-time and admin artifacts

Full source-derived records live in `data/generated/` and raw/manual archives live under `data/raw/`, `data/manual-sources/`, and `data/imports/`. These files can be large and may include packet text, snippets, parser diagnostics, manifests, reports, and review queues.

3. Structured civic records

Importers convert sources into public meeting records, agenda/topic items, topic-level outcomes, financial-impact annotations, official action records, roster reports, and meeting-derived voting cards. Ambiguous extraction is marked for review instead of being promoted automatically.

4. Runtime artifacts

Public pages should use compact runtime files or database/windowed queries:

- `data/generated/voting-cards-runtime.json`
- `data/generated/events-runtime.json`
- `data/generated/current-officials-runtime.json`
- `data/generated/officials-runtime.json`
- `data/generated/carson-city-officials-source-evidence.json`
- `data/generated/carson-city-officials-source-reconciliation.json`
- `data/generated/carson-city-officials-promotion-audit.json`
- `data/generated/public-cases-runtime.json`
- `data/generated/public-court-cases-runtime.json`
- `data/generated/issues-runtime.json`
- `data/generated/issue-review-requests-runtime.json`

These files contain lightweight summaries suitable for public runtime use. They intentionally omit raw PDFs, packet text, large source caches, full reports, and review-only details.

`current-officials-runtime.json` is the public current-officeholder directory. It is separate from `officials-runtime.json`, which may contain historical official-action summaries for meeting accountability. Public officials must be visible even when they have zero parsed votes or official actions. Canonical current-official source evidence is promoted explicitly from verified cached official-directory HTML; sandbox runs with zero downloads cannot overwrite a promoted canonical result.

5. Public and admin route boundaries

Public routes should load only lightweight runtime summaries, approved/review-safe actions, and windowed database records. Admin routes may read richer review data but must not cause raw source archives or build caches to be traced into Vercel functions.

## Runtime Bundle Rules

- Do not statically import large JSON, PDFs, raw HTML archives, packet text, meeting manifests, reports, or source caches into App Router routes.
- Use filesystem reads with ignored absolute path helpers, cached loaders, database queries, or generated runtime artifacts.
- Keep full public-meeting data, packet text, PDF text, source archives, campaign-finance source files, and reports out of serverless function traces.
- Keep `/voting` windowed: initial render should load the active card and queue metadata, then load heavy context lazily when needed.
- Keep Prisma as a shared lazy singleton. Do not create Prisma clients in request handlers, loaders, generated-card utilities, or per-card loops.

## Operational Metrics

Current generated coverage as of 2026-06-19:

| Artifact | Records | Approx Size | Runtime Use |
| --- | ---: | ---: | --- |
| `data/generated/public-meetings.json` | 691 | 1.1 MB | Full/admin/import |
| `data/generated/public-meeting-items.json` | 2,675 | 7.3 MB | Full/admin/import |
| `data/generated/public-meeting-voting-cards.json` | 553 | 2.5 MB | Full/admin/import |
| `data/generated/public-civic-cases.json` | 764 | 1.5 MB | Full/admin/import |
| `data/generated/public-meeting-official-actions.json` | 4 | 4.8 KB | Full/admin/import |
| `data/generated/events-runtime.json` | 691 | 586.5 KB | Public runtime |
| `data/generated/voting-cards-runtime.json` | 553 | 2.0 MB | Public runtime |
| `data/generated/public-cases-runtime.json` | 764 | 979.0 KB | Public runtime |
| `data/generated/public-court-cases-runtime.json` | 25 | 115.7 KB | Public runtime |
| `data/generated/issues-runtime.json` | 17 | 183.7 KB | Public runtime |
| `data/generated/issues-report.json` | 1 | n/a | Admin/report |
| `data/generated/issues-audit-report.json` | 1 | 7.4 KB | Admin/report |
| `data/generated/issue-review-requests-runtime.json` | 0 | 334 B | Public runtime |
| `data/generated/current-officials-runtime.json` | 25 | n/a | Public current officials |
| `data/generated/officials-runtime.json` | 4 | 3.7 KB | Historical official-action runtime |
| `data/generated/public-meeting-provider-report.json` | 14 | 6.7 KB | Admin/report |
| `data/generated/public-meeting-manual-provider-report.json` | 13 | 17.1 KB | Admin/report |
| Retired student-government Office rows cleaned | 3 | n/a | Database cleanup |

Current Vercel/build performance snapshot:

- Vercel CLI local build succeeds.
- Vercel function analysis reports `/voting` at 76.68 MB, below the 250 MB serverless limit.
- Local NFT trace for `/voting` has 0 MB of traced `data/` files.
- Production `/voting` timing after optimization: 1.272 seconds cold, approximately 0.18 seconds warm, 41 KB HTML response.

Provider ingestion snapshot:

- Carson City Board of Supervisors: 480 meetings parsed.
- Washoe County Commission: 17 meetings parsed.
- Washoe County School District Board of Trustees: 57 meetings parsed.
- Manual-cache parsing is active for blocked or browser-assisted providers including Reno City Council, Nevada Legislature, Nevada Senate, Nevada Assembly, Clark County Commission, Las Vegas City Council, Henderson City Council, North Las Vegas City Council, and Sparks City Council.
- Public court-case manifest parsing is active for reviewed public records in `data/manual-sources/court-cases/reviewed-public-cases/`; current output contains 25 reviewed Nevada Supreme Court public appellate opinion records and 0 runtime exclusions.
- Citizen-submitted Issue Review Request parsing is active under `data/manual-sources/issues/review-requests/`; current output is 0 until submissions or manifests are imported. Deprecated community-case manifests are migration-only inputs to the issue importer.
- Issue hub generation is active through `npm run issues:generate`; current output contains 17 source-backed issue hubs derived from imported meeting voting cards, agenda items, and reviewed public court records.
- Issue runtime reporting is active through `npm run issues:report`; current output shows 17 production-visible source-backed hubs, 38 hidden demo/fallback rows, 12 issues with meetings, 8 issues with votes, and 1 issue with court records.
- Current-officeholder generation is active through `npm run officials:audit`; Carson City currently publishes 25 current official/leadership records, including the mayor and four supervisors. `npm run officials:refresh` retrieves, verifies, and reconciles official-directory evidence when network access is available. `npm run officials:promote -- --jurisdiction=carson-city --run-id=<run-id> --confirm=promote-carson-city-officials` is the canonical promotion boundary.

## Change Log

### 2026-06-21 - Carson City Current Officials Runtime

New capability:

- Added current-officeholder generation for Carson City elected governing officials, other elected offices, judiciary offices, and appointed/acting city leadership.
- Added compact public artifacts `data/generated/current-officials-runtime.json` and `data/generated/nevada-community-officials.json`, plus full/admin artifacts `data/generated/current-officials.json`, `data/generated/officials-source-registry.json`, `data/generated/officials-source-health.json`, `data/generated/officials-coverage-audit.json`, and `data/generated/carson-city-officials-root-cause-audit.json`.
- Added npm commands `officials:sources`, `officials:retrieve`, `officials:generate`, `officials:reconcile`, `officials:audit`, `officials:coverage-audit`, `officials:refresh`, `officials:carson-city`, and `officials:promote`.

Accuracy impact:

- Current official visibility no longer depends on parsed votes, motions, or official-action records.
- Appointed and acting leadership is displayed separately from elected governing officials.
- Historical official-action records remain separate so officeholder replacement does not rewrite old votes or attendance.

Operations impact:

- Carson City official-directory sources are registered as DataOps official-directory sources.
- Carson City source evidence is cached only under `data/raw/official-directories`; generated public artifacts contain URLs, hashes, timestamps, and review status, never raw HTML.
- GitHub-hosted runner evidence is classified as `artifact_only_pending_import` until `npm run officials:import-evidence -- --path=<downloaded-artifact-directory>` verifies hashes and imports it into the approved public-source cache.
- Codex network-restricted runs record `blocked_by_network` and do not mark source pages retrieved unless a real cached file exists.

### 2026-06-19 - Existing Issues Runtime Hub And Audit

New capability:

- Added `scripts/generate-issue-hubs.ts` to derive lightweight issue hub runtime records from existing imported meeting voting cards, agenda items, public court records, and issue review requests.
- Added `scripts/audit-issues.ts` to write `data/generated/issues-audit-report.json`.
- Added npm scripts `issues:generate` and `issues:audit`.
- Wired generated issue hubs into the existing `/issues` directory and `/issues/[issueId]` detail helpers instead of creating a duplicate Issue model or route.

Accuracy impact:

- Runtime issue hubs carry source types, relationship counts, related record IDs, sample source URLs, confidence, review status, communities, and policy areas.
- Agenda fragments that cannot map to a civic issue category are skipped instead of becoming one-off public issue hubs.
- Court case tags such as civil appeal, criminal appeal, and original proceeding are clustered into Courts and Legal Rights.

Review process impact:

- `issues-audit-report.json` documents existing schema, UI, data sources, placeholder/demo signals, and the migration plan for the current Issues system.
- `needs_review` remains visible on low-confidence generated issue hubs.
- TopIssueSubmission and IssueFollow remain engagement overlays rather than the canonical source of issue truth.

Public-facing impact:

- Existing Issues URLs and detail pages are preserved.
- `/issues` can now prioritize source-backed civic hubs from real meetings, agenda items, voting cards, and court records.
- Issue detail pages show connected civic record counts and source links when a generated hub is available.

### 2026-06-19 - Public Issue Runtime Gate And Admin Coverage Report

New capability:

- Added `scripts/report-issues.ts` and changed `npm run issues:report` to write `data/generated/issues-report.json`.
- Preserved issue-review-request reporting as `npm run issues:review-requests:report`.
- Added Data Factory issue hub coverage metrics for runtime hubs, production-visible hubs, hidden demo rows, review needs, meeting/vote/court coverage, and source-link gaps.

Accuracy impact:

- Public issue helpers now use `data/generated/issues-runtime.json` as the primary public source and hide demo/fallback issues unless demo mode is explicitly enabled.
- Runtime issue cards carry source count, meeting/vote/court relationship counts, category, confidence, review status, and last updated metadata.

Review process impact:

- `issues-report.json` exposes runtime issue count, source-backed count, demo/fallback count, hidden demo count, issues by jurisdiction, issues by category, relationship coverage, needs-review counts, missing title counts, and missing source-link counts.
- Admins can audit hidden demo/fallback rows while production public users see source-backed records only.

Public-facing impact:

- `/issues` no longer uses mock issues, fake upvotes, or placeholder canonical topic cards in production mode.
- Low-data public states explain that Direct Democracy is still importing meetings, votes, court records, and news, with actions to browse statewide issues, public court records, issue submission, and meetings.

### 2026-06-18 - Cases Reserved For Legal Records And Issues Become Civic Hub

New capability:

- Expanded the modular reviewed manifest source lane for public court records at `data/manual-sources/court-cases/reviewed-public-cases/` to 25 official Nevada appellate opinion records.
- Added Issue Review Requests at `data/manual-sources/issues/review-requests/` with `data/generated/issue-review-requests-runtime.json` and `data/generated/issue-review-requests-report.json`.
- Added `scripts/import-issue-review-requests.ts` and `scripts/report-issue-review-requests.ts`.
- Kept `scripts/import-public-court-cases.ts` scoped to public court/legal records only.
- Added `scripts/report-public-court-cases.ts` plus npm scripts `cases:import-public` and `cases:report`.
- Reserved `/cases` for official public legal records; `/cases/submit` now redirects to `/issues/report`.
- Added `/issues/report` for citizen-submitted issue review requests and surfaced review requests on `/issues`.
- Extended `/admin/data-factory/cases` with manifest/report visibility for source URL, local source file, review status, visibility status, exclusion reason, and notes.

Accuracy impact:

- The import gate accepts only reviewed public records and excludes sealed, confidential, juvenile, protected, non-public, adoption, guardianship, termination-of-parental-rights, and sensitive-identifier risks.
- Public runtime records are metadata-only: title/caption, court, case number, case type, status, key dates, jurisdiction, source link, reviewed date, docket/document references when approved.
- Legal-advice language is not generated; source text and public metadata remain separated from interpretation.
- Citizen concerns are issue review requests, not court records. The issue importer drafts summaries and extracts officials/agencies/jurisdictions/case numbers as review aids only.

Review process impact:

- Court records now follow an explicit source-file plus manifest workflow before publication.
- `needs_review` and `pending_privacy_review` rows are reported but not written to public runtime output.
- Issue Review Requests support submitted, under review, verified, resolved, and archived states.
- Deprecated community-case manifests are converted into issue review requests by `npm run issues:import`.
- The Data Factory can inspect both database review queues and manifest-lane coverage.

Public-facing impact:

- `/cases` displays real reviewed public legal records only.
- `/issues` becomes the civic hub object that can connect citizen submissions to cases, meetings, votes, officials, news, spending, projects, and communities.
- Case detail pages show reviewed source-backed docket/document metadata when present.
- `/issues/report` replaces the old citizen case-submission concept.

### 2026-06-18 - Student-Government And Campus Feature Removal

New capability:

- Removed Student Mode/campus feature inputs from profile, verification, onboarding, organizations, elections, services, and community navigation.
- Removed student/campus organization enum usage from Prisma and domain types.
- Added a raw-SQL cleanup script for retired student-government/campus office enum values and updated public-meeting roster reporting to avoid invalid enum deserialization.

Accuracy impact:

- Runtime identity state is now civic-only: unverified or voter-verified.
- Retired student-government records no longer break public-meeting reporting with Prisma enum mismatches.

Review process impact:

- Public meeting imports still prioritize real government sources; official education/governance archives remain source data, while product-level campus/student-government features stay removed.
- Cleanup can be rerun safely after imports if legacy enum rows appear.

Public-facing impact:

- Public pages no longer route to campus community experiences or surface Student Mode, `.edu` verification, student badges, or campus organization flows.
- Geographic civic context remains the default: community, city, county, school district, state, and federal layers.

### 2026-06-18 - Civic UX, Public Card Language, Jurisdiction Layers, And Public Case Artifacts

New capability:

- Added a plain-language generation pass for meeting-derived voting cards with `public_title`, `public_question`, `source_title`, `source_item_number`, `plain_action`, `plain_purpose`, `citizen_summary`, and `agenda_language_original`.
- Added reusable civic jurisdiction context for City, County, School District, State, Federal, and Special District / Board display.
- Added public civic case extraction from meeting topics/public comments and a compact public-case runtime artifact.
- Added admin public case queue routes and editable voting-card language review controls.
- Added `/communities/[communityId]` routing to the community hub and surfaced meeting intelligence/cases on home and community pages.

Accuracy impact:

- Source agenda language remains preserved as secondary detail while public questions become easier to read.
- Case extraction is conservative, source-backed, redacted, and review-gated by default.
- Public pages use compact artifacts and do not load raw meeting archives or packet text.

Review process impact:

- Voting-card copy can be edited in `/admin/voting-cards` before approval.
- Public civic cases enter `/admin/cases` with review status, source type, confidence, priority, badges, and redacted snippets.
- CSV/JSON case import is represented as a review-gated admin workflow foundation rather than an automatic publish path.

Public-facing impact:

- `/voting`, event detail related cards, home, and community hub views can show cleaner citizen-readable questions.
- Community hubs now include public cases alongside active votes, meetings, decisions, and spending/tax-impact context.
- Jurisdiction labels are more user-centered: My City, My County, My School District, State, Federal, and Special District / Board.

### 2026-06-18 - Runtime Artifact Strategy And Deployment Size Fix

New capability:

- Added runtime artifact generation for voting cards, events, and official actions.
- Added Vercel output tracing exclusions for raw/manual/generated heavy artifacts, build caches, and non-runtime Prisma files.
- Added Prisma Linux binary target support for Vercel builds.
- Replaced `/voting` full-library hydration with a windowed loader that fetches only the active question and total count.

Accuracy impact:

- Runtime artifacts preserve public summaries while keeping full source snippets, review queues, and parser diagnostics in full/admin artifacts.
- Public routes no longer depend on opportunistic read-time import/seeding behavior.
- The system maintains source-backed separation between facts, generated summaries, and review-gated interpretations.

Review process impact:

- Import workflows must regenerate runtime artifacts after public-meeting, official-action, roster, financial-impact, or voting-card changes.
- Admin review still operates on full artifacts; public route performance is no longer tied to full packet/report size.
- Review-only data remains out of public bundles unless explicitly promoted to runtime-safe summaries.

Public-facing impact:

- `/voting` initial load now returns the current card quickly rather than shipping hundreds of cards and heavy context.
- Public functions no longer bundle manual meeting archives, raw PDFs, packet text, provider reports, or full generated meeting files.
- Deployment size is reduced enough for Vercel local build and function analysis to pass.
