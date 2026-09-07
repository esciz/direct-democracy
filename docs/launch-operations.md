# Civic data delivery and launch operations

The public application, collection worker and identity services have separate readiness checks. A successful scrape or build does not establish that new records reached the public site. Use `/admin/launch-health` for the packaged release and source findings, `/admin/meeting-health` for calendars/minutes, and `/api/data-release` for a minimal public release identity. Account and email checks remain separate.

## Production collection and publication

`.github/workflows/civic-data-production.yml` is the single cloud publication writer. It runs every six hours at 00:17, 06:17, 12:17 and 18:17 UTC. Meetings run every time; the broader finance, ads, officials, cases and organization collection runs once per UTC day, or through the manual `full_refresh` input. GitHub concurrency prevents overlapping collection and publication. The pipeline's filesystem lock also prevents overlapping local commands.

Each run restores the previous private worker checkpoint before collecting. It preserves historical meetings, provider discovery and retry state, official public source files, text/OCR evidence, and FEC filing history. After collection it saves a checkpoint even when a provider failed. A missing checkpoint or credentials fails the run rather than silently starting without history. Worker files are allowlisted; identity records, private voter evidence, sessions, environment files and logs do not belong in civic storage.

Every meeting cycle reserves a separate batch of 60 due minutes downloads, including archived meetings, before the general document batch. It processes up to 400 readable minutes documents before other cached agenda topics. This keeps the historical minutes backlog moving even while new agendas are arriving. Document retry state and successful extraction survive subsequent runs. Unstructured or ambiguous material remains in review; native document excerpts can be read independently of reviewed decisions and individual votes.

Native extraction accepts the same 250 MB ceiling as the minutes retrieval batch and runs each PDF in an isolated worker with a 60-second timeout. Reviewed document associations are reapplied after import and before topic parsing. An override requires the exact official URL, cached PDF hash, native header and a unique existing meeting for the same body/date. For example, Carson City's July 21, 2026 9-1-1 committee page served April 21 minutes; the corrected records preserve both meetings and attach that document to April 21. Conflicting or displaced evidence remains in the private worker review report until its ownership is resolved.

Scheduled native-text passes stop after 400 attempts or ten minutes, allowing an in-flight PDF to finish within its own timeout. They save the text ledger every 20 attempts and at the end, preserving deferred records and their cache state. Available unattempted documents lead the queue, with minutes preferred when attempts are equally old; failures rotate across document types. Deferred counts are explicit and do not imply complete extraction. This budget stays below the worker's 15-minute command timeout.

Worker checkpoints retain public work-session, study-session and special-session documents within the dedicated meeting-source directories, including XML meeting feeds. These bounded meeting names must not be mistaken for authentication sessions. Private/session state, cookies, credentials, symlinks and unreferenced manual files remain excluded. The September 7 restore audit recovered twelve previously omitted public files and verified their hashes against the cache ledger before restoring them; these were existing downloads, not additional recovered minutes.

The worker then regenerates integrity findings, validates references and release completeness, runs regressions and the production build, and publishes a versioned release. Content-addressed objects are verified before the latest manifest changes. Runtime publication rejects malformed or missing required datasets, critical integrity problems and material unexplained record loss. Incomplete source coverage stays visible in the manifest and audits; publication does not certify statewide completeness. A failed collection retains its failure status even when a usable release is published.

Vercel's build command restores the selected validated runtime release before `npm run build`. Set `CIVIC_DATA_RELEASE_ENABLED=true` for this path; ordinary local builds remain independent of cloud storage. The cloud collection job explicitly disables restore during its candidate build so an older live release cannot overwrite the newly collected candidate. Large PDF/text/OCR caches and the full accountability graph remain on the worker and outside web functions. `npm run dataops:runtime:compact` writes the exact community accountability summaries consumed by the UI and removes JSON whitespace before snapshotting; it preserves every public record and keeps the full graph intact. The event bundle audit also enforces a 250 MiB packaging budget.

The deploy hook rebuilds `main` after publication. The workflow verifies that the public `/api/data-release` returns the expected hash, with up to 45 minutes for packaging/deployment. It fails if publication never reaches the public site. A Vercel deployment can be healthy while serving an older release; compare identities, not just HTTP 200.

`npm run build` losslessly compresses the full vote, decision-card and community relationship JSON into derived gzip copies before Next tracing. Production readers use those copies when the originals are excluded from the function bundle; workers and local collectors still prefer the original JSON. Decision-card objects remain distinct from the meeting-question runtime array. Every record and evidence field survives a verified byte-for-byte round trip. Releases retain the original JSON, so older immutable releases remain restorable and the build can regenerate its compressed copies. The bundle audit verifies both their presence and the package size.

## Configuration

GitHub Actions requires `BLOB_READ_WRITE_TOKEN`, `DATABASE_URL` and `CIVIC_DATA_DEPLOY_HOOK`. `CIVIC_WORKER_ENV` can hold the existing allowlisted project settings as a private JSON repository secret; `scripts/configure-civic-worker-env.mjs` validates names and masks individual values before passing them to later steps. `FEC_API_KEY` is optional; public API throttling and bulk fallback remain observable. Never commit this bundle or a deploy hook URL.

Vercel requires its existing database, email and MFA settings plus `BLOB_READ_WRITE_TOKEN` and `CIVIC_DATA_RELEASE_ENABLED`. The deploy hook targets the same repository's `main` branch. Use Node 24 in both environments. PDF/OCR collection additionally requires Poppler and Tesseract, installed by the cloud workflow. The current evidence archive exceeds the spare capacity of a minimal runner: the pinned Ubuntu 24.04 job removes its unused preinstalled Android SDK from the disposable VM and checks actual free space before atomic restore. GitHub documents the runner’s [standard storage allocation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) and [installed SDK path](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md). Insufficient space fails safely; it never truncates the checkpoint.

The existing `daily-civic-source-refresh` desktop automation is now a read-only cloud monitor on its original six-hour schedule. It checks failed steps, the actual public release, stale publication and new actionable source gaps. It distinguishes a published release with acknowledged source-coverage failures from a broken deployment, and does not run another collector or publication writer. Desktop monitoring is supplementary and does not keep the cloud job alive.

## Operator commands

```bash
# Validate and compact local runtime data without external writes.
npm run site:launch-audit
npm run dataops:runtime:compact
npm run dataops:release:prepare
npm run dataops:release:test

# Persist collection state; inspect the dry run before the initial checkpoint.
npm run dataops:checkpoint -- --dry-run
npm run dataops:checkpoint
npm run dataops:checkpoint:restore

# Publish the validated local runtime after tests and build pass.
npm run dataops:release:publish -- --approve --trigger-deploy
npm run dataops:release:verify

# Restore a specific release into a disposable checkout for review.
npm run dataops:release:restore -- --required --id=<release-hash>
```

The restore command writes generated civic files. Use a disposable checkout when comparing releases. `.local/civic-release-candidate.json` is a local preparation record; it is not proof of external publication. A deployment's `data/generated/civic-data-release.json` is produced by verified restore and served through the release endpoint.

For recovery, stop the cloud publishing workflow temporarily, select an existing immutable release with `node --import tsx scripts/civic-artifacts.ts rollback --id=<release-hash> --approve --trigger-deploy`, and pin `CIVIC_DATA_RELEASE_ID` in Vercel while investigating. Rollback verifies stored objects and the historical release gate before moving the pointer. Application rollback through Vercel is separate from moving the civic data pointer. Do not delete source history or mutate an old immutable manifest to simulate a rollback. Unpin and resume only after verifying the repaired release.

## Source and account boundaries

The September 7, 2026 minutes recovery downloaded 373 additional official minutes PDFs: Elko County 150, Reno 115, NSHE 69, Eureka 35, Carson City 2 and Washoe schools 2. The extraction pass also recovered two already cached large Carson documents and OCR text from seven scans (41 pages). The corrected audit initially rose from 726 to 1,095 meetings with readable minutes; this audit covers meetings with identified minutes sources, not every historical meeting in Nevada. Raw PDF bytes and agenda snippets cannot satisfy that check. Two oversized Eureka scans and several invalid provider responses were outstanding after that initial pass; subsequent recovery below handles the scans.

After duplicate and document-ownership reconciliation, the recovery release verified live on September 7 contained 2,382 meetings, including 2,264 archived meetings, and 1,087 readable minutes records out of 1,104 identified minutes records. That includes 1,082 full-text and five partial-text records. Its 5,021 public topics included 1,992 cited source excerpts. Browser checks confirmed August 6 Cannabis Board and August 12 cannabis taxation subcommittee minutes, and August 20 agenda excerpts with the missing minutes still visible. These are timestamped recovery counts; subsequent cloud refreshes can change them.

The same pass refreshed Cannabis Board and Taxation meeting identities, retained old meeting IDs as aliases, separated subcommittees and local-finance subgroups, and reassigned minutes submitted for later approval to their actual meeting dates. August 20 Cannabis Board minutes were not published on its official index at the time of recovery; the August 6 minutes appearing in its agenda remain attached to August 6. Seventy-one additional Cannabis Board agendas were cached, including August 20.

PrimeGov collection now covers the published upcoming list and current-year archive for Reno, Las Vegas, Boulder City and North Las Vegas, including the committees exposed by each official portal. Only public compiled documents with a matching provider meeting ID are attached. Native IDs and exact retained metadata preserve historical event aliases; composite manual rows require an exact old title and topic source to choose their primary meeting. Independently verified metadata paths move only to their surviving canonical owner. Joint sessions and explicit cancellation notices retain their identity and status.

The OCR capability audit resolves tools through the shell's `command -v`, including Linux runners where `command` is a builtin rather than an executable. Scheduled processing reserves ten minutes documents before the general OCR batch, and permits individual scans up to 100 MB. OCR page caps and incomplete pages remain visible; source documents and previous usable evidence are retained for later recovery. The cloud workflow installs and launch-checks Playwright Chromium as well as PDF tools. Browser discovery checkpoints provider manifests after each completed page or document, keeps previous success and failure history, and rotates deferred work. Scheduled runs use a 720-second default total budget and 180-second provider budget, with a shutdown reserve below the pipeline command timeout. Eureka discovery also reads individual official calendar event pages; dated calendar evidence and matching archive documents preserve distinct bodies and historical aliases.


Readable native topics with a specific official document citation may appear as source excerpts. This status confirms document segmentation only. OCR, ambiguous headings and missing citations remain held for review; neither status independently establishes an official action, personal vote or approved voting question. Reprocessing preserves existing reviewed records and queues changed source evidence separately.

Native PDF extraction prefers the installed Poppler reader inside an isolated process with bounded time, output and memory. PDFParse remains a fallback where Poppler is unavailable. Backend/version metadata causes old PDF caches to be reevaluated, and page coverage distinguishes complete, partial and unknown text. A failed or weaker pass preserves the prior usable evidence. The minutes audit keeps known missing native/OCR pages marked partial even when an excerpt is long enough to contain motions and votes.

PDF and OCR text are normalized as plain text; HTML tags are removed only from HTML sources. This prevents literal angle brackets in a PDF from swallowing intervening pages. The September 7 correction recovered all 16 pages of the April 1 Las Vegas City Council minutes, previously reduced to a short footer. Versioned extraction reevaluates cached PDFs after this correction. Deferred documents have explicit queue state and no fabricated extraction date; topic processing skips them safely.

OCR has a shared 720-second default deadline below the pipeline command timeout. Inspection, rendering and recognition consume the same remaining budget. Each completed or partial document atomically checkpoints the merged ledger, and immutable text sidecars preserve the evidence referenced by the preceding checkpoint. Interrupted runs retain earlier documents and can resume unfinished pages.

Source-document IDs distinguish meeting ownership and document role as well as content. Exact duplicate copies merge their item references, paths and provenance; shared bytes belonging to different meetings retain separate records. Existing text-ledger owners keep their legacy IDs, and deterministic scoped IDs prevent another meeting from overwriting them.

Public issue relationships use the same topic and voting-card eligibility gates as the public pages, and count unique meeting, item and source IDs before display limits. Narrow issue assignments require relevant source evidence: generic references to education and funding cannot establish Teacher Pay. Older Teacher Pay summaries without the new evidence version are checked against their linked public source material before display.

Issue meeting sections use those versioned relationships directly, including canonical meeting aliases, so generic board-meeting titles cannot hide links established from minutes. Legacy or curated issues retain strong topic matching. Public decision readers require an eligible public card and its exact public agenda item; votes and action results must match both the topic and meeting. Named actors additionally require approved attribution evidence, so another agenda item's roll call cannot appear on a decision page.

Finance collectors now retain previous results during outages, paginate current FEC results and expose unavailable values as unknown. Nevada totals derived from retrieved reports are labeled as derived; they are not comprehensive official aggregate totals. Ads retain original filings and amendment provenance. Notice-only rows and overlapping amended filings do not establish a trustworthy summed advertising spend or audience impression count. Major commercial creative libraries still need their own supported access.

Organizations preserve their latest good IRS evidence if a download fails. Case records remain reviewed records; an accessible court search landing page does not establish an automatic case parser. Restricted sources stay restricted rather than being bypassed.

Account sessions are opaque tokens backed by hashed database records. Password recovery and verification links are hashed, purpose-bound, expiring and single-use; password reset revokes sessions. MFA state and password changes use durable storage. Automated regression tests use isolated fixtures and do not send messages or change live credentials.

Anonymous browsing uses an unverified guest identity, and production verification ignores unsigned demo override cookies. Real onboarding requires an authenticated session and saves community and issue preferences to durable profile content before reporting success. The additive `20260907030000_durable_profile_community` migration supplies the nullable community column. A chosen browsing community does not replace verified residency.

The Identity Worker workflow supports a default `diagnostics_only` manual mode. It runs database, queue and production trust audits without claiming jobs, creating smoke jobs or sending email; scheduled processing retains its existing behavior. On September 7, two exact June 24 operator email tests were cancelled through `scripts/resolve-historical-identity-tests.ts`. The guarded transaction preserves their payloads, attempt counts, provider failure reasons and original dead-letter history, adds resolution events, and records an exact-state undo receipt. It cannot retire arbitrary production failures. The replacement diagnostic run passed; this does not establish provider delivery readiness.

A queue round trip proves queue processing only. Email delivery must be verified through the configured provider with an authorized real message. Private verification-evidence storage/purge currently lacks a production remote implementation and must remain explicitly unconfigured. Setting a bucket name does not implement that service. Do not label a public beta a fully verified-voter release on the strength of account signup or civic data checks.
