import {
  inferExpectedContentType,
  inferReportType,
  inferSourceTypeFromUrl,
  NV_SOS_PATHS,
  readJsonFile,
  safeFileStem,
  sha256,
  writeJsonFile,
  type NvSosDiscoveredSource,
  type NvSosExpandedSource,
  type NvSosStructuredDocument,
} from "../lib/nv-sos/pipeline";

function inferYear(value: string | null | undefined) {
  const match = value?.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

async function main() {
  const [discovered, structured] = await Promise.all([
    readJsonFile<NvSosDiscoveredSource[]>(NV_SOS_PATHS.generatedSources, []),
    readJsonFile<NvSosStructuredDocument[]>(NV_SOS_PATHS.structuredDocuments, []),
  ]);
  const parentById = new Map(structured.map((row) => [row.source_id, row]));
  const expanded = discovered.map((source): NvSosExpandedSource => {
    const parent = parentById.get(source.discovered_from_source_id);
    const linkText = source.link_text ?? "";
    const reportType = inferReportType(linkText);
    const sourceType = inferSourceTypeFromUrl(source.source_url, linkText);
    const sourceId = `expanded-${safeFileStem(source.source_url)}-${sha256(source.source_url).slice(0, 8)}`;
    return {
      id: sourceId,
      source_id: sourceId,
      source_type: sourceType,
      source_url: source.source_url,
      parent_source_id: source.discovered_from_source_id ?? null,
      candidate_name: parent?.candidate_name ?? source.candidate_name ?? null,
      office_name: parent?.office ?? source.office_name ?? null,
      jurisdiction: parent?.jurisdiction ?? source.jurisdiction ?? "Nevada",
      election_year: inferYear(linkText) ?? parent?.election_year ?? source.election_year ?? null,
      expected_content_type: inferExpectedContentType(source.source_url, linkText),
      discovery_context: {
        discovered_from_url: source.discovered_from_url ?? null,
        link_text: source.link_text ?? null,
        notes: reportType ? `Discovered campaign finance report: ${reportType}` : source.notes ?? null,
      },
      enabled: source.enabled,
    };
  });

  const deduped = [...new Map(expanded.map((source) => [source.source_url, source])).values()];
  await writeJsonFile(NV_SOS_PATHS.expandedSources, deduped);
  console.log(`Promoted ${deduped.length} discovered Nevada SoS source URL(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
