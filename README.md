# Direct Democracy

Direct Democracy is a shareable Next.js civic demo centered on recurring voting, issue exploration, petitions, debates, public profiles, and community accountability.

Long term, Direct Democracy is being built as a citizen-first civic platform with a possible future nonprofit public layer and a separate for-profit GovCRM workflow layer. Both may use a shared civic graph, but public civic records must remain source-attributed, reviewable, and protected from government customer manipulation.

This repo is intentionally set up as a seeded prototype:
- no production voter-verification backend is required
- the demo runs from mock data plus cookie-backed state
- demo profile switching can stay enabled in a public Vercel deployment

## What this demo is for

Use this build to share the product with early testers by URL, especially on iPhone Safari as a PWA-style experience.

It is not yet a production-grade verified-voter release.

## Nevada roadmap

The statewide Nevada coverage plan lives in [docs/nevada-statewide-roadmap.md](docs/nevada-statewide-roadmap.md). It defines the Phase 1 launch jurisdictions, statewide and federal layers, full Nevada jurisdiction coverage, generated community-page expectations, and source-backed success criteria.

## Tech stack

- Next.js App Router
- React
- Tailwind CSS
- Cookie-backed seeded demo state

## Requirements

- Node 20+ recommended
- npm

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build locally

```bash
npm run build
npm run start
```

## Browser-assisted meeting source bootstrap

For blocked public meeting providers such as Reno PrimeGov or Nevada Legislature pages, use the manual official-source cache workflow:

```bash
npm run meetings:bootstrap:sources
npm run meetings:import:manual
npm run meetings:report
```

Instructions are in [docs/public-meeting-browser-bootstrap.md](docs/public-meeting-browser-bootstrap.md). This workflow is only for manually saved official public records; do not bypass authentication, CAPTCHAs, hidden endpoints, or security controls.

## Meeting source completeness and DataOps

Sprint 2C added a cache-first source recovery and accountability-readiness layer. Sprint 2E adds the retrieval worker, document cache index, source monitoring, freshness audit, RSS registry, and reprocessing run ledger:

```bash
npm run meetings:documents:discover
npm run meetings:documents:retrieve
npm run meetings:documents:verify-cache
npm run meetings:documents:extract
npm run meetings:retrieval-queue
npm run meetings:documents:ocr
npm run meetings:source-completeness
npm run meetings:documents:audit
npm run rss:registry
npm run dataops:registry
npm run dataops:monitor
npm run dataops:retrieve
npm run dataops:extract
npm run dataops:ocr
npm run dataops:reprocess
npm run dataops:audit
npm run dataops:daily
npm run sources:refresh:daily
npm run site:launch-audit
npm run dataops:dev
npm run dataops:offline
npm run admin:operations:audit
npm run ingestion:registry
npm run ingestion:audit
npm run playwright:public
npm run imports:validate
npm run trust:foundation-audit
```

Generated artifacts include `data/generated/public-meeting-source-documents.json`, `data/generated/public-meeting-document-cache-index.json`, `data/generated/public-meeting-document-text.json`, `data/generated/public-meeting-retrieval-queue.json`, `data/generated/public-meeting-source-health.json`, `data/generated/dataops-source-registry.json`, `data/generated/dataops-monitoring-status.json`, `data/generated/dataops-retrieval-run.json`, `data/generated/dataops-change-log.json`, `data/generated/dataops-reprocessing-runs.json`, `data/generated/rss-source-registry.json`, `data/generated/public-meeting-source-completeness.json`, `data/generated/public-meeting-accountability-readiness.json`, and `data/generated/public-meeting-document-audit.json`.

`sources:refresh:daily` is the canonical once-daily refresh. It checks official meeting calendars, merges reviewed caches, refreshes bounded source documents, republishes source-backed issue and event records, and runs freshness and no-demo audits. The GitHub workflow remains available for manual recovery runs; recurring execution is owned by one scheduler so the sources are not fetched more than once per day.

`site:launch-audit` is the public integrity gate. It fails on civic fixture imports, retired government links, and legacy issue surfaces that no longer route to the source-backed issue system. It also reports unresolved meeting-provider, official-roster, campaign-finance, source-document, pipeline-completeness, and freshness barriers in `data/generated/public-site-integrity-audit.json`. A command exit code of zero means there are no critical code-integrity regressions; use the artifact's `launchReady` field for the full data-readiness decision.

Remote public URLs are preserved as discovered sources. A document is marked downloaded only when a real local cache file exists. In network-restricted environments, retrieval attempts are recorded as `blocked_by_network` instead of pretending that source evidence was recovered.

For a network-enabled local or hosted run:

```bash
npm run dataops:pipeline -- --limit=100
```

For a Codex/sandbox run without public DNS access:

```bash
npm run dataops:offline
```

Trust and claims architecture is documented in [docs/trust-foundation.md](docs/trust-foundation.md). Verified Resident and Verified Voter are segmentation concepts with equal participation rights; Direct Democracy does not use hidden vote weighting.

Data Operations architecture is documented in [docs/data-operations.md](docs/data-operations.md).

Generated artifact commit boundaries are documented in [docs/generated-artifacts.md](docs/generated-artifacts.md).

The secured platform operations console lives at `/admin/operations`. It is part of public platform admin, not GovCRM. It uses allowlisted operation IDs, admin permissions, sanitized local logs, ingestion capability coverage reports, and explicit `worker_unconfigured` / `durable_storage_unconfigured` states where production infrastructure is not yet configured.

## Demo environment variables

The current demo can run without a real backend, but these values are helpful:

```bash
NEXT_PUBLIC_ENABLE_DEMO_MODE="true"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/direct_democracy?schema=public"
GOV_CRM_ENABLED="false"
ADMIN_PREVIEW_ENABLED="false"
```

Notes:
- `NEXT_PUBLIC_ENABLE_DEMO_MODE="true"` keeps seeded demo identity and role switching visible for QA. It must not enable synthetic civic facts, officeholders, campaign finance, posts, polls, petitions, debates, events, ads, or school statistics on public pages.
- `GOV_CRM_ENABLED="false"` keeps the government workflow scaffold hidden and gated unless explicitly enabled.
- `ADMIN_PREVIEW_ENABLED="false"` keeps private preview tools disabled in production by default.
- Without Prisma-backed or generated source data, civic surfaces show explicit empty states. User-created prototype actions remain cookie-backed.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo into Vercel.
3. Keep the default Next.js framework preset.
4. Use:
   - Build command: `npm run build`
   - Install command: `npm install`
5. In Vercel environment variables, set:
   - `NEXT_PUBLIC_ENABLE_DEMO_MODE=true`
   - `DATABASE_URL=...` if your deployment path expects Prisma access
6. Deploy.

## iPhone / PWA demo usage

The app includes:
- web manifest
- Apple touch icon
- standalone display mode
- safe-area-aware mobile shell

For testers on iPhone Safari:
1. Open the deployed URL.
2. Tap Share.
3. Tap `Add to Home Screen`.
4. Launch it from the home screen for the app-like experience.

## Demo behavior

- Seeded users and role switching are intended for demos; public civic records remain source-backed or explicitly unavailable.
- State is mostly cookie-backed, so testers can interact without creating real accounts.
- The main navigation, vote flow, explore pages, profiles, debates, and petitions are all meant to be browsed as a prototype.

## Troubleshooting

If Next.js gets into a stale local build state:

```bash
rm -rf .next node_modules/.cache
npm run dev
```

If the dev server shows missing chunk or manifest errors, clear `.next` and restart before assuming the source code is broken.
