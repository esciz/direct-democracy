# Nevada SOS Candidate Public Media Imports

Manual acquisition workflow:

1. Open the Nevada SOS Candidate Public Media Information page in your normal browser.
2. Download candidate public media PDFs/files manually.
3. Place the files in this folder.
4. Run:

```bash
npm run civic:import-nvsos-candidate-media
```

The importer reads local `.pdf`, `.txt`, `.html`, and `.htm` files only. It does not fetch the protected SOS page and does not automate browser access.

Optional `manifest.json` format:

```json
{
  "documents": [
    {
      "fileName": "candidate-file.pdf",
      "candidateName": "Candidate Name",
      "office": "Office sought",
      "party": "Party if listed",
      "sourceUrl": "https://www.nvsos.gov/...",
      "linkText": "Original link text"
    }
  ]
}
```

All matched records are imported as Nevada SOS public media candidate knowledge with `PENDING_REVIEW`.
