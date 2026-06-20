# Direct Democracy Roadmap: Nevada Statewide

## Mission

Provide every Nevada resident with free, understandable, source-backed access to government actions, elections, spending, court cases, public meetings, and civic issues.

## Product Commitments

- Every summary should link back to original public sources.
- Coverage should start with the jurisdictions that affect the most Nevada residents.
- Community pages should exist before full ingestion is complete, with clear empty states and data completeness signals.
- The public app remains a free civic information and participation layer, not a production government voting system.
- Vote remains the flagship action and recurring participation signal.

## Priority 0: Freeze Expansion

Direct Democracy should not expand active local-government ingestion beyond Nevada until Nevada coverage is navigable and useful.

Do not prioritize:

- Arizona local governments
- Utah local governments
- California local governments
- national local-government coverage

Active roadmap scope:

- Nevada
- federal overlay for actions that affect Nevada

Everything else belongs in backlog until Nevada completion criteria are met.

## 12-Week Nevada Completion Plan

### Sprint 1: Complete Nevada Community Coverage

Goal: every Nevada county, incorporated city, and major community has a page.

Deliverables:

- Generate community records for all Nevada counties.
- Generate community records for priority incorporated cities and towns.
- Generate community records for major unincorporated communities where public data exists.
- Preserve pages even when ingestion is incomplete.
- Keep sections source-aware with placeholders and onboarding messages rather than blank states.

Success: users can browse every Nevada jurisdiction, even if some pages have limited data.

### Sprint 2: Meeting Coverage

Goal: every major Nevada jurisdiction has meeting ingestion.

Highest priority:

- Clark County
- Las Vegas
- Henderson
- North Las Vegas
- Clark County School District
- Reno
- Sparks
- Washoe County
- Carson City
- Nevada Legislature

Deliverables:

- Event created
- Agenda attached
- Simplified summary
- Vote extraction
- Source links

Success: users see upcoming and historical meetings statewide.

### Sprint 3: Voting Cards

Goal: turn agenda language into understandable civic questions.

Example transformation:

- Source language: `Resolution R25-113`
- Public card: `Should Clark County spend $2.4M on road improvements?`
- Source link: `Resolution R25-113`

Success: users understand government actions without reading full agendas.

### Sprint 4: Officials And Representation

Goal: make Who Represents Me useful.

Add:

- city officials
- county officials
- state legislators
- congressional delegation

Success: a Nevada resident can identify representation in seconds.

### Sprint 5: Campaign Finance

Goal: turn existing infrastructure into understandable public presentation.

Show:

- top donors
- donor industries
- fundraising trends
- expenditures
- finance timeline

Success: finance data becomes understandable.

### Sprint 6: Court Cases

Goal: launch Nevada public case coverage.

Prioritize:

- Nevada Supreme Court
- Nevada Court of Appeals
- high-impact district court cases

Then link cases to:

- issues
- officials
- communities

Success: cases become discoverable through communities and issues.

### Sprint 7: Federal Overlay

Goal: add federal context only after Nevada is solid.

Add:

- presidential executive actions
- major congressional bills
- Nevada congressional delegation
- major U.S. Supreme Court decisions

Success: the platform feels complete without requiring nationwide local ingestion.

### Sprint 8: Personalization

Goal: make the product sticky by letting users choose their civic context.

Example user selections:

- Carson City
- Washoe County
- Nevada
- Housing
- Education

Feed should show relevant:

- meetings
- votes
- cases
- officials
- spending

Success: residents can follow the civic actions most relevant to their places and issues.

## Phase 1: Nevada Launch

Goal: cover the jurisdictions that directly affect the vast majority of Nevada residents while establishing statewide infrastructure.

### Tier 1 Launch Coverage

| Jurisdiction | Coverage Areas |
| --- | --- |
| Carson City | Board of Supervisors, School District, Planning Commission, Elections, Budget and Spending |
| Reno | City Council, Planning Commission, Elections, Budget and Spending |
| Sparks | City Council, Planning Commission, Elections, Budget and Spending |
| Washoe County | County Commission, Major Departments, Elections, Budget and Spending |
| Las Vegas | City Council, Planning Commission, Elections, Budget and Spending |
| Henderson | City Council, Planning Commission, Elections, Budget and Spending |
| North Las Vegas | City Council, Planning Commission, Elections, Budget and Spending |
| Clark County | County Commission, Major Departments, Elections, Budget and Spending |
| Clark County School District | Board Meetings, Elections, Spending, Policy Actions |

### Statewide Coverage

| Area | Coverage |
| --- | --- |
| Nevada Legislature | Senate, Assembly, Committees, Bills, Votes, Fiscal Notes |
| Statewide Executive Offices | Governor, Lieutenant Governor, Attorney General, Secretary of State, Treasurer, Controller |
| Statewide Courts | Nevada Supreme Court, Nevada Court of Appeals, Significant Statewide Cases |
| Elections | Candidate Profiles, Ballot Questions, Campaign Finance, Election Results |

### Federal Layer

| Area | Coverage |
| --- | --- |
| Executive Branch | Presidential Actions, Executive Orders, Major Federal Agency Actions |
| Congress | Major Federal Legislation, Nevada Congressional Delegation |
| Federal Courts | U.S. Supreme Court, Major Federal Cases Affecting Nevada |

## Phase 2: Full Nevada Jurisdiction Coverage

Goal: every county and incorporated city in Nevada has a community page, meetings, officials, elections, issues, spending, and public records.

### Counties

- Churchill County
- Clark County
- Douglas County
- Elko County
- Esmeralda County
- Eureka County
- Humboldt County
- Lander County
- Lincoln County
- Lyon County
- Mineral County
- Nye County
- Pershing County
- Storey County
- Washoe County
- White Pine County
- Carson City

### Major Cities

- Las Vegas
- Henderson
- North Las Vegas
- Reno
- Sparks
- Carson City

### Additional Incorporated Cities

- Elko
- Mesquite
- Boulder City
- Fallon
- Fernley
- Winnemucca
- West Wendover
- Yerington

### Unincorporated Communities

Where data exists, include:

- Tonopah
- Pahrump
- Incline Village
- Gardnerville
- Minden
- Silver Springs
- Battle Mountain
- Ely
- Laughlin

## Generated Community Page Requirement

Every Nevada county and incorporated city should automatically receive a generated community page even before full ingestion exists.

Generated pages should include:

- community name and jurisdiction type
- known parent county or state relationship
- representatives when available
- meetings and votes when available
- elections and ballot items when available
- budget, spending, and campaign finance links when available
- courts and public records when available
- clear source attribution and last-updated metadata
- plain-English empty states for missing or pending data

## Success Criteria

A resident anywhere in Nevada can:

- find their community
- find their representatives
- review meetings and votes
- understand issues
- review spending
- review campaign finance
- follow court cases
- understand impacts in plain English

All summaries and civic records should link back to original public sources.

## Implementation Notes

- Treat this roadmap as a coverage and ingestion plan, not a promise that every source is live in the current prototype.
- Use stored, source-attributed records for public pages; do not fetch or scrape public sources during page render.
- Prefer seeded fallback records and polished empty states while ingestion is incomplete.
- Preserve demo profile switching and the existing `/voting`, `/explore`, `/profile`, and shared shell flows.
- Keep GovCRM and public civic records separated as described in `docs/product-architecture.md`.
