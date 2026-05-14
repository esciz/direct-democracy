# AGENTS.md

## Project goal

Direct Democracy is a dark, mobile-friendly civic engagement prototype focused on recurring voter participation, issue exploration, civic accountability, debates, petitions, organizations, and community action.

Core product framing:
- verified or verification-ready voters create a trustworthy civic signal by voting regularly
- `Vote` is the primary product action
- the app is a shareable demo/prototype, not a production government voting system

## Repo layout

- `app/`
  - Next.js App Router routes
  - primary pages: `/`, `/voting`, `/explore`, `/profile`
  - many secondary routes: organizations, cases, issues, petitions, debates, officials, candidates, elections, messages, communities, etc.
- `components/ui/`
  - shared shell, nav, logo, tabs, layout primitives
- `components/domain/`
  - feature UI for vote cards, profile heroes, charts, avatars, entity cards, detail sections
- `lib/`
  - auth/session helpers, mock data, domain stores, server-side helpers, feature actions
- `types/`
  - shared domain types
- `prisma/`
  - schema and seed script
- `public/`
  - icons, logos, PWA assets
- `README.md`
  - public setup and deploy guide
- `DEPLOYMENT.md`
  - deployment notes

## Architecture notes

- This repo uses the Next.js App Router.
- Root shell lives in `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/app/layout.tsx`.
- Global CSS comes from `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/app/globals.css`.
- Do not add Pages Router files like `pages/_document.tsx` to fix stale cache issues.
- `/vote` is an alias redirect to `/voting` via `next.config.ts`.

## Data/auth model

- Current experience is mostly seeded/mock-data driven.
- Demo session state is cookie-backed.
- Prisma/PostgreSQL is configured, but the visible prototype is not fully backend-dependent.
- Demo profile switching is important for QA and public demos.

Important env vars:
- `NEXT_PUBLIC_ENABLE_DEMO_MODE`
- `DATABASE_URL`

Do not print actual secret values in docs or commits.

## Run commands

```bash
npm install
npm run dev
```

Production/local build check:

```bash
npm run build
npm run start
```

Type check:

```bash
npm run typecheck
```

Prisma helpers:

```bash
npm run prisma:generate
npm run prisma:push
npm run seed:mock-users
```

## Testing/linting

Currently available:
- `npm run build`
- `npm run typecheck`

Currently not available in `package.json`:
- `npm run test`
- `npm run lint`

When making risky changes, use `npm run build` as the baseline safety check.

## Coding conventions

- TypeScript + Tailwind utility classes throughout.
- Keep `components/ui` generic and reusable.
- Keep `components/domain` feature-specific.
- Prefer reusing shared cards, hero components, avatars, and chart components instead of one-off styling.
- Preserve the dark civic-tech theme and existing visual system.
- Use App Router patterns consistently.
- Put client-only hooks/components behind `"use client"`.
- Keep optional/slow sub-sections resilient with safe fallbacks instead of hard crashes.
- Prefer safe seeded fallbacks over infinite spinners.
- Use `rg` for repo search.

## Product guardrails

- Do not reintroduce Boost Credits into the user-facing product.
- Do not turn the app into a generic social feed.
- Keep posts/polls contextual where that model already exists.
- Keep `Vote` as the flagship action.
- Do not break demo profile switching.
- Do not break `/voting`, `/explore`, `/profile`, or the shared shell.
- Do not remove seeded demo data unless replacing it with a better demo-ready alternative.
- Do not add real auth, payments, or official voter verification flows unless explicitly requested.

## Known gotchas

- The repo often works even when the local Next dev cache is stale. If you see missing chunk errors, missing `_document.js`, or odd App Router runtime failures, clear `.next` before assuming the source tree is broken.
- The working tree may be dirty. Never revert unrelated changes unless the user explicitly asks.
- There is no real `/public-accountability` route right now, even if accountability concepts appear in cards/copy.
- Prisma schema still contains legacy boost/credit models. Avoid surfacing them in the UI.

## Good first checks before big changes

1. Read `README.md`.
2. Read `app/layout.tsx`.
3. Read `components/ui/main-nav.tsx`.
4. Read the relevant route file under `app/`.
5. Run `npm run build` before and after significant work.

## Documentation expectations for future sessions

- Update docs when architecture, product framing, or deployment assumptions change.
- Keep handoff notes concise and specific.
- Mention secret names only, never secret values.
