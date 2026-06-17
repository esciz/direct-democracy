import { createHash } from "node:crypto";

import { NewsMentionProviderName, NewsSourceAccessMethod, NewsSourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type NewsSearchOptions = {
  pageSize?: number;
  from?: Date;
  to?: Date;
  language?: string;
  sourceSlug?: string;
};

export type NormalizedNewsResult = {
  title: string;
  sourceName: string;
  sourceDomain?: string | null;
  url: string;
  canonicalUrl?: string | null;
  publishedAt?: Date | null;
  snippetOrSummary?: string | null;
};

export type NewsProviderHealth = {
  ok: boolean;
  message: string;
};

export interface NewsProvider<RawResult = unknown> {
  providerName: NewsMentionProviderName;
  searchMentions(query: string, options?: NewsSearchOptions): Promise<RawResult[]>;
  normalizeResult(rawResult: RawResult): NormalizedNewsResult | null;
  healthCheck(): Promise<NewsProviderHealth>;
}

type LocalNewsRawResult = {
  title: string;
  url: string;
  canonicalUrl?: string | null;
  sourceName: string;
  sourceDomain: string;
  publishedAt?: string | null;
  snippetOrSummary?: string | null;
  matchedQuery?: string | null;
};

type NewsApiArticle = {
  source?: { id?: string | null; name?: string | null };
  author?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
  content?: string | null;
};

function getDomain(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function cleanSnippet(value: string | null | undefined) {
  if (!value) return null;
  return stripHtml(value).replace(/\s+/g, " ").trim().slice(0, 420) || null;
}

function stripHtml(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function absolutizeUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(stripHtml(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function itemBlocks(xml: string) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
}

function tagValue(block: string, tag: string) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block);
  return match ? stripHtml(match[1]) : null;
}

function parseRss(xml: string, baseUrl: string, sourceName: string, sourceDomain: string): LocalNewsRawResult[] {
  const results: LocalNewsRawResult[] = [];
  for (const block of itemBlocks(xml)) {
    const title = tagValue(block, "title");
    const link = tagValue(block, "link") ?? tagValue(block, "guid");
    if (!title || !link) continue;
    results.push({
      title,
      url: absolutizeUrl(link, baseUrl),
      canonicalUrl: absolutizeUrl(link, baseUrl),
      sourceName,
      sourceDomain,
      publishedAt: parseDate(tagValue(block, "pubDate") ?? tagValue(block, "dc:date")),
      snippetOrSummary: cleanSnippet(tagValue(block, "description")),
    });
  }
  return results;
}

function discoverRssUrls(html: string, baseUrl: string) {
  const urls = new Set<string>();
  for (const match of html.matchAll(/<link[^>]+(?:type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']|href=["']([^"']+)["'][^>]+type=["']application\/rss\+xml["'])/gi)) {
    urls.add(absolutizeUrl(match[1] ?? match[2], baseUrl));
  }
  for (const match of html.matchAll(/href=["']([^"']*(?:rss|feed)[^"']*)["'][^>]*>/gi)) {
    urls.add(absolutizeUrl(match[1], baseUrl));
  }
  return [...urls].slice(0, 6);
}

function parseArticleLinks(html: string, baseUrl: string, sourceName: string, sourceDomain: string): LocalNewsRawResult[] {
  const items = new Map<string, LocalNewsRawResult>();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawHref = match[1];
    const title = stripHtml(match[2]);
    if (!title || title.length < 12 || title.length > 180) continue;
    const url = absolutizeUrl(rawHref, baseUrl);
    if (!url.includes(sourceDomain)) continue;
    if (/\.(jpg|jpeg|png|gif|webp|pdf)$/i.test(url)) continue;
    items.set(url, { title, url, canonicalUrl: url, sourceName, sourceDomain, publishedAt: null, snippetOrSummary: null });
  }
  return [...items.values()].slice(0, 60);
}

function queryTokens(query: string) {
  return query
    .replace(/["']/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !["the", "and", "for", "with", "city", "nevada"].includes(token));
}

function resultMatchesQuery(result: LocalNewsRawResult, query: string) {
  const tokens = queryTokens(query);
  if (!tokens.length) return true;
  const haystack = `${result.title} ${result.snippetOrSummary ?? ""}`.toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

async function safeFetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "DirectDemocracyBot/0.1 (+metadata-only civic news ingestion)",
        accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

const localNewsFetchCache = new Map<string, Promise<string>>();

async function cachedFetchText(url: string) {
  const existing = localNewsFetchCache.get(url);
  if (existing) return existing;
  const next = safeFetchText(url).catch((error) => {
    localNewsFetchCache.delete(url);
    throw error;
  });
  localNewsFetchCache.set(url, next);
  return next;
}

export class NewsApiOrgProvider implements NewsProvider<NewsApiArticle> {
  providerName = NewsMentionProviderName.NEWS_API_ORG;

  constructor(private apiKey = process.env.NEWS_API_KEY) {}

  async healthCheck(): Promise<NewsProviderHealth> {
    return this.apiKey ? { ok: true, message: "NewsAPI key is configured." } : { ok: false, message: "NEWS_API_KEY is not configured." };
  }

  async searchMentions(query: string, options: NewsSearchOptions = {}) {
    const health = await this.healthCheck();
    if (!health.ok || !this.apiKey) {
      throw new Error(health.message);
    }

    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", query);
    url.searchParams.set("language", options.language ?? "en");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", String(Math.max(1, Math.min(options.pageSize ?? 10, 100))));
    if (options.from) url.searchParams.set("from", options.from.toISOString());
    if (options.to) url.searchParams.set("to", options.to.toISOString());

    const response = await fetch(url, {
      headers: {
        "X-Api-Key": this.apiKey,
      },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message ?? `NewsAPI request failed with status ${response.status}.`);
    }

    return Array.isArray(payload?.articles) ? payload.articles : [];
  }

  normalizeResult(rawResult: NewsApiArticle): NormalizedNewsResult | null {
    const title = rawResult.title?.replace(/\s+/g, " ").trim();
    const url = rawResult.url?.trim();

    if (!title || !url) return null;

    return {
      title,
      sourceName: rawResult.source?.name?.trim() || getDomain(url) || "News source",
      sourceDomain: getDomain(url),
      url,
      canonicalUrl: url,
      publishedAt: rawResult.publishedAt ? new Date(rawResult.publishedAt) : null,
      snippetOrSummary: cleanSnippet(rawResult.description),
    };
  }
}

export class GenericLocalNewsProvider implements NewsProvider<LocalNewsRawResult> {
  providerName: NewsMentionProviderName = NewsMentionProviderName.LOCAL_CONFIGURED;

  constructor(private sourceSlug?: string) {}

  async getSource() {
    const source = this.sourceSlug
      ? await prisma.newsSource.findUnique({ where: { sourceSlug: this.sourceSlug } })
      : await prisma.newsSource.findFirst({ where: { active: true }, orderBy: { updatedAt: "desc" } });
    return source;
  }

  async healthCheck(): Promise<NewsProviderHealth> {
    const source = await this.getSource().catch(() => null);
    if (!source) return { ok: false, message: "No active local news source is configured." };
    if (!source.active) return { ok: false, message: `${source.sourceName} is disabled.` };
    return { ok: true, message: `${source.sourceName} is configured for ${source.accessMethod}.` };
  }

  async candidateUrls(sourceUrl: string, query: string, options: NewsSearchOptions) {
    const source = await this.getSource();
    if (!source) return [];
    const urls: string[] = [];
    if (source.rssUrl) urls.push(source.rssUrl);
    if (source.sitemapUrl) urls.push(source.sitemapUrl);
    urls.push(...source.categoryUrls);
    if (source.searchUrlTemplate) {
      urls.push(source.searchUrlTemplate.replaceAll("{query}", encodeURIComponent(query)));
    }
    if (!urls.length) urls.push(source.sourceUrl);
    return [...new Set(urls)].slice(0, Math.max(1, Math.min(options.pageSize ?? 10, 10)));
  }

  async searchMentions(query: string, options: NewsSearchOptions = {}) {
    const source = await this.getSource();
    if (!source) return [];
    await prisma.newsSource.update({ where: { id: source.id }, data: { lastCheckedAt: new Date(), lastError: null } }).catch(() => null);
    const sourceDomain = source.sourceDomain ?? getDomain(source.sourceUrl) ?? "";
    const urls = await this.candidateUrls(source.sourceUrl, query, options);
    const results: LocalNewsRawResult[] = [];
    for (const url of urls) {
      const text = await cachedFetchText(url).catch(() => "");
      if (!text) continue;
      const parsed = /<rss|<feed|<item/i.test(text) ? parseRss(text, source.sourceUrl, source.sourceName, sourceDomain) : parseArticleLinks(text, source.sourceUrl, source.sourceName, sourceDomain);
      results.push(...parsed.filter((item) => resultMatchesQuery(item, query)).map((item) => ({ ...item, matchedQuery: query })));
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await prisma.newsSource.update({ where: { id: source.id }, data: { lastSuccessAt: new Date() } }).catch(() => null);
    return [...new Map(results.map((result) => [result.canonicalUrl ?? result.url, result])).values()].slice(0, options.pageSize ?? 10);
  }

  normalizeResult(rawResult: LocalNewsRawResult): NormalizedNewsResult | null {
    if (!rawResult.title || !rawResult.url) return null;
    return {
      title: rawResult.title,
      sourceName: rawResult.sourceName,
      sourceDomain: rawResult.sourceDomain,
      url: rawResult.url,
      canonicalUrl: rawResult.canonicalUrl ?? rawResult.url,
      publishedAt: rawResult.publishedAt ? new Date(rawResult.publishedAt) : null,
      snippetOrSummary: cleanSnippet(rawResult.snippetOrSummary),
    };
  }
}

export class CarsonNowProvider extends GenericLocalNewsProvider {
  providerName: NewsMentionProviderName = NewsMentionProviderName.CARSON_NOW;

  constructor() {
    super("carson_now");
  }

  async ensureSource() {
    return prisma.newsSource.upsert({
      where: { sourceSlug: "carson_now" },
      create: {
        sourceName: "Carson Now",
        sourceSlug: "carson_now",
        sourceUrl: "https://www.carsonnow.org/",
        sourceDomain: "carsonnow.org",
        jurisdiction: "Carson City / Northern Nevada",
        sourceType: NewsSourceType.local_news,
        accessMethod: NewsSourceAccessMethod.rss_or_html,
        rssUrl: "https://www.carsonnow.org/feed",
        searchUrlTemplate: "https://www.carsonnow.org/search/node/{query}",
        categoryUrls: ["https://www.carsonnow.org/categories/news", "https://www.carsonnow.org/categories/government"],
        defaultQueryTerms: ["Carson City", "Board of Supervisors", "elections", "campaign", "candidate"],
        active: true,
        refreshFrequency: "daily",
        notes: "Metadata-only local news ingestion. Prefer RSS/category/search pages; do not store full article text.",
      },
      update: {
        sourceName: "Carson Now",
        sourceUrl: "https://www.carsonnow.org/",
        sourceDomain: "carsonnow.org",
        jurisdiction: "Carson City / Northern Nevada",
        active: true,
        refreshFrequency: "daily",
        rssUrl: "https://www.carsonnow.org/feed",
        searchUrlTemplate: "https://www.carsonnow.org/search/node/{query}",
        categoryUrls: ["https://www.carsonnow.org/categories/news", "https://www.carsonnow.org/categories/government"],
      },
    });
  }

  async getSource() {
    return this.ensureSource();
  }

  async searchMentions(query: string, options: NewsSearchOptions = {}) {
    const source = await this.ensureSource();
    await prisma.newsSource.update({ where: { id: source.id }, data: { lastCheckedAt: new Date(), lastError: null } }).catch(() => null);
    const urls = new Set<string>();
    if (source.rssUrl) urls.add(source.rssUrl);
    const home = source.rssUrl ? "" : await cachedFetchText(source.sourceUrl).catch(() => "");
    if (home) discoverRssUrls(home, source.sourceUrl).forEach((url) => urls.add(url));
    if (source.searchUrlTemplate) urls.add(source.searchUrlTemplate.replaceAll("{query}", encodeURIComponent(query)));
    source.categoryUrls.slice(0, 1).forEach((url) => urls.add(url));

    const sourceDomain = source.sourceDomain ?? "carsonnow.org";
    const results: LocalNewsRawResult[] = [];
    for (const url of [...urls].slice(0, 3)) {
      const text = url === source.sourceUrl && home ? home : await cachedFetchText(url).catch(() => "");
      if (!text) continue;
      const parsed = /<rss|<feed|<item/i.test(text) ? parseRss(text, source.sourceUrl, source.sourceName, sourceDomain) : parseArticleLinks(text, source.sourceUrl, source.sourceName, sourceDomain);
      results.push(...parsed.filter((item) => resultMatchesQuery(item, query)).map((item) => ({ ...item, matchedQuery: query })));
      if (results.length >= (options.pageSize ?? 10)) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    await prisma.newsSource.update({ where: { id: source.id }, data: { lastSuccessAt: new Date() } }).catch(() => null);
    return [...new Map(results.map((result) => [result.canonicalUrl ?? result.url, result])).values()].slice(0, options.pageSize ?? 10);
  }
}

class StubNewsProvider implements NewsProvider<unknown> {
  constructor(
    public providerName: NewsMentionProviderName,
    private label: string,
  ) {}

  async healthCheck(): Promise<NewsProviderHealth> {
    return { ok: false, message: `${this.label} provider is registered but not implemented yet.` };
  }

  async searchMentions(): Promise<unknown[]> {
    return [];
  }

  normalizeResult(): NormalizedNewsResult | null {
    return null;
  }
}

export class GoogleNewsRssProvider extends StubNewsProvider {
  constructor() {
    super(NewsMentionProviderName.GOOGLE_NEWS_RSS, "Google News RSS");
  }
}

export class GdeltProvider extends StubNewsProvider {
  constructor() {
    super(NewsMentionProviderName.GDELT, "GDELT");
  }
}

export class LocalRssProvider extends StubNewsProvider {
  constructor() {
    super(NewsMentionProviderName.LOCAL_RSS, "Local RSS");
  }
}

export class CustomCrawlerProvider extends StubNewsProvider {
  constructor() {
    super(NewsMentionProviderName.CUSTOM_CRAWLER, "Custom crawler");
  }
}

export function createNewsProvider(providerName: NewsMentionProviderName = NewsMentionProviderName.NEWS_API_ORG, options: { sourceSlug?: string } = {}): NewsProvider {
  switch (providerName) {
    case NewsMentionProviderName.NEWS_API_ORG:
      return new NewsApiOrgProvider();
    case NewsMentionProviderName.GOOGLE_NEWS_RSS:
      return new GoogleNewsRssProvider();
    case NewsMentionProviderName.GDELT:
      return new GdeltProvider();
    case NewsMentionProviderName.LOCAL_RSS:
      return new LocalRssProvider();
    case NewsMentionProviderName.CARSON_NOW:
      return new CarsonNowProvider();
    case NewsMentionProviderName.LOCAL_CONFIGURED:
      return new GenericLocalNewsProvider(options.sourceSlug);
    case NewsMentionProviderName.CUSTOM_CRAWLER:
      return new CustomCrawlerProvider();
    default:
      return new NewsApiOrgProvider();
  }
}

export function hashNewsValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
