# Nevada Beta Data Architecture

Direct Democracy's Nevada Beta Data Foundation adds a production-oriented civic data layer without replacing the seeded prototype experience. The visible product can still run from demo data, while the normalized civic tables, source registry, and ingestion contracts prepare the app for real Nevada records.

## Scope

This phase covers:

- Nevada State Government
- Nevada Legislature
- Nevada Federal Delegation
- Carson City, Nevada
- Reno, Nevada
- Washoe County, Nevada
- University of Nevada, Reno
- Associated Students of the University of Nevada

## Existing Schema Audit

The repository already had partial civic concepts:

- `Jurisdiction`
- `Election`
- `CandidateCampaign`
- `PublicProfile`
- `OfficialPosition`
- `OfficialProfile`
- `Organization`
- `OfficialAction`
- `Petition`
- `CommunityEvent`

Those models were useful for the prototype, but they were not a complete ingestion-ready civic data model. Missing or under-normalized areas included:

- durable `Source` records with sync state, cursor, and error logs
- normalized offices separate from office title strings
- normalized officeholders separate from app user profiles
- districts with boundary metadata
- candidates connected directly to source-backed elections and offices
- ballot initiatives connected to elections
- legislative bills, sponsors, vote events, and per-official vote records
- committees and committee membership
- public meetings and agenda items
- campaign finance filing metadata
- political advertisement archive metadata
- production-friendly organization records that do not require a demo founder user

The new schema keeps the existing prototype models intact and adds normalized civic models beside them. `Election`, `Jurisdiction`, and `Organization` were extended because they already represent durable domain concepts.

## Core Models

New or expanded normalized entities:

- `Jurisdiction`
- `Office`
- `Official`
- `District`
- `Election`
- `Candidate`
- `BallotInitiative`
- `LegislativeBill`
- `BillSponsor`
- `LegislativeVote`
- `LegislativeVoteRecord`
- `Committee`
- `CommitteeMember`
- `Meeting`
- `AgendaItem`
- `CampaignFinanceFiling`
- `Organization`
- `PoliticalAdvertisement`
- `Source`
- `SourceSyncRun`

Key relationships:

- `Official -> Office`
- `Office -> Jurisdiction`
- `Office -> District`
- `Candidate -> Election`
- `Candidate -> Office`
- `Candidate -> District`
- `BallotInitiative -> Election`
- `LegislativeBill -> Jurisdiction`
- `BillSponsor -> LegislativeBill`
- `BillSponsor -> Official`
- `LegislativeVote -> LegislativeBill`
- `LegislativeVoteRecord -> Official`
- `CommitteeMember -> Official`
- `Meeting -> Committee`
- `AgendaItem -> Meeting`
- `AgendaItem -> LegislativeBill`
- `CampaignFinanceFiling -> Candidate`
- `CampaignFinanceFiling -> Organization`
- `PoliticalAdvertisement -> Candidate`
- `PoliticalAdvertisement -> Organization`
- all imported civic records can be attributed to `Source`

## Source Registry

Source definitions live in:

```txt
lib/civic-data/source-definitions.ts
```

Each source stores:

- source name
- source type
- URL
- adapter key
- jurisdiction slug
- last sync timestamp
- sync status
- sync cursor
- error log

Initial Nevada Beta sources:

- Nevada Electronic Legislative Information System: `https://www.leg.state.nv.us/Redir/toCurrentNELIS.cfm`
- Nevada Secretary of State Elections: `https://www.nvsos.gov/sos/elections`
- City of Reno Government: `https://www.reno.gov/government`
- Carson City Government: `https://www.carson.org/`
- Washoe County Government: `https://www.washoecounty.gov/`
- Nevada public boards and commissions

## Ingestion Architecture

Adapter contracts live in:

```txt
lib/civic-data/types.ts
lib/civic-data/adapters/
```

Every adapter supports:

- manual sync through `manualSyncSourceAction`
- scheduled sync through `syncScheduledNevadaBetaSources`
- incremental sync cursor passthrough
- normalized output structures
- structured issue reporting
- persisted source status and import run history

Current adapters are registered for:

- Nevada Legislature
- Nevada Secretary of State
- Reno
- Carson City
- Washoe County

Adapters currently return normalized empty payloads with an informational issue. This is intentional: the framework is ready for real parsers, but this phase does not create fake civic records.

## Admin Routes

The admin section includes:

- `/admin/data`
- `/admin/sources`
- `/admin/imports`
- `/admin/officials`
- `/admin/elections`
- `/admin/initiatives`

Dashboard metrics:

- officials
- elections
- bills
- initiatives
- meetings
- ads
- data sources

Admin pages are gated to `admin` users and use safe fallbacks so the prototype shell still renders when `DATABASE_URL` is absent or the database is unavailable.

## Parser Implementation Notes

Parser work should follow this sequence:

1. Add fixture-free fetch/parsing code inside the relevant adapter.
2. Return normalized records using `NormalizedCivicData`.
3. Add upsert logic in the ingestion service for one entity family at a time.
4. Preserve `sourceId + externalId` uniqueness for incremental updates.
5. Store raw source payload fragments only in `rawData` fields where auditability requires it.
6. Keep parser errors in `Source.errorLog` and `SourceSyncRun.errorLog`.

Do not add mock civic records. If a parser is incomplete, return an empty normalized collection with an informational issue.
