# Direct Democracy Deployment Notes

For the current shareable demo, use [README.md](/Users/eliscislowicz/Desktop/Personal/Direct%20Democracy%20Codex/README.md) as the primary setup guide.

## Demo deployment highlights

- The app is prepared as an iPhone-friendly PWA-style Next.js demo.
- Seeded users and cookie-backed state are intended to remain usable in the deployed prototype.
- Demo mode can stay enabled in production by setting:

```bash
NEXT_PUBLIC_ENABLE_DEMO_MODE=true
```

## PWA assets

- `app/manifest.ts`
- `app/layout.tsx`
- `public/apple-touch-icon.png`
- `public/icon-192.png`
- `public/icon-512.png`

## Early tester guidance

On iPhone Safari:

1. Open the deployed URL.
2. Tap Share.
3. Choose `Add to Home Screen`.
4. Launch Direct Democracy from the home screen for the standalone app-like experience.


## Meeting data delivery

See [docs/meeting-operations.md](docs/meeting-operations.md) for the acquisition loop and launch gate. The existing local automation maintains meeting artifacts; it does not update a deployed Vercel filesystem. Deploy reviewed runtime data and verify a newly collected meeting on the public `/events` page. The manual GitHub DataOps recovery workflow uploads meeting runtime/coverage artifacts without publishing them. Unattended public freshness requires a persistent worker, source state/document storage, and an atomic reviewed runtime publication path. A successful build or calendar scrape does not establish that this delivery path is configured.

Use Node 24 for the application and DataOps CLI. After `npm run build`, run `npm run meetings:bundle:audit` to verify compact meeting evidence is packaged and worker PDF/text caches are excluded. Keep this check when adding new generated-data readers.
