# Issue Position Integration Audit

## Existing Model

- Issues already exist as a product concept, not as a single `Issue` table. The reusable issue identity layer is `lib/issues/utils.ts`, especially `CANONICAL_ISSUE_TOPICS`, `slugifyIssueText`, and canonicalization helpers.
- Issue pages are built from `TopIssueSubmission`, `IssueSnapshot`, `IssueFollow`, user profile issue fields, and the canonical taxonomy through `lib/server/issues.ts`.
- Actions already exist through `ContactAction`, `OfficialAction`, `OfficialActionReaction`, `components/domain/official-action-card.tsx`, and `/take-action`.
- Voting already has a real-data model in `VoteQuestion`, `VoteResponse`, `CivicEntityReview`, and `CivicSentimentAggregate`. `/voting` reads approved, source-attributed real-data questions one at a time.
- Candidate and official profiles already have imported public profile UX, source attribution, pending enrichment states, sentiment placeholders, and action cards.

## Reuse Decisions

- Reuse the canonical issue taxonomy in `lib/issues/utils.ts` for issue text and route slugs.
- Reuse existing issue pages under `/issues/[issueId]` instead of creating a candidate issue hub.
- Reuse `VoteQuestion` for public sentiment questions generated from reviewed issue positions.
- Reuse existing action entry points: `/take-action`, issue follow/save, `/voting`, candidate comparison, and profile claim/correction paths.
- Reuse existing `CivicRecordReviewStatus`, `Source`, `Candidate`, `Official`, and real-data source attribution patterns.

## Required Extension

The current schema cannot express a sourced candidate or official stance on a canonical issue, confidence, derivation, or position-change timeline. Add a relationship table:

- `IssuePosition`: links one candidate or official to an existing canonical issue slug/text, with sourced evidence, confidence, review status, and official/inferred/unknown status.
- `IssuePositionChange`: stores timeline changes without silently overwriting previous positions.

## Do Not Duplicate

- Do not add a second issue taxonomy or issue page system.
- Do not add a separate voting question system for issue positions.
- Do not create fake candidate/official positions when no approved source exists.
- Do not scrape or enrich during page render; pages read stored data only.

## Where Positions Live

Candidate and official issue positions live in `IssuePosition`, normalized to the existing issue slug/text from `lib/issues/utils.ts`. Public pages only display approved or verified records. Missing data renders as a pending state.
