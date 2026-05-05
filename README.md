# Direct Democracy

Direct Democracy is a shareable Next.js civic demo centered on recurring voting, issue exploration, petitions, debates, public profiles, and community accountability.

This repo is intentionally set up as a seeded prototype:
- no production voter-verification backend is required
- the demo runs from mock data plus cookie-backed state
- demo profile switching can stay enabled in a public Vercel deployment

## What this demo is for

Use this build to share the product with early testers by URL, especially on iPhone Safari as a PWA-style experience.

It is not yet a production-grade verified-voter release.

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

## Demo environment variables

The current demo can run without a real backend, but these values are helpful:

```bash
NEXT_PUBLIC_ENABLE_DEMO_MODE="true"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/direct_democracy?schema=public"
```

Notes:
- `NEXT_PUBLIC_ENABLE_DEMO_MODE="true"` keeps seeded demo profile switching visible in a deployed demo.
- If you are not using Prisma-backed data for this prototype run, the app still primarily relies on seeded mock data and cookie state.

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

- Seeded users and role switching are intended for demos.
- State is mostly cookie-backed, so testers can interact without creating real accounts.
- The main navigation, vote flow, explore pages, profiles, debates, and petitions are all meant to be browsed as a prototype.

## Troubleshooting

If Next.js gets into a stale local build state:

```bash
rm -rf .next node_modules/.cache
npm run dev
```

If the dev server shows missing chunk or manifest errors, clear `.next` and restart before assuming the source code is broken.

