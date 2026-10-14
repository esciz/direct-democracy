# Browser-Assisted Public Meeting Bootstrap

This workflow is for official public records that the automated importer cannot currently reach, such as PrimeGov, JavaScript-heavy archives, or scattered legislative pages.

It is not a bypass workflow. Do not bypass authentication, CAPTCHAs, hidden endpoints, robots/security controls, or non-public access restrictions.

## 1. Create Local Source Folders

```bash
npm run meetings:bootstrap:sources
```

This creates:

```text
data/manual-sources/public-meetings/
  reno-city-council/
    raw-pages/
    agenda-packets/
    agendas/
    minutes/
    metadata/
  nv-legislature/
    raw-pages/
    bills/
    journals/
    minutes/
    votes/
    metadata/
  nv-senate/
  nv-assembly/
```

It also creates blank manifests and README files for each provider. Parser fixtures live under `_fixtures` and are not imported into the app by default.

## 2. Save Official Public Files

Open the provider archive page in your browser, for example:

- Reno City Council: `https://reno.primegov.com/public/portal`
- Nevada Legislature: `https://www.leg.state.nv.us/App/Calendar/A/`

Save only public official material:

- page HTML into `raw-pages/`
- agendas into `agendas/`
- agenda packets into `agenda-packets/`
- minutes into `minutes/`
- journals into `journals/`
- vote pages into `votes/`
- saved network JSON into `metadata/`

## 3. Update Manifest

Each provider has `manifest.json`. Add one entry per saved file:

```json
{
  "providerId": "reno-city-council",
  "sourceName": "Reno City Council",
  "officialSourceUrl": "https://reno.primegov.com/public/portal",
  "downloadedAt": "2026-06-16T10:00:00-07:00",
  "fileType": "html",
  "meetingDate": "2025-05-14T10:00:00-07:00",
  "meetingTitle": "Reno City Council Regular Meeting",
  "governingBody": "Reno City Council",
  "sourceKind": "rawHtml",
  "localPath": "raw-pages/reno-2025-05-14.html",
  "notes": "Saved from official PrimeGov public page.",
  "parserStatus": "cached"
}
```

Use `sourceKind` values: `agenda`, `packet`, `minutes`, `video`, `vote`, `bill`, `journal`, `rawHtml`, or `apiJson`.

Use `parserStatus` values: `cached`, `needs_review`, `needs_parser`, `source_missing`, `unavailable`, `skip`.

## 4. Import Manual Sources

```bash
npm run meetings:import:manual
```

The importer merges real manual-cache records into the generated public meeting files. If text cannot be confidently parsed, it creates a reviewable “Needs review” topic record rather than discarding the source.

## 5. Report Coverage

```bash
npm run meetings:report
```

This shows blocked, cached, parsed, partially parsed, and missing provider status. The app also writes:

```text
data/generated/public-meeting-manual-provider-report.json
```

## 6. Verify

Run the app and open `/events`. Manual-cache agenda/topic records are labeled:

```text
Imported from saved official source
```

Keep source paths and official URLs visible during review. If the text is unclear, leave the record marked `Needs review`.
