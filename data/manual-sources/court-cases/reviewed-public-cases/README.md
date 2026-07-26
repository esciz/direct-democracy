# Reviewed Public Court Case Sources

This folder is the manual, review-gated source lane for public court records.

## Workflow

1. Open the official court source page or exported public docket/document.
2. Save the source page, PDF, or export into `raw-sources/`.
3. Add a row to `manifest.json`.
4. Mark `reviewStatus` as `reviewed_public` only after confirming the record is public and not sealed, confidential, juvenile, protected, or otherwise non-public.
5. Run:

```bash
npm run cases:import-public
```

Only records with `reviewStatus: "reviewed_public"` and `publicVisibilityStatus: "public"` are written to the public runtime artifact.

## Safety Rules

- Do not import sealed, confidential, juvenile, protected, adoption, guardianship, or non-public records.
- Do not infer sensitive facts beyond the official source text.
- Do not add legal advice, predicted outcomes, or unsourced party details.
- If a record is unclear, set `reviewStatus` to `needs_review` or set `publicVisibilityStatus` to `pending_privacy_review`.
