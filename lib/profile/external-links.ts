import type { ExternalLinkPlatform, ExternalLinkSummary } from "@/types/domain";

export const EXTERNAL_LINK_FIELDS: Array<{
  platform: ExternalLinkPlatform;
  label: string;
  inputName: string;
  placeholder: string;
}> = [
  {
    platform: "website",
    label: "Website",
    inputName: "externalLinkWebsite",
    placeholder: "https://example.com",
  },
  {
    platform: "linkedin",
    label: "LinkedIn",
    inputName: "externalLinkLinkedin",
    placeholder: "https://www.linkedin.com/in/your-name",
  },
  {
    platform: "instagram",
    label: "Instagram",
    inputName: "externalLinkInstagram",
    placeholder: "https://www.instagram.com/your-name",
  },
  {
    platform: "x",
    label: "X",
    inputName: "externalLinkX",
    placeholder: "https://x.com/your-handle",
  },
  {
    platform: "facebook",
    label: "Facebook",
    inputName: "externalLinkFacebook",
    placeholder: "https://www.facebook.com/your-page",
  },
  {
    platform: "youtube",
    label: "YouTube",
    inputName: "externalLinkYoutube",
    placeholder: "https://www.youtube.com/@your-channel",
  },
  {
    platform: "tiktok",
    label: "TikTok",
    inputName: "externalLinkTiktok",
    placeholder: "https://www.tiktok.com/@your-handle",
  },
  {
    platform: "newsletter",
    label: "Newsletter / Substack",
    inputName: "externalLinkNewsletter",
    placeholder: "https://your-publication.substack.com",
  },
];

export function normalizeExternalLinkUrl(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function isExternalLinkSummary(value: unknown): value is ExternalLinkSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const link = value as Record<string, unknown>;
  return (
    typeof link.platform === "string" &&
    EXTERNAL_LINK_FIELDS.some((field) => field.platform === link.platform) &&
    typeof link.url === "string" &&
    Boolean(normalizeExternalLinkUrl(link.url))
  );
}

export function normalizeExternalLinks(links: ExternalLinkSummary[] | null | undefined) {
  const deduped = new Map<ExternalLinkPlatform, string>();

  for (const link of links ?? []) {
    const normalizedUrl = normalizeExternalLinkUrl(link.url);

    if (!normalizedUrl) {
      continue;
    }

    if (!EXTERNAL_LINK_FIELDS.some((field) => field.platform === link.platform)) {
      continue;
    }

    deduped.set(link.platform, normalizedUrl);
  }

  return EXTERNAL_LINK_FIELDS.flatMap((field) => {
    const url = deduped.get(field.platform);

    return url ? [{ platform: field.platform, url }] : [];
  });
}

export function mergeExternalLinksWithWebsite(
  externalLinks: ExternalLinkSummary[] | null | undefined,
  websiteUrl: string | null | undefined,
) {
  const merged = [...normalizeExternalLinks(externalLinks)];
  const normalizedWebsiteUrl = normalizeExternalLinkUrl(websiteUrl);

  if (!normalizedWebsiteUrl || merged.some((link) => link.platform === "website")) {
    return merged;
  }

  return [{ platform: "website" as const, url: normalizedWebsiteUrl }, ...merged];
}
