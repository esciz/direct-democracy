export async function fetchOfficialHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Direct Democracy Nevada Beta Importer (+https://directdemocracy.app)",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export function decodeHtml(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#160;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&rsquo;", "'")
    .replaceAll("&ldquo;", "\"")
    .replaceAll("&rdquo;", "\"")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveOfficialUrl(baseUrl: string, href: string) {
  return new URL(href, baseUrl).toString();
}

export function decodeCloudflareEmail(encoded: string) {
  const key = Number.parseInt(encoded.slice(0, 2), 16);
  let email = "";

  for (let index = 2; index < encoded.length; index += 2) {
    email += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key);
  }

  return email;
}

export function firstMatch(value: string, pattern: RegExp) {
  const match = value.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : undefined;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

