import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  absolutizeUrl,
  ensureNvSosDirs,
  inferExpectedContentType,
  inferSourceTypeFromUrl,
  listFilesRecursive,
  NV_SOS_PATHS,
  readJsonFile,
  readNvSosSources,
  safeFileStem,
  sha256,
  stripHtml,
  writeJsonFile,
  type NvSosDiscoveredSource,
  type NvSosFetchLogEntry,
} from "../lib/nv-sos/pipeline";

type CandidateLink = {
  href: string;
  text: string | null;
};

function extractAnchorLinks(html: string): CandidateLink[] {
  const links: CandidateLink[] = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    links.push({ href: match[1], text: stripHtml(match[2]) || null });
  }
  return links;
}

function extractLooseLinks(html: string): CandidateLink[] {
  const links: CandidateLink[] = [];
  const htmlWithoutAnchors = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ");
  const patterns = [
    /(?:ShowDocument\.aspx\?(?:id|documentid)=\d+)/gi,
    /(?:ViewCCEReport\.aspx\?syn=[^"' <>)]+)/gi,
    /(?:BrowseReports\.aspx\?nd=[^"' <>)]+)/gi,
    /(?:[^"'<>]*?(?:CE Report\s*\d*|Candidate Financial Disclosure|Annual CE Filing)[^"'<>]*?\.htm)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of htmlWithoutAnchors.matchAll(pattern)) {
      links.push({ href: match[0].replace(/&amp;/g, "&"), text: null });
    }
  }

  return links;
}

function interesting(link: CandidateLink) {
  const combined = `${link.href} ${link.text ?? ""}`;
  return /ShowDocument\.aspx\?(id|documentid)=|ViewCCEReport\.aspx\?syn=|BrowseReports\.aspx|CE Report|Candidate Financial Disclosure|Annual CE Filing/i.test(combined);
}

function validDiscoveredUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (/ViewCCEReport\.aspx$/i.test(parsed.pathname)) {
      const syn = parsed.searchParams.get("syn") ?? "";
      return syn.length >= 8 && !/\\/.test(syn);
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await ensureNvSosDirs();
  const fetchLog = await readJsonFile<NvSosFetchLogEntry[]>(NV_SOS_PATHS.fetchLog, []);
  const seedSources = await readNvSosSources();
  const sourceByCachedPath = new Map(
    fetchLog
      .filter((entry): entry is NvSosFetchLogEntry & { cached_path: string } => Boolean(entry.cached_path) && entry.status === "success_html")
      .map((entry) => [entry.cached_path, entry]),
  );
  const htmlFilesFromLog = [...sourceByCachedPath.keys()].map((filePath) => path.join(process.cwd(), filePath));
  const htmlFiles = fetchLog.length ? htmlFilesFromLog : await listFilesRecursive(NV_SOS_PATHS.htmlDir);
  const previous = await readJsonFile<NvSosDiscoveredSource[]>(NV_SOS_PATHS.generatedSources, []);
  const discovered: NvSosDiscoveredSource[] = [];

  for (const htmlPath of htmlFiles) {
    const relativePath = path.relative(process.cwd(), htmlPath);
    const logEntry = sourceByCachedPath.get(relativePath);
    const baseUrl = logEntry?.source_url ?? "https://www.nvsos.gov/";
    const html = await readFile(htmlPath, "utf8");
    const links = [...extractAnchorLinks(html), ...extractLooseLinks(html)].filter(interesting);

    for (const link of links) {
      const normalizedUrl = absolutizeUrl(link.href, baseUrl);
      if (!normalizedUrl) continue;
      if (!validDiscoveredUrl(normalizedUrl)) continue;
      const id = `discovered-${safeFileStem(normalizedUrl)}-${sha256(normalizedUrl).slice(0, 8)}`;
      discovered.push({
        id,
        source_type: inferSourceTypeFromUrl(normalizedUrl, link.text ?? ""),
        source_url: normalizedUrl,
        candidate_name: null,
        office_name: null,
        jurisdiction: "Nevada",
        election_year: null,
        expected_content_type: inferExpectedContentType(normalizedUrl, link.text ?? ""),
        notes: `Discovered from cached Nevada SoS HTML${link.text ? `: ${link.text}` : ""}`,
        enabled: true,
        discovered_from_source_id: logEntry?.source_id ?? "cached-html",
        discovered_from_url: baseUrl,
        discovered_at: new Date().toISOString(),
        link_text: link.text,
      });
    }
  }

  const sourcePool = discovered.length ? discovered : previous;
  const knownUrls = new Set(seedSources.map((source) => source.source_url));
  const merged = sourcePool.filter((source) => !knownUrls.has(source.source_url));
  const deduped = [...new Map(merged.map((source) => [source.source_url, source])).values()];
  await writeJsonFile(NV_SOS_PATHS.generatedSources, deduped);
  console.log(`Discovered ${deduped.length} Nevada SoS sources (${discovered.length} candidates from this run).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
