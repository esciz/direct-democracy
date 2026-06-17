"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NewsSourceAccessMethod, NewsSourceType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server/auth-session";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readLines(formData: FormData, key: string) {
  return readString(formData, key)
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (user.role !== "admin" && user.role !== "platform_admin") {
    redirect("/profile");
  }
}

export async function saveNewsSourceAction(formData: FormData) {
  await requireAdmin();
  const sourceName = readString(formData, "sourceName");
  const sourceUrl = readString(formData, "sourceUrl");
  if (!sourceName || !sourceUrl) throw new Error("Source name and URL are required.");

  const rawSlug = readString(formData, "sourceSlug") || sourceName;
  const sourceSlug = slugify(rawSlug);
  const sourceDomain = readString(formData, "sourceDomain") || new URL(sourceUrl).hostname.replace(/^www\./, "");
  const sourceTypeValue = readString(formData, "sourceType");
  const accessMethodValue = readString(formData, "accessMethod");
  const sourceType = sourceTypeValue in NewsSourceType ? (sourceTypeValue as NewsSourceType) : NewsSourceType.local_news;
  const accessMethod = accessMethodValue in NewsSourceAccessMethod ? (accessMethodValue as NewsSourceAccessMethod) : NewsSourceAccessMethod.rss_or_html;

  await prisma.newsSource.upsert({
    where: { sourceSlug },
    create: {
      sourceName,
      sourceSlug,
      sourceUrl,
      sourceDomain,
      jurisdiction: readString(formData, "jurisdiction") || null,
      sourceType,
      accessMethod,
      rssUrl: readString(formData, "rssUrl") || null,
      searchUrlTemplate: readString(formData, "searchUrlTemplate") || null,
      categoryUrls: readLines(formData, "categoryUrls"),
      sitemapUrl: readString(formData, "sitemapUrl") || null,
      defaultQueryTerms: readLines(formData, "defaultQueryTerms"),
      active: formData.get("active") === "on",
      refreshFrequency: readString(formData, "refreshFrequency") || "daily",
      notes: readString(formData, "notes") || null,
    },
    update: {
      sourceName,
      sourceUrl,
      sourceDomain,
      jurisdiction: readString(formData, "jurisdiction") || null,
      sourceType,
      accessMethod,
      rssUrl: readString(formData, "rssUrl") || null,
      searchUrlTemplate: readString(formData, "searchUrlTemplate") || null,
      categoryUrls: readLines(formData, "categoryUrls"),
      sitemapUrl: readString(formData, "sitemapUrl") || null,
      defaultQueryTerms: readLines(formData, "defaultQueryTerms"),
      active: formData.get("active") === "on",
      refreshFrequency: readString(formData, "refreshFrequency") || "daily",
      notes: readString(formData, "notes") || null,
    },
  });

  revalidatePath("/admin/data-factory/news-sources");
  redirect(`/admin/data-factory/news-sources?saved=${sourceSlug}`);
}

export async function seedCarsonNowNewsSource() {
  await prisma.newsSource.upsert({
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
      defaultQueryTerms: ["Carson City", "Board of Supervisors", "Mayor", "Clerk-Recorder", "Assessor", "Sheriff", "District Attorney", "School Board", "Planning Commission", "elections", "ballot question", "campaign", "candidate"],
      active: true,
      refreshFrequency: "daily",
      notes: "Metadata-only Carson City local news source. Prefer RSS/category/search pages; no full article text storage.",
    },
    update: {
      active: true,
      sourceUrl: "https://www.carsonnow.org/",
      sourceDomain: "carsonnow.org",
      rssUrl: "https://www.carsonnow.org/feed",
      searchUrlTemplate: "https://www.carsonnow.org/search/node/{query}",
      categoryUrls: ["https://www.carsonnow.org/categories/news", "https://www.carsonnow.org/categories/government"],
      refreshFrequency: "daily",
    },
  });
}
