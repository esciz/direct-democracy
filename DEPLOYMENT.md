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

Git deployments require **Settings → Git → Git Large File Storage (LFS)** enabled in the Vercel project. This downloads the full large civic JSON files instead of pointer text. After enabling it, use a new deployment; see [Vercel's Git LFS documentation](https://vercel.com/docs/project-configuration/git-settings#git-large-file-storage-lfs). Local/CLI deployments require `git lfs pull` before building or uploading.

See [meeting operations](docs/meeting-operations.md) for acquisition and [launch operations](docs/launch-operations.md) for the cloud worker, durable checkpoints, validated release publication, environment settings and recovery. `vercel.json` restores the selected civic runtime release before building when `CIVIC_DATA_RELEASE_ENABLED=true`. Verify the resulting hash through `/api/data-release`; a local collection or successful build alone does not establish public freshness.

Use Node 24 for the application and DataOps CLI. Run `npm run dataops:runtime:compact` after civic generation and before building. After `npm run build`, run `npm run meetings:bundle:audit` to verify compact meeting evidence is packaged and worker PDF/text caches are excluded. Keep this check when adding new generated-data readers.
