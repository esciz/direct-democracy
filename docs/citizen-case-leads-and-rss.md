# Citizen Case Leads and RSS Sources

## Citizen Case Leads

Sprint 1E adds a non-destructive intake architecture for public case leads. It is not a public upload workflow yet.

The intake file lives at `data/manual-sources/case-leads/intake.json`.

Lead records remain `pending_review` until an official public source is found. Direct Democracy should not publish sensitive/private details or generate a plain-English case summary from a citizen description alone.

Supported lead fields:

- case number
- court
- jurisdiction
- optional description
- optional public source link

Publication rule:

- pending leads are acquisition cues only
- verified public records can become case records
- plain-English summaries require source verification

## RSS Sources

RSS is supported as supplemental source metadata through `data/generated/nevada-rss-source-capabilities.json`.

RSS may help discover:

- official body news
- meeting updates
- public notices
- project updates
- local government news
- political ad/news monitoring leads

RSS does not replace agenda, minutes, packet, budget, election, campaign-finance, or court-record ingestion.
