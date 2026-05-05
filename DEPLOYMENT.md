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
