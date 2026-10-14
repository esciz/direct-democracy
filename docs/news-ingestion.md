# News Mention Ingestion

Direct Democracy stores reviewed news mentions for existing civic records. Public candidate and official profiles read only from stored `NewsMention` rows with approved or verified review status.

## Provider Architecture

The app depends on the `NewsProvider` interface in `lib/news-mentions/providers.ts`:

- `providerName`
- `searchMentions(query, options)`
- `normalizeResult(rawResult)`
- `healthCheck()`

Registered providers:

- `NewsApiOrgProvider` is active for local development.
- `CarsonNowProvider` is active for Carson Now local news without a formal API.
- `GenericLocalNewsProvider` reads configured `NewsSource` records for future local publishers.
- `GoogleNewsRssProvider` is registered as a stub.
- `GdeltProvider` is registered as a stub.
- `LocalRssProvider` is registered as a stub.
- `CustomCrawlerProvider` is registered as a stub.

Provider results are normalized before storage so profile pages do not depend on NewsAPI-specific response shapes.

## NewsAPI Setup

Set the API key in local environment only:

```bash
NEWS_API_KEY="your-local-key"
```

The key is read with `process.env.NEWS_API_KEY`. Do not hardcode it, print it in logs, or commit real values. `.env.example` contains only a placeholder.

## Carson Now Local Source

Carson Now is configured as a local news source for Carson City and Northern Nevada civic coverage:

- source name: `Carson Now`
- source slug: `carson_now`
- source URL: `https://www.carsonnow.org/`
- source type: `local_news`
- access method: `rss_or_html`
- refresh frequency: `daily`

The MVP does not require an official API. The provider tries source pages in this order:

1. RSS feeds discovered from the homepage or configured in `NewsSource.rssUrl`
2. category/archive pages, such as news and government listings
3. search URL pages using a configured `{query}` template
4. manual seed URLs or homepage/index URLs when nothing else is configured

The provider uses conservative delays, does not bypass site protections, and does not fetch during public page render.

## Manual Import

Start the app, then run:

```bash
npm run civic:import-news-mentions
```

Useful options:

```bash
npm run civic:import-news-mentions -- --limit=5 --dailyCap=100 --pageSize=5
npm run civic:import-news-mentions -- --dryRun=true --limit=1
npm run civic:import-news-mentions -- --provider=carson_now --limit=50
npm run civic:import-local-news -- --source=carson_now --limit=50
npm run civic:import-local-news -- --all --limit=100
```

The script calls `/api/admin/news-mentions/import`. Local development can run without `CIVIC_IMPORT_SECRET`; production requires the secret as a bearer token or query parameter.

## Daily Limit Behavior

The importer defaults to `100` requests per day. It records every provider query in `NewsMentionSearchRun` and sums today's `requestCount` before making more requests.

The importer:

- does not fetch the same candidate or official more than once per day
- prioritizes targets with no existing news mentions
- prioritizes candidate races closest to their election date
- stores only title, source, date, URL, canonical URL, and a short snippet
- never stores full article text

For local publishers, snippets come from RSS descriptions or listing metadata when available. Article bodies are not stored.

## Review Workflow

Imported mentions are scored for confidence:

- High: exact full name plus office/race or campaign context plus Nevada context
- Medium: exact full name plus Nevada context
- Low: ambiguous or partial context

High-confidence matches may be marked `approved`; lower-confidence matches remain `pending_review`. Admins can approve, verify, reject, link to another candidate or official, flag incorrect matches, or mark duplicates at `/admin/news-mentions`.

Public users see only `approved` and `verified` mentions.

Carson Now/local confidence adds Carson City civic context:

- High: exact candidate or official full name plus Carson City, office, meeting, election, case, campaign, or government context
- Medium: exact full name only, or Carson City government/election context
- Low: partial names, generic topics, or ambiguous matches

Low-confidence local mentions remain `pending_review`.

## Configuring More Local Publishers

Use `/admin/data-factory/news-sources` to add or edit reusable local news source records. Future sources normalize into the same `NewsMention` table, so candidate, official, issue, and meeting pages do not need source-specific UI changes.

Supported fields:

- `source_name`
- `source_slug`
- `source_url`
- `source_domain`
- `jurisdiction`
- `source_type`: `local_news`, `government_newsroom`, `nonprofit_news`, `university_news`, `legal_news`, `other`
- `access_method`: `rss`, `html_index`, `search_page`, `sitemap`, `manual_urls`, `api`
- `rss_url`
- `search_url_template`
- `category_urls`
- `sitemap_url`
- `default_query_terms`
- `active`
- `refresh_frequency`
- `notes`

Examples to add later include This Is Reno, Reno Gazette Journal, Nevada Independent, KOLO, KRNV, KUNR, Nevada Current, Washoe County newsroom, City of Reno newsroom, Carson City newsroom, and UNR news.

Admin workflow:

1. Add source.
2. Test source.
3. Preview discovered articles in the review queue.
4. Approve source.
5. Run import.
6. View import history.
7. Disable source if noisy or broken.

If a publisher later offers an API or partnership feed, keep the same `NewsMention` normalized output and replace only the provider fetch/normalization layer.

## Deduplication

Mentions deduplicate by a hash of:

- canonical URL with tracking parameters removed
- normalized title
- source/domain
- publish date

This prevents repeated syndicated or repeated provider results from creating duplicate public cards.

## Adding GDELT Later

Implement `GdeltProvider.searchMentions` and `GdeltProvider.normalizeResult` in `lib/news-mentions/providers.ts`, then call `createNewsProvider(NewsMentionProviderName.GDELT)` from a scheduled job or admin action.

## Adding RSS Feeds Later

Prefer adding a `NewsSource` record and using `GenericLocalNewsProvider`. Implement a custom provider only when a publisher requires source-specific normalization. Normalize feed items to `NormalizedNewsResult`; do not store full feed article bodies.

## Adding a Custom Crawler Later

Implement `CustomCrawlerProvider` as a scheduled/admin-only crawler. It must respect robots.txt, rate limits, copyright safety, and the same storage rules: titles, URLs, source metadata, dates, and short snippets only.

## Page Render Rule

No public page runs live news lookup, scraping, RSS fetching, or provider calls during render. Candidate and official pages use `getPublicNewsMentions`, which reads stored rows only.
