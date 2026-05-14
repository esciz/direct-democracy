# Direct Democracy Project Status

## 1. App purpose and current product concept

Direct Democracy is a shareable civic engagement prototype built to show how verified or verification-ready voters can participate in a recurring civic signal, not just one-time election-day activity.

Current product concept:
- `Home` is a civic dashboard and launchpad.
- `Vote` is the primary product surface, centered on recurring voting in a one-question-at-a-time flow.
- `Explore` is the discovery layer for issues, cases, candidates, officials, elections, petitions, debates, organizations, communities, schools, events, and services.
- `Profile` is the public/private identity, reputation, activity, and settings-style surface for a seeded demo user.
- `My Community` remains a deeper local/community-specific hub separate from the broader Home dashboard.

The app is explicitly a demo/prototype, not a production voter verification or official government voting system.

## 2. Tech stack detected

Detected from `package.json`, config files, and imports:

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 3
- PostCSS + Autoprefixer
- Prisma ORM with PostgreSQL datasource configured
- Cookie-backed demo session state
- Seeded/mock data-heavy prototype architecture
- PWA metadata and icons for iPhone Safari / Add to Home Screen

Key files:
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/package.json`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/next.config.ts`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/tailwind.config.ts`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/postcss.config.js`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/prisma/schema.prisma`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/app/layout.tsx`

## 3. Folder/module map

### App Router
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/app`
  - Main Next.js App Router tree.
  - Important top-level routes include `page.tsx`, `voting`, `explore`, `profile`, `organizations`, `cases`, `issues`, `petitions`, `debates`, `officials`, `candidates`, `messages`, `my-community`, `feed`, `take-action`.

### UI and domain components
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/components/ui`
  - Shared app shell, header, nav, logo, tabs, section headings, mobile nav, etc.
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/components/domain`
  - Feature components for voting, cards, profile heroes, organization cards, charts, avatars, detail surfaces, and other domain-specific UI.

### Business/data logic
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/lib`
  - App logic and stores.
  - Important subareas:
    - `auth/` seeded users, session helpers, role constants, guards
    - `server/` server-side session/favorites/issues/elections helpers
    - `feed/` vote queue, posts, quick-vote logic
    - `polls/`, `petitions/`, `debates/`, `organizations/`, `cases/`, `issues/`, `community/`, `messages/`
    - `sentiment/` seeded sentiment history generation

### Shared types
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/types`
  - Shared domain types used across app routes and lib modules.

### Prisma
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/prisma`
  - `schema.prisma`
  - `seed.js`

### Assets and PWA
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/public`
  - App icons, logos, touch icons, static assets.

### Mobile placeholder
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/mobile`
  - Present in repo, but the current shareable experience is the Next.js PWA/web app, not a full native mobile app.

### Documentation / planning
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/README.md`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/DEPLOYMENT.md`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/MVP_SCOPE.md`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/AI_CONTETX.md`

## 4. Implemented features

### Product shell and navigation
- Shared App Router root layout with dark app shell
- Header with brand logo, primary nav, demo profile switcher, messages, notifications
- Mobile bottom nav
- PWA manifest, Apple touch icon, standalone mobile web app metadata

### Home
- Civic dashboard-style Home page
- Vote-first hero / CTA framing
- Featured voting preview
- Upcoming elections preview
- Favorites / saved civic items on Home
- Summary/trending surfaces
- My Community shortcut

### Voting
- Canonical vote flow at `/voting`
- One-question-at-a-time queue
- Filter tabs: `All`, `People`, `Issues`, `Cases`
- Back / Skip / View all interactions
- Results after voting
- Secondary citizen polls section

### Explore/discovery
- Broad discovery route for issues, cases, officials, candidates, elections, petitions, organizations, people, communities, schools, events, and services
- Search/browse-driven discovery
- `Public Record` user-facing naming has been converted to `Cases`

### Profiles and detail surfaces
- Candidate detail pages
- Official detail pages
- Citizen/trusted citizen detail pages
- Organization detail pages
- Petition detail pages
- Case detail pages
- Debate detail pages
- Issue detail pages
- Profile pages with public info, stats, signals, activity, and external links

### Civic entities and content
- Organizations landing page broadened beyond campus groups
- Cases
- Petitions
- Debates
- Elections
- Messages
- Posts / perspectives
- Polls / citizen polls
- Community-specific pages and cards

### Visual system
- Dark civic-tech visual system across major surfaces
- Shared avatar system with fallback initials/icons
- Sentiment history charts and compact sparklines
- Larger reusable branding/logo component

### Demo readiness
- Seeded demo users
- Demo profile switching
- Guest browse mode
- Public prototype deployment guidance

## 5. Partially implemented features

- Prisma-backed persistence exists in schema form, but the visible demo still relies heavily on seeded/mock data and cookie-backed state.
- Some detail/profile surfaces are dark-themed and polished, but there may still be older light-style pockets in secondary/admin/create flows.
- External links are implemented for shared user profiles, but organization-specific settings management is not fully unified.
- PWA/mobile shell exists, but this is still a web-first prototype rather than a fully native-quality mobile app.
- Many entity types have sentiment charts, but the chart coverage and data realism are still demo-oriented.
- Organizations are much broader now, but deeper organization governance tools appear to be partly scaffolded rather than fully connected end-to-end.

## 6. Missing or broken features

- No real production authentication or voter verification flow.
- No production-grade backend for durable shared user data across devices.
- No dedicated automated test suite or lint script currently exposed in `package.json`.
- No actual `/public-accountability` route exists, even though accountability concepts and related cards exist in the product language.
- Some routes/pages may still rely on aggressive seeded fallback behavior rather than truly robust data flows.
- Repo has a large active working tree with many unstaged local changes, so source-of-truth is currently “works in this branch” rather than “stabilized release branch.”

## 7. Current auth/data/backend setup

### Auth/session
- No real sign-in provider detected.
- Current auth/session is demo-oriented and cookie-backed.
- Middleware guards selected creation routes based on seeded demo user role.

Relevant files:
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/lib/auth/constants.ts`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/lib/auth/mock-users.ts`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/lib/server/auth-session.ts`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/middleware.ts`

### Data
- Primary visible product data is heavily seeded/mock/demo-backed.
- Some stores are deterministic or in-memory-like helpers.
- Cookie state is used to preserve demo interactions.

### Backend
- Prisma schema exists with many models and a PostgreSQL datasource.
- The demo can still run without a real fully configured backend.

## 8. Current frontend routes/pages/components

### Main primary routes
- `/`
- `/voting`
- `/explore`
- `/profile`

### Other major pages currently present
- `/my-community`
- `/organizations`
- `/cases`
- `/issues`
- `/petitions`
- `/debates`
- `/officials`
- `/candidates`
- `/elections`
- `/communities`
- `/people`
- `/messages`
- `/notifications`
- `/feed`
- `/take-action`
- `/events`
- `/schools`
- `/services`
- `/polls`
- `/posts`
- `/campuses`

### Route alias behavior
- `/vote` redirects to `/voting` via Next redirects in `next.config.ts`.

### Important shell components
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/app/layout.tsx`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/components/ui/main-nav.tsx`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/components/ui/nav-links.tsx`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/components/ui/brand-logo.tsx`

## 9. Database/schema/storage setup

Prisma/PostgreSQL is configured.

Detected Prisma datasource:
- Provider: PostgreSQL
- Secret required: `DATABASE_URL`

Schema includes a large civic domain model, including:
- users and profile content
- follows
- cases
- elections
- public profiles
- posts/comments
- debates
- contact actions
- official actions
- petitions
- vote questions / responses
- polls / poll votes
- organizations / memberships / endorsements / votes
- events
- services
- official profile and truth/follow-through models

Important caveat:
- The schema still contains legacy credit/boost models even though Boost Credits have been removed from the visible product experience. Future work should be careful not to re-surface them accidentally.

## 10. Deployment setup

Deployment is aimed at Vercel.

Relevant files:
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/README.md`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/DEPLOYMENT.md`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/app/manifest.ts`
- `/Users/eliscislowicz/Desktop/Personal/Direct Democracy Codex/app/layout.tsx`

Important deployment notes:
- Demo mode can remain available publicly.
- The main public-demo env flag is `NEXT_PUBLIC_ENABLE_DEMO_MODE`.
- The app is set up to feel installable/shareable on iPhone Safari.

## 11. Commands to run locally

From repo root:

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000`

If local Next build state gets corrupted:

```bash
rm -rf .next node_modules/.cache
npm run dev
```

## 12. Commands for tests / lint / build

Available scripts in `package.json`:

```bash
npm run build
npm run start
npm run typecheck
npm run seed:mock-users
npm run prisma:generate
npm run prisma:push
```

Not currently detected:
- `npm run test`
- `npm run lint`

Current build status:
- `npm run build` completed successfully during this audit on 2026-05-12.

## 13. Recent git history summary

Visible recent history is very limited from this clone/state.

Recent commit shown:
- `ba58ec3 Prepare public demo`

Interpretation:
- The repo appears to have been actively developed locally with many uncommitted changes after the last visible commit.
- Future sessions should not assume git history alone tells the whole product story.

## 14. Risks, bugs, or confusing areas

- The working tree is heavily modified and dirty right now; avoid destructive commands or sweeping refactors without checking current changes carefully.
- The app has historically hit stale `.next` runtime/chunk issues. If runtime errors mention missing chunk files or `_document.js`, clear `.next` before assuming source is broken.
- App Router is the canonical routing model. Do not add Pages Router files like `pages/_document.tsx` unless there is a strong architectural reason.
- Demo mode is central to the prototype; accidentally disabling demo switching will make the public prototype much less useful.
- The product concept has evolved quickly. Some routes and legacy modules may still reflect older terminology or lighter styling.
- There is no real production auth or verification pipeline yet, so some flows are UX-complete but technically demo-backed.
- `/public-accountability` is discussed conceptually but is not an existing app route.
- Prisma schema includes legacy boost/credit tables that are not meant to be surfaced in the current UX.

## 15. Recommended next 5 development tasks

1. Stabilize the current branch with a cleanup pass.
   - Review the large modified working tree.
   - Resolve half-finished styling and data-flow changes into a coherent checkpoint.

2. Add a lightweight test/lint baseline.
   - At minimum add `lint` and a few smoke tests for key routes such as `/`, `/voting`, `/explore`, `/profile`, `/organizations`, `/cases`.

3. Finish dark-theme consistency across all detail/create/admin surfaces.
   - Major flagship pages are aligned, but secondary surfaces likely still contain light-theme leftovers.

4. Clarify the persistence strategy.
   - Decide which parts should stay seeded/cookie-backed for demo purposes and which parts should move onto Prisma-backed persistence next.

5. Build a formal public-accountability surface or remove the dangling concept from the nav/content language.
   - Right now the concept exists in cards/copy, but not as a real route-level destination.
