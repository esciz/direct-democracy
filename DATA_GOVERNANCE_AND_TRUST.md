# Data Governance And Trust

Direct Democracy uses public-source civic records to power voter-facing cards, public meeting intelligence, official accountability views, and admin review queues. The product must keep a clear boundary between source-backed facts, parser-derived interpretations, and human-reviewed public outputs.

## Governance Principles

- Prefer official government sources, public archives, public meeting portals, official agenda packets, minutes, journals, vote pages, and published campaign-finance records.
- Preserve source attribution for every imported public record whenever a source URL or local cached source path exists.
- Do not invent officials, votes, donor records, outcomes, summaries, or financial/tax impacts.
- Keep ambiguous parser output review-gated and label it as needing review instead of publishing it as fact.
- Keep student-government/ASUN removal guard in place for public-meeting and official-action ingestion.
- Separate public runtime artifacts from build-time or admin-only archives so large raw documents are not bundled into public serverless functions.

## Review Standards

Public-facing records can be shown when they are source-backed and either explicitly reviewed or high-confidence under a narrow parser rule. Admin-only queues are required for low-confidence PDF chunks, unclear vote language, unmatched officials, roll-call ambiguity, fiscal-impact ambiguity, and generated public questions that lack enough context.

Official-level action records require explicit named actors in the source text. Surname-only matches may be suggested or auto-approved only when the meeting body/jurisdiction narrows the candidate pool to one clear official; otherwise they remain review-gated.

Financial and tax/cost context must be cautious. If the source does not explicitly state a direct property-tax, sales-tax, fee, bond, debt, or long-term cost impact, public cards must say that the direct voter impact is not stated or needs review.

## Operational Metrics

Current generated coverage as of 2026-06-19:

| Metric | Count / Size | Source |
| --- | ---: | --- |
| Public meeting records | 691 | `data/generated/public-meetings.json` |
| Agenda/topic item records | 2,675 | `data/generated/public-meeting-items.json` |
| Meeting-derived voting cards | 553 / 2.5 MB | `data/generated/public-meeting-voting-cards.json` |
| Review-gated public civic cases | 764 / 1.5 MB | `data/generated/public-civic-cases.json` |
| Official action records | 4 | `data/generated/public-meeting-official-actions.json` |
| Runtime event summaries | 691 / 586.5 KB | `data/generated/events-runtime.json` |
| Runtime voting-card summaries | 553 / 2.0 MB | `data/generated/voting-cards-runtime.json` |
| Runtime public case summaries | 764 / 979.0 KB | `data/generated/public-cases-runtime.json` |
| Runtime public court case summaries | 25 / 115.7 KB | `data/generated/public-court-cases-runtime.json` |
| Runtime source-backed issue hubs | 17 / 183.7 KB | `data/generated/issues-runtime.json` |
| Issues runtime report | 1 | `data/generated/issues-report.json` |
| Issues audit report | 1 / 7.4 KB | `data/generated/issues-audit-report.json` |
| Runtime issue review requests | 0 / 334 B | `data/generated/issue-review-requests-runtime.json` |
| Runtime official-action summaries | 4 / 3.7 KB | `data/generated/officials-runtime.json` |
| Provider report entries | 14 | `data/generated/public-meeting-provider-report.json` |
| Manual provider report entries | 13 | `data/generated/public-meeting-manual-provider-report.json` |
| Retired student-government Office rows cleaned | 3 | `npm run data:cleanup-student-government` |

Provider coverage snapshot:

- Carson City Board of Supervisors: 480 discovered and parsed meetings, 331 minutes parsed, 294 agenda packets parsed.
- Washoe County Commission: 17 discovered and parsed meetings, 17 minutes parsed, 17 agenda packets parsed.
- Washoe County School District Board of Trustees: 57 discovered and parsed meetings, 57 minutes parsed, 57 agenda packets parsed.
- Manual-cache providers currently include Reno City Council, Nevada Legislature, Nevada Senate, Nevada Assembly, Clark County Commission, Las Vegas City Council, Henderson City Council, North Las Vegas City Council, Sparks City Council, and related Nevada providers.
- Roster report currently shows 7 seeded roster bodies, 44 seeded/imported roster members, and 100% coverage for the bodies represented in the roster report.

Review caveats:

- Many meeting-derived voting cards remain review-gated until question status, outcome status, and tax/cost status are explicitly promoted.
- Official action records are currently sparse and should not be treated as comprehensive vote history.
- Roll-call extraction and low-confidence PDF packet parsing remain admin-review priorities.
- Public court-case coverage currently includes 25 reviewed Nevada Supreme Court public appellate opinion records from the official Nevada Appellate Courts public portal.
- Citizen-submitted concerns now flow into Issue Review Requests, not Cases. Current issue review request runtime coverage is 0 until submissions or manifests are imported.
- Issues now include 17 source-backed generated civic hubs derived from imported meetings, agenda items, meeting voting cards, and reviewed public court records. Low-confidence generated hubs remain marked for review.
- Public Issues production visibility is runtime-only by default: 17 source-backed hubs visible, 38 demo/fallback issue rows hidden unless `NEXT_PUBLIC_ENABLE_DEMO_MODE=true`.

## Change Log

### 2026-06-19 - Existing Issues Promoted To Source-Backed Civic Hubs

New capability:

- Audited the existing Issues implementation without creating a parallel Issue model or route tree.
- Added `data/generated/issues-audit-report.json` to document current schema, UI surfaces, demo assumptions, generated data, and migration strategy.
- Added `data/generated/issues-runtime.json` as a lightweight runtime layer that enriches existing `/issues` pages with source-backed issue hubs from meeting voting cards, agenda items, and reviewed public court records.
- Added `npm run issues:generate` and `npm run issues:audit`.
- Removed student/campus canonical issue topics from the issue taxonomy and expanded civic categories for government accountability, criminal justice, education, elections, environment, infrastructure, transportation, taxes/spending, land use/zoning, and courts/legal rights.

Accuracy impact:

- Issue hubs now preserve relationship counts and source links back to meetings, agenda items, voting cards, court records, issue review requests, and source documents instead of relying only on demo issue rows.
- Low-confidence agenda-derived hubs are marked `needs_review`.
- Citizen submissions remain Issue Review Requests and are not presented as verified facts.

Review process impact:

- The audit report identifies the absence of a standalone Prisma `Issue` model and recommends keeping existing issue text/slug matching plus generated runtime relationships until persistence requirements justify schema changes.
- Generated issue hubs are review-aware and can be promoted later without breaking existing `/issues` URLs.
- Mock top issues remain demo fallback material rather than the canonical issue source.

Public-facing impact:

- `/issues` continues to use the existing route and cards while showing source-backed hubs from real civic data.
- Issue detail pages now show a source-backed civic record panel with connected meetings, agenda items, voting cards, court records, source documents, source types, confidence, and sample source links when available.

### 2026-06-19 - Public Issues Runtime Gate And Report

New capability:

- Gated demo/mock/canonical fallback issues behind explicit demo mode using `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` or `ENABLE_DEMO_MODE=true`.
- Added `data/generated/issues-report.json` through `npm run issues:report`.
- Added admin Data Factory issue coverage metrics for runtime hubs, production-visible issues, source-backed issues, hidden demo rows, review needs, relationship coverage, and missing source links.

Accuracy impact:

- Production public `/issues` now displays only source-backed runtime issue hubs from `data/generated/issues-runtime.json`.
- Mock engagement counts, fake supporter totals, and placeholder issue cards are hidden in production public UI.
- Empty states now explain when a community has no source-backed issues rather than filling the page with demo rows.

Review process impact:

- `issues-report.json` tracks runtime issue count, public source-backed count, demo/fallback count, hidden demo count, issues by jurisdiction/category, relationship coverage, issues needing review, missing plain-English titles, and missing source links.
- Admins can still inspect demo/fallback counts and relationship coverage without exposing those rows publicly.

Public-facing impact:

- Public issue cards show category, source count, linked meetings, linked votes, linked court records, confidence/review badge, last updated, and why-this-matters text.
- Issue detail pages now separate source-backed facts, platform explanation, and community input.

### 2026-06-18 - Cases Reserved For Legal Records And Issues Become Civic Hub

New capability:

- Expanded the reviewed public court-case manifest lane to 25 approved Nevada appellate opinion records from the official Nevada Appellate Courts public portal/API.
- Reserved `/cases` for official legal and quasi-legal records only.
- Added Issue Review Requests as the citizen-submitted intake lane under `data/manual-sources/issues/review-requests/`.
- Added `npm run issues:import` and `npm run issues:report` for issue review request runtime/report generation.
- Added `/issues/report` for citizen issue intake with title, category, community, supporting materials, optional explanation, and post-submit AI/review extraction.
- Deprecated Community Cases as a public concept; old community-case manifests are migration-only inputs to the issue importer.
- Surfaced manifest row status, source URL/file, visibility status, exclusions, and notes in `/admin/data-factory/cases`.

Accuracy impact:

- Public court records now require `reviewStatus` of reviewed/approved/verified plus `publicVisibilityStatus: public` before runtime publication.
- The importer excludes records with sealed, confidential, juvenile, protected, non-public, adoption, guardianship, termination-of-parental-rights, or sensitive identifier signals.
- Public court summaries remain metadata-only and include no legal advice or inferred sensitive details.
- Citizen concerns are issue objects, not case records. Issue import performs draft extraction for agencies, jurisdictions, and court case numbers while keeping AI summaries review-gated.

Review process impact:

- Manual court source files must be stored beside a manifest entry before import.
- Ambiguous rows should stay `needs_review` or `pending_privacy_review`; they are counted in reports but excluded from public runtime output.
- Issue Review Requests follow submitted, under review, verified, resolved, and archived statuses.
- Supporting evidence remains review-gated and should be redacted before public use.
- Admin review can inspect manifest rows alongside existing court-source, privacy-warning, pending-document, stale-check, and duplicate queues.

Public-facing impact:

- `/cases` shows only official public legal records.
- `/issues` becomes the civic hub layer for citizen submissions, public concerns, policy topics, and cross-dataset linking.
- `/issues/report` replaces `/cases/submit` for citizen-submitted matters; `/cases/submit` redirects there.
- Public cards show reviewed court metadata including court, case number, case type, status, filed/disposition dates when present, source link, and jurisdiction.

### 2026-06-18 - Student-Government And Campus Feature Removal

New capability:

- Removed Student Mode, campus community profile association, `.edu` verification UX, campus organization creation, campus routes, and campus-only voting/event surfaces from the product.
- Added `npm run data:cleanup-student-government` to repair retired `Office.level` database rows without Prisma enum deserialization.
- Hardened public-meeting roster reporting so retired student-government/campus office levels do not trigger Prisma enum mismatch logs.

Accuracy impact:

- Civic identity now resolves only to unverified or voter-verified states, preventing student/campus verification from being mistaken for civic eligibility.
- Existing retired student-government office rows are migrated away from invalid enum values before reports deserialize official rosters.

Review process impact:

- Student-government/ASUN removal guard remains part of public-meeting ingestion and reporting.
- Any future source record that resembles a retired campus/student-government body should be excluded or reviewed as official government source data, not promoted as a product feature.

Public-facing impact:

- Profile details, verification, onboarding, organizations, community discovery, election detail, and action pages no longer display Student Mode, campus community, `.edu` verification, student badges, or campus organization language.
- Public onboarding now focuses on geographic community, city/county/school-district/state/federal context, and voter verification.

### 2026-06-18 - Citizen-Readable Meeting Cards, Jurisdiction Context, Community Hubs, And Public Civic Cases

New capability:

- Added citizen-readable public title/question fields for meeting-derived voting cards while preserving source agenda language separately.
- Added civic jurisdiction context labels for City, County, School District, State, Federal, and Special District / Board records.
- Added editable admin review fields for generated public voting-card titles, questions, summaries, action, and purpose.
- Added review-gated public civic case artifacts extracted from meeting public comments and agenda topics with case-like language.
- Added compact public case runtime artifact and admin case review/import placeholder routes.
- Added `/communities/[communityId]` route into the community hub and surfaced local questions, meetings, decisions, spending/cost impacts, and public cases on home/community views.

Accuracy impact:

- Public cards now separate voter-facing plain language from agenda/resolution language, reducing raw agenda jargon without deleting the original source wording.
- Public civic case extraction redacts emails, phone numbers, and likely home addresses and defaults to `needs_review`.
- Jurisdiction context makes the primary public label the user-facing jurisdiction while keeping governing body as secondary detail.

Review process impact:

- Admins can edit/approve generated card language before publishing.
- Public civic cases are not public-approved by default; they enter an admin queue with confidence, priority, source type, redacted snippet, and source links.
- Case import remains validation/review-gated and should not publish sensitive personal information without explicit review.

Public-facing impact:

- `/voting`, event related cards, home, and community hub surfaces can show citizen-readable local questions with source detail kept secondary.
- Community pages now act more like civic dashboards by including active local questions and review-gated public case previews.
- Voters see jurisdiction layers such as My City, My County, and My School District instead of only formal board names.

### 2026-06-18 - Runtime Data Separation, Voting Performance, And Prisma Stability

New capability:

- Added optimized public runtime artifacts for event summaries, voting-card summaries, and approved/review-safe official actions.
- Removed large public-meeting archives, packet text, full generated reports, manual source caches, and raw documents from public serverless traces.
- Reworked `/voting` to load one active voting question plus queue metadata instead of hydrating the full voting library on initial request.
- Switched Prisma access to a lazy shared singleton and added Vercel/Linux Prisma binary target generation.

Accuracy impact:

- Public pages now consume lighter curated runtime payloads while full source-backed data remains available for admin/review/import workflows.
- The change reduces accidental exposure of raw or review-only records in public runtime bundles.
- Read-time civic-question seeding was removed from `/voting`, reducing the chance of background importer side effects during public requests.

Review process impact:

- Full public-meeting artifacts and reports remain build-time/admin/import artifacts.
- Runtime artifacts must be regenerated by meeting import workflows when source data changes.
- Admin review queues continue to own low-confidence parser records, official-action matching, fiscal/tax review, and unclear voting-card status.

Public-facing impact:

- `/voting` loads dramatically faster and initially returns only the current card plus lightweight navigation context.
- Public routes avoid bundling raw PDFs, packet text, source caches, and generated reports.
- Vercel function sizes are now under the 250 MB limit, with Vercel analysis reporting `/voting` at 76.68 MB.
