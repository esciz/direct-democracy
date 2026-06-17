import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  PUBLIC_MEETING_PATHS,
  absolutePublicMeetingPath,
  inferPolicyArea,
  normalizeTextLines,
  normalizeWhitespace,
  slugify,
  stripHtml,
  summarizeText,
} from "@/lib/public-meetings/shared";
import { applyOfficialActionMatches, loadOfficialActionMatchCandidates } from "@/lib/public-meetings/official-action-matcher";
import { importPublicMeetingOfficialRosters } from "@/lib/public-meetings/official-rosters";
import { extractOfficialActionsForItem, extractTopicOutcome, itemHasUnnamedVoteOutcome } from "@/lib/public-meetings/official-actions";
import { buildMeetingVotingCards } from "@/lib/public-meetings/voting-cards";
import type {
  CitizenVoteQuestionRecord,
  ManualParserStatus,
  ManualPublicMeetingManifestEntry,
  ManualSourceKind,
  MeetingVotingCardRecord,
  MeetingIngestionStatus,
  MeetingItemType,
  OfficialMeetingActionRecord,
  PublicBodyLevel,
  PublicBodyRecord,
  PublicMeetingIngestionReport,
  PublicMeetingItemRecord,
  PublicMeetingManualProviderReport,
  PublicMeetingProviderReport,
  PublicMeetingRecord,
  PublicMeetingSourceMethod,
  PublicMeetingSourceSeed,
  RollCallStatus,
  VoteRecord,
} from "@/lib/public-meetings/types";

type ManualProviderDefinition = {
  id: string;
  name: string;
  jurisdiction: string;
  level: PublicBodyLevel;
  officialSourceUrl: string;
  folders: string[];
  readme: string;
};

type ManualImportResult = {
  meetings: PublicMeetingRecord[];
  items: PublicMeetingItemRecord[];
  votes: VoteRecord[];
  officialActions: OfficialMeetingActionRecord[];
  questions: CitizenVoteQuestionRecord[];
  report: PublicMeetingManualProviderReport[];
  errors: PublicMeetingIngestionReport["errors"];
};

const MANUAL_PROVIDER_DEFINITIONS: ManualProviderDefinition[] = [
  {
    id: "reno-city-council",
    name: "Reno City Council",
    jurisdiction: "Reno, NV",
    level: "city",
    officialSourceUrl: "https://reno.primegov.com/public/portal",
    folders: ["raw-pages", "agenda-packets", "agendas", "minutes", "metadata"],
    readme: "Save public PrimeGov meeting pages, exported network JSON, agendas, packets, and minutes here. Do not include non-public or authenticated content.",
  },
  {
    id: "nv-legislature",
    name: "Nevada Legislature",
    jurisdiction: "Nevada",
    level: "state",
    officialSourceUrl: "https://www.leg.state.nv.us/App/Calendar/A/",
    folders: ["raw-pages", "bills", "journals", "minutes", "votes", "metadata"],
    readme: "Save official Legislature committee pages, floor-session pages, journals, bill-action pages, vote pages, and PDFs here.",
  },
  {
    id: "nv-senate",
    name: "Nevada Senate",
    jurisdiction: "Nevada",
    level: "state",
    officialSourceUrl: "https://www.leg.state.nv.us/",
    folders: ["raw-pages", "bills", "journals", "minutes", "votes", "metadata"],
    readme: "Save official Nevada Senate floor session pages, journals, bills, minutes, vote pages, and PDFs here.",
  },
  {
    id: "nv-assembly",
    name: "Nevada Assembly",
    jurisdiction: "Nevada",
    level: "state",
    officialSourceUrl: "https://www.leg.state.nv.us/",
    folders: ["raw-pages", "bills", "journals", "minutes", "votes", "metadata"],
    readme: "Save official Nevada Assembly floor session pages, journals, bills, minutes, vote pages, and PDFs here.",
  },
];

const MANIFEST_TEMPLATE: ManualPublicMeetingManifestEntry[] = [];

function isStudentGovernmentScope(value: string | null | undefined) {
  return /\b(asun|student[-_\s]?government|student\s+senate|undergraduate\s+senate)\b/i.test(value ?? "");
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJsonFile<T>(relativePath: string, fallback: T): Promise<T> {
  const filePath = absolutePublicMeetingPath(relativePath);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJsonFile(relativePath: string, value: unknown) {
  const filePath = absolutePublicMeetingPath(relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeManifest(raw: unknown): ManualPublicMeetingManifestEntry[] {
  const entries = Array.isArray(raw) ? raw : typeof raw === "object" && raw && "entries" in raw ? (raw as { entries?: unknown[] }).entries ?? [] : [];
  return entries
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      providerId: String(entry.providerId ?? entry.provider_id ?? "").trim(),
      sourceName: String(entry.sourceName ?? entry.source_name ?? "").trim(),
      officialSourceUrl: stringOrNull(entry.officialSourceUrl ?? entry.official_source_url),
      downloadedAt: stringOrNull(entry.downloadedAt ?? entry.downloaded_at),
      fileType: String(entry.fileType ?? entry.file_type ?? "").trim(),
      meetingDate: stringOrNull(entry.meetingDate ?? entry.meeting_date),
      meetingTitle: stringOrNull(entry.meetingTitle ?? entry.meeting_title),
      governingBody: stringOrNull(entry.governingBody ?? entry.governing_body),
      sourceKind: normalizeSourceKind(entry.sourceKind ?? entry.source_kind),
      localPath: String(entry.localPath ?? entry.local_path ?? "").trim(),
      notes: stringOrNull(entry.notes),
      parserStatus: normalizeParserStatus(entry.parserStatus ?? entry.parser_status),
    }))
    .filter((entry) => entry.providerId && entry.localPath);
}

function stringOrNull(value: unknown) {
  const text = typeof value === "string" ? normalizeWhitespace(value) : value == null ? "" : normalizeWhitespace(String(value));
  return text || null;
}

function normalizeSourceKind(value: unknown): ManualSourceKind {
  const text = String(value ?? "").toLowerCase();
  if (text === "packet") return "packet";
  if (text === "minutes") return "minutes";
  if (text === "video") return "video";
  if (text === "vote") return "vote";
  if (text === "bill") return "bill";
  if (text === "journal") return "journal";
  if (text === "rawhtml" || text === "raw_html" || text === "html") return "rawHtml";
  if (text === "apijson" || text === "api_json" || text === "json") return "apiJson";
  return "agenda";
}

function normalizeParserStatus(value: unknown): ManualParserStatus {
  const text = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const allowed = new Set<ManualParserStatus>([
    "blank",
    "cached",
    "parsed",
    "partially_parsed",
    "needs_review",
    "needs_parser",
    "source_missing",
    "unavailable",
    "fixture",
    "skip",
  ]);
  return allowed.has(text as ManualParserStatus) ? (text as ManualParserStatus) : "cached";
}

function providerRoot(providerId: string) {
  return path.join(PUBLIC_MEETING_PATHS.manualSourcesRoot, providerId);
}

function providerManifestPath(providerId: string) {
  return path.join(providerRoot(providerId), "manifest.json");
}

function manifestReadme(provider: ManualProviderDefinition) {
  return `# ${provider.name} manual source cache

${provider.readme}

Workflow:
1. Open the official public archive in your browser: ${provider.officialSourceUrl}
2. Save public HTML, PDF, agenda packet, minutes, journal, vote, or JSON files into the matching folder.
3. Add one manifest entry per saved file in \`manifest.json\`.
4. Run \`npm run meetings:import:manual\`.
5. Verify imported official meeting records in \`/events\`.

Do not bypass authentication, CAPTCHAs, hidden endpoints, security controls, or non-public access restrictions.
`;
}

function exampleManifest(provider: ManualProviderDefinition) {
  return {
    providerId: provider.id,
    sourceName: provider.name,
    officialSourceUrl: provider.officialSourceUrl,
    downloadedAt: new Date().toISOString(),
    fileType: "html",
    meetingDate: null,
    meetingTitle: null,
    governingBody: provider.name,
    sourceKind: "rawHtml",
    localPath: "raw-pages/example-saved-page.html",
    notes: "Example only. Replace with a real saved official public source file.",
    parserStatus: "skip",
  };
}

async function seedFixtureFiles() {
  const fixtureRoot = path.join(PUBLIC_MEETING_PATHS.manualSourcesRoot, "_fixtures");
  await mkdir(absolutePublicMeetingPath(path.join(fixtureRoot, "reno-city-council", "raw-pages")), { recursive: true });
  await mkdir(absolutePublicMeetingPath(path.join(fixtureRoot, "nv-legislature", "raw-pages")), { recursive: true });
  await writeFile(
    absolutePublicMeetingPath(path.join(fixtureRoot, "reno-city-council", "raw-pages", "example-primegov.html")),
    `<!doctype html><html><body>
      <h1>Reno City Council Regular Meeting</h1>
      <time datetime="2025-05-14T10:00:00-07:00">May 14, 2025 10:00 AM</time>
      <section data-meeting-body="Reno City Council">
        <article class="agenda-item"><span class="item-number">A.1</span><h2>Public comment and approval of agenda</h2><p>For discussion only. No vote text included in fixture.</p></article>
        <article class="agenda-item"><span class="item-number">B.2</span><h2>Approve contract for public works project</h2><p>Recommendation to approve a public works contract. Vote details unavailable in fixture.</p></article>
      </section>
    </body></html>
`,
    "utf8",
  );
  await writeFile(
    absolutePublicMeetingPath(path.join(fixtureRoot, "nv-legislature", "raw-pages", "example-legislature.html")),
    `<!doctype html><html><body>
      <h1>Joint Interim Standing Committee on Government Affairs</h1>
      <p>Meeting Date: April 9, 2025 9:00 AM</p>
      <ol>
        <li>Opening remarks and roll call</li>
        <li>Presentation on local government operations</li>
        <li>Public comment</li>
      </ol>
    </body></html>
`,
    "utf8",
  );
  await writeJsonFile(path.join(fixtureRoot, "reno-city-council", "manifest.json"), {
    entries: [
      {
        providerId: "reno-city-council",
        sourceName: "Reno City Council fixture",
        officialSourceUrl: "https://reno.primegov.com/public/portal",
        downloadedAt: new Date().toISOString(),
        fileType: "html",
        meetingDate: "2025-05-14T10:00:00-07:00",
        meetingTitle: "Reno City Council Regular Meeting",
        governingBody: "Reno City Council",
        sourceKind: "rawHtml",
        localPath: "raw-pages/example-primegov.html",
        notes: "Parser fixture only; not imported by default.",
        parserStatus: "fixture",
      },
    ],
  });
  await writeJsonFile(path.join(fixtureRoot, "nv-legislature", "manifest.json"), {
    entries: [
      {
        providerId: "nv-legislature",
        sourceName: "Nevada Legislature fixture",
        officialSourceUrl: "https://www.leg.state.nv.us/App/Calendar/A/",
        downloadedAt: new Date().toISOString(),
        fileType: "html",
        meetingDate: "2025-04-09T09:00:00-07:00",
        meetingTitle: "Joint Interim Standing Committee on Government Affairs",
        governingBody: "Joint Interim Standing Committee on Government Affairs",
        sourceKind: "rawHtml",
        localPath: "raw-pages/example-legislature.html",
        notes: "Parser fixture only; not imported by default.",
        parserStatus: "fixture",
      },
    ],
  });
}

export async function bootstrapManualPublicMeetingSources() {
  await mkdir(absolutePublicMeetingPath(PUBLIC_MEETING_PATHS.manualSourcesRoot), { recursive: true });
  const providers = await providerDefinitions(false);
  for (const provider of providers) {
    for (const folder of provider.folders) {
      await mkdir(absolutePublicMeetingPath(path.join(providerRoot(provider.id), folder)), { recursive: true });
    }
    const manifestPath = providerManifestPath(provider.id);
    if (!existsSync(absolutePublicMeetingPath(manifestPath))) {
      await writeJsonFile(manifestPath, { entries: MANIFEST_TEMPLATE, example: exampleManifest(provider) });
    }
    await writeFile(absolutePublicMeetingPath(path.join(providerRoot(provider.id), "README.md")), manifestReadme(provider), "utf8");
  }
  await seedFixtureFiles();
  return providers.map((provider) => provider.id);
}

function inferDate(value: string) {
  const iso = value.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])(?:[T\s]+(\d{1,2}):(\d{2}))?/);
  if (iso) {
    const parsed = Date.parse(`${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}T${(iso[4] ?? "09").padStart(2, "0")}:${iso[5] ?? "00"}:00-07:00`);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  const longDate = value.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+20\d{2}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?/i);
  if (!longDate) return null;
  const parsed = Date.parse(`${longDate[0]} GMT-0700`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function inferItemType(text: string): MeetingItemType {
  const value = text.toLowerCase();
  if (/\bpublic comment\b/.test(value)) return "public_comment";
  if (/\bconsent\b/.test(value)) return "consent";
  if (/\bpublic hearing\b/.test(value)) return "public_hearing";
  if (/\bord(inance)?\b/.test(value)) return "ordinance";
  if (/\bresolution\b/.test(value)) return "resolution";
  if (/\bpresentation|proclamation|recognition\b/.test(value)) return "presentation";
  if (/\b(approve|adopt|authorize|award|accept|amend|contract|agreement|appoint|purchase|expenditure)\b/.test(value)) return "action";
  return "other";
}

function rollCallStatusFor(entry: ManualPublicMeetingManifestEntry, text: string): RollCallStatus {
  if (hasExplicitRollCallNames(text)) return "parsed";
  if (entry.sourceKind === "vote") return /\b(yes|no|aye|nay|abstain|absent|motion|second)\b/i.test(text) ? "needs_roll_call_review" : "needs parser";
  if (/\broll call|vote result|ayes?|nays?|motion carried|motion failed|second(?:ed)? by\b/i.test(text)) return "needs_roll_call_review";
  return entry.sourceKind === "minutes" ? "unavailable" : "source missing";
}

function bodyId(providerId: string, governingBody: string) {
  return `body-manual-${providerId}-${slugify(governingBody)}`;
}

function meetingId(providerId: string, governingBody: string, meetingDate: string | null, title: string, localPath: string) {
  return `meeting-manual-${providerId}-${slugify(governingBody)}-${meetingDate?.slice(0, 10) ?? "undated"}-${hashText(`${title}:${localPath}:${meetingDate ?? ""}`).slice(0, 8)}`;
}

function sourceKindToMeetingPatch(kind: ManualSourceKind, sourceUrl: string | null) {
  return {
    agenda_url: kind === "agenda" || kind === "rawHtml" || kind === "apiJson" ? sourceUrl : null,
    minutes_url: kind === "minutes" || kind === "journal" ? sourceUrl : null,
    packet_url: kind === "packet" ? sourceUrl : null,
    video_url: kind === "video" ? sourceUrl : null,
  };
}

async function readSourceText(providerId: string, entry: ManualPublicMeetingManifestEntry) {
  const sourcePath = absolutePublicMeetingPath(path.join(providerRoot(providerId), entry.localPath));
  if (!existsSync(sourcePath)) {
    return { text: "", error: `Manual source file missing: ${path.join(providerRoot(providerId), entry.localPath)}` };
  }
  const buffer = await readFile(sourcePath);
  const extension = path.extname(sourcePath).toLowerCase();
  if (extension === ".pdf") {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      return { text: normalizeTextLines(result.text ?? ""), error: null };
    } catch (error) {
      return { text: "", error: error instanceof Error ? error.message : String(error) };
    }
  }
  const raw = buffer.toString("utf8");
  if (entry.sourceKind === "apiJson" || extension === ".json") {
    try {
      return { text: normalizeTextLines(JSON.stringify(JSON.parse(raw), null, 2)), error: null };
    } catch {
      return { text: normalizeTextLines(raw), error: null };
    }
  }
  return { text: extension === ".html" || extension === ".htm" ? stripHtml(raw) : normalizeTextLines(raw), error: null };
}

type ManualItemDraft = {
  itemNumber: string | null;
  title: string;
  sourceText: string;
  confidence: number;
  agendaSection?: string | null;
  staffRecommendation?: string | null;
  departmentNames?: string[];
  affectedGroups?: string[];
};

function parsePrimeGovJsonItems(text: string): ManualItemDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const items: ManualItemDraft[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const title = stringOrNull(record.title ?? record.itemTitle ?? record.agendaItemTitle ?? record.subject ?? record.name ?? record.caption);
    const itemNumber = stringOrNull(record.itemNumber ?? record.number ?? record.sequence ?? record.order ?? record.agendaNumber);
    const detail = stringOrNull(record.description ?? record.body ?? record.content ?? record.agendaItemText ?? record.actionText ?? record.recommendation ?? record.notes);
    if (title && /\b(approve|adopt|authorize|award|accept|amend|contract|agreement|public hearing|presentation|ordinance|resolution|comment|agenda|minutes|vote)\b/i.test(`${title} ${detail ?? ""}`)) {
      items.push({
        itemNumber,
        title: summarizeText(title, 180),
        sourceText: summarizeText([title, detail].filter(Boolean).join(" "), 1800),
        confidence: detail ? 0.72 : 0.58,
        staffRecommendation: extractRecommendation(detail ?? title),
        departmentNames: extractDepartments(`${title} ${detail ?? ""}`),
        affectedGroups: extractAffectedGroups(`${title} ${detail ?? ""}`),
      });
    }
    Object.values(record).forEach(visit);
  };
  visit(parsed);
  return dedupeByTitle(items).slice(0, 180);
}

function parsePrimeGovItems(text: string) {
  const jsonItems = parsePrimeGovJsonItems(text);
  if (jsonItems.length) return jsonItems;
  const items: ManualItemDraft[] = [];
  const normalized = normalizeWhitespace(text);
  const agendaPattern = /\b([A-Z]?\d+(?:\.[A-Z0-9]+)*|[A-Z]\.\d+)\s+([A-Z][^.!?\n]{16,260}(?:approve|adopt|authorize|award|accept|amend|contract|agreement|public hearing|presentation|ordinance|resolution|comment)[^.!?\n]{0,420})/gi;
  for (const match of normalized.matchAll(agendaPattern)) {
    items.push({
      itemNumber: match[1],
      title: summarizeText(match[2], 180),
      sourceText: summarizeText(match[0], 1800),
      confidence: 0.64,
    });
  }
  return dedupeByTitle(items).slice(0, 120);
}

function parseLegislatureItems(text: string) {
  const lines = normalizeTextLines(text).split("\n").map(normalizeWhitespace).filter((line) => line.length > 12);
  const items: ManualItemDraft[] = [];
  for (const line of lines) {
    const numbered = line.match(/^(?:agenda\s+item\s+)?(\d{1,3}|[IVX]+|[A-Z])[\.)]\s+(.{12,260})/i);
    if (numbered) {
      items.push({ itemNumber: numbered[1], title: summarizeText(numbered[2], 180), sourceText: summarizeText(line, 1800), confidence: 0.62 });
      continue;
    }
    if (/\b(bill|journal|roll call|vote|committee|agenda|minutes|floor session|public comment|presentation|hearing)\b/i.test(line)) {
      items.push({ itemNumber: null, title: summarizeText(line, 180), sourceText: summarizeText(line, 1800), confidence: 0.48 });
    }
  }
  return dedupeByTitle(items).slice(0, 120);
}

function parsePacketItems(text: string) {
  const lines = normalizeTextLines(text).split("\n").map(normalizeWhitespace).filter((line) => line.length > 10);
  const chunks: ManualItemDraft[] = [];
  let current: string[] = [];
  const flush = () => {
    const sourceText = normalizeWhitespace(current.join(" "));
    current = [];
    if (sourceText.length < 24) return;
    const heading = sourceText.match(/^(?:agenda\s+item\s+)?([A-Z]?\d+(?:\.[A-Z0-9]+)*|[A-Z]\.\d+|[IVX]+)[\.)]?\s+(.{12,220})/i);
    const title = heading?.[2] ?? sourceText;
    chunks.push({
      itemNumber: heading?.[1] ?? null,
      title: summarizeText(title, 180),
      sourceText: summarizeText(sourceText, 2400),
      confidence: /\b(approve|adopt|authorize|award|accept|amend|contract|agreement|ordinance|resolution|public hearing|recommendation|fiscal impact|staff report)\b/i.test(sourceText) ? 0.66 : 0.48,
      agendaSection: sourceText.match(/\b(?:section|agenda)\s*[:\-]\s*([^.;\n]{2,80})/i)?.[1] ?? null,
      staffRecommendation: extractRecommendation(sourceText),
      departmentNames: extractDepartments(sourceText),
      affectedGroups: extractAffectedGroups(sourceText),
    });
  };
  for (const line of lines) {
    const startsItem = /^(?:agenda\s+item\s+)?(?:[A-Z]?\d+(?:\.[A-Z0-9]+)*|[A-Z]\.\d+|[IVX]+)[\.)]?\s+/.test(line) || /\b(for possible action|recommendation to|staff report|fiscal impact|public hearing)\b/i.test(line);
    if (startsItem && current.length) flush();
    current.push(line);
    if (current.join(" ").length > 1600) flush();
  }
  if (current.length) flush();
  return dedupeByTitle(chunks).slice(0, 160);
}

function dedupeByTitle<T extends { title: string }>(items: T[]) {
  return [...new Map(items.map((item) => [slugify(item.title), item])).values()];
}

function fallbackItem(entry: ManualPublicMeetingManifestEntry, text: string): ManualItemDraft[] {
  return [
    {
      itemNumber: null,
      title: entry.parserStatus === "needs_review" ? "Needs review: saved official source" : `${entry.sourceKind} source review needed`,
      sourceText: summarizeText(text || entry.notes || "Saved official source requires manual review.", 1800),
      confidence: 0.28,
    },
  ];
}

function parsedItems(providerId: string, entry: ManualPublicMeetingManifestEntry, text: string) {
  if (!text.trim()) return fallbackItem(entry, text);
  if (providerId.includes("reno") || /primegov/i.test(`${entry.officialSourceUrl ?? ""} ${text}`)) {
    const items = parsePrimeGovItems(text);
    return items.length ? items : fallbackItem(entry, text);
  }
  if (entry.sourceKind === "apiJson" || entry.fileType.toLowerCase() === "json") {
    const items = [...parsePrimeGovJsonItems(text), ...parsePacketItems(text)];
    return items.length ? items : fallbackItem(entry, text);
  }
  if (providerId.includes("legislature") || providerId.includes("senate") || providerId.includes("assembly")) {
    const items = [...parseLegislatureItems(text), ...parsePacketItems(text)];
    return items.length ? items : fallbackItem(entry, text);
  }
  if (entry.fileType.toLowerCase() === "pdf" || ["packet", "minutes", "agenda"].includes(entry.sourceKind)) {
    const items = parsePacketItems(text);
    return items.length ? items : fallbackItem(entry, text);
  }
  return fallbackItem(entry, text);
}

function buildQuestion(item: PublicMeetingItemRecord, meeting: PublicMeetingRecord, jurisdiction: string): CitizenVoteQuestionRecord | null {
  if (item.confidence_score < 0.62 || item.source_text.length < 90 || !/\b(approve|adopt|authorize|award|accept|amend|contract|agreement|ordinance|resolution)\b/i.test(item.source_text)) return null;
  const reviewStatus =
    item.fiscal_impact_summary && /\$|budget|fiscal|contract|grant|allocation|expenditure/i.test(item.source_text)
      ? "needs_financial_review"
      : !item.vote_outcome && /\b(motion|vote|approved|adopted|passed|failed)\b/i.test(item.source_text)
        ? "needs_vote_outcome"
        : item.confidence_score >= 0.72 && item.source_text.length > 180
          ? "ready"
          : "needs_context";
  return {
    id: `question-${item.id}`,
    meeting_item_id: item.id,
    jurisdiction,
    question_text: summarizeText(`Would you approve ${item.title.replace(/^[A-Z0-9.]+\s+/, "").toLowerCase()}?`, 260),
    short_summary: summarizeText(item.title, 240),
    neutral_context: summarizeText(item.source_text, 700),
    fiscal_impact: item.fiscal_impact_summary,
    arguments_for: [],
    arguments_against: [],
    affected_groups: [],
    policy_area: item.policy_area,
    status: "draft",
    review_status: reviewStatus,
    source_urls: [item.source_url, ...meeting.source_urls].filter((url, index, urls): url is string => Boolean(url) && urls.indexOf(url) === index),
    confidence_score: Number(Math.min(0.72, item.confidence_score).toFixed(2)),
  };
}

function fiscalImpact(text: string) {
  const dollars = text.match(/(?:not\s+to\s+exceed|amount\s+of|contract\s+for|grant\s+of|expenditure\s+of)?\s*(\$[0-9][0-9,]*(?:\.\d{2})?)([^.\n]{0,160})/i);
  return dollars ? summarizeText(`${dollars[1]}${dollars[2] ?? ""}`, 360) : null;
}

function extractRecommendation(text: string | null | undefined) {
  if (!text) return null;
  const match = text.match(/\b(?:recommendation|recommended action|staff recommends?|for possible action)\s*[:\-]?\s*([^.\n]{20,520})/i);
  return match ? summarizeText(match[1], 520) : null;
}

function extractDepartments(text: string) {
  const departments = new Set<string>();
  for (const match of text.matchAll(/\b(?:department|dept\.?|division|office)\s+of\s+([A-Z][A-Za-z &/-]{2,80})/g)) departments.add(normalizeWhitespace(`${match[1]}`));
  for (const match of text.matchAll(/\b([A-Z][A-Za-z &/-]{2,80})\s+(?:Department|Division|Office)\b/g)) departments.add(normalizeWhitespace(`${match[1]} ${match[0].split(/\s+/).at(-1)}`));
  return [...departments].slice(0, 8);
}

function extractAffectedGroups(text: string) {
  const groups = new Set<string>();
  const patterns: Array<[RegExp, string]> = [
    [/\bresidents?\b/i, "Residents"],
    [/\bhomeowners?\b/i, "Homeowners"],
    [/\brenters?\b/i, "Renters"],
    [/\bbusiness(?:es)?\b/i, "Businesses"],
    [/\bdevelopers?\b/i, "Developers"],
    [/\bstudents?\b/i, "Students"],
    [/\bparents?\b/i, "Parents"],
    [/\bemployees?\b|\bstaff\b/i, "Public employees/staff"],
    [/\btransit riders?\b/i, "Transit riders"],
  ];
  for (const [pattern, label] of patterns) if (pattern.test(text)) groups.add(label);
  return [...groups].slice(0, 8);
}

function voteOutcome(text: string) {
  return extractTopicOutcome(text);
}

function namesFromVoteGroup(text: string, label: string) {
  const match = text.match(new RegExp(`\\b${label}\\s*(?:vote|votes)?\\s*[:\\-]\\s*([^.;\\n]{2,320})`, "i"));
  if (!match) return [];
  const rawNames = match.at(-1);
  if (!rawNames) return [];
  return rawNames
    .split(/,|;|\band\b/i)
    .map((name) => normalizeWhitespace(name.replace(/\b(?:commissioner|councilmember|council member|trustee|senator|assemblymember|assembly member|chair|vice chair|member|director)\b\.?/gi, "")))
    .filter((name) => /^[A-Z][A-Za-z'. -]{2,80}$/.test(name) && !/\b(none|unanimous|all|motion|vote|present|approved|passed|carried)\b/i.test(name))
    .slice(0, 24);
}

function hasExplicitRollCallNames(text: string) {
  return ["ayes?|yeas?|yes\\s+votes?", "nays?|no\\s+votes?", "abstain(?:ed|ing)?", "absent"].some((label) => namesFromVoteGroup(text, label).length > 0);
}

function explicitMotionText(text: string, fallback: string) {
  const motion = text.match(/\bmotion(?:\s+by|\s+made\s+by)?\s*([^.\n]{8,360})/i)?.[0];
  const second = text.match(/\bsecond(?:ed)?\s+by\s+([^.\n]{2,160})/i)?.[0];
  return summarizeText([motion, second].filter(Boolean).join(" ") || fallback, 420);
}

function voteRecordsForItem(item: PublicMeetingItemRecord): VoteRecord[] {
  const text = item.source_text;
  const groups: Array<{ label: string; vote: VoteRecord["vote"] }> = [
    { label: "ayes?|yeas?|yes\\s+votes?", vote: "yes" },
    { label: "nays?|no\\s+votes?", vote: "no" },
    { label: "abstain(?:ed|ing)?", vote: "abstain" },
    { label: "absent", vote: "absent" },
  ];
  return groups.flatMap(({ label, vote }) =>
    namesFromVoteGroup(text, label).map((officialName) => ({
      id: `vote-${item.id}-${slugify(officialName)}-${vote}`,
      meeting_item_id: item.id,
      official_id: null,
      official_name: officialName,
      motion: explicitMotionText(text, item.title),
      vote,
      result: item.vote_outcome,
      vote_text: summarizeText(text, 900),
      source_snippet: summarizeText(text, 900),
      confidence_score: 0.62,
      source_url: item.source_url,
      source_page: item.source_page,
    })),
  );
}

function buildManualRecords(provider: ManualProviderDefinition, entry: ManualPublicMeetingManifestEntry, text: string, sourceMethod: PublicMeetingSourceMethod) {
  const governingBody = entry.governingBody ?? provider.name;
  const meetingDate = entry.meetingDate ? new Date(entry.meetingDate).toISOString() : inferDate(text);
  const title = entry.meetingTitle ?? summarizeText(text.split("\n").find((line) => line.length > 8) ?? `${governingBody} meeting`, 160);
  const localPath = path.join(providerRoot(provider.id), entry.localPath);
  const sourceUrl = entry.officialSourceUrl;
  const rollCallStatus = rollCallStatusFor(entry, text);
  const id = meetingId(provider.id, governingBody, meetingDate, title, localPath);
  const sourcePatch = sourceKindToMeetingPatch(entry.sourceKind, sourceUrl);
  const meeting: PublicMeetingRecord = {
    id,
    public_body_id: bodyId(provider.id, governingBody),
    meeting_date: meetingDate,
    meeting_type: provider.id.includes("legislature") || provider.id.includes("senate") || provider.id.includes("assembly") ? "Legislative meeting" : "Public meeting",
    title,
    agenda_url: sourcePatch.agenda_url,
    minutes_url: sourcePatch.minutes_url,
    packet_url: sourcePatch.packet_url,
    video_url: sourcePatch.video_url,
    transcript_url: null,
    meeting_summary: entry.parserStatus === "needs_review" ? "Needs review. Imported from a saved official source." : summarizeText(text, 700),
    key_actions: [],
    vote_results: [],
    source_document_count: 1,
    source_urls: [sourceUrl].filter((url): url is string => Boolean(url)),
    source_method: sourceMethod,
    source_local_paths: [localPath],
    parser_status: entry.parserStatus === "fixture" ? "fixture" : "partially_parsed",
    roll_call_status: rollCallStatus,
    ingestion_status: text ? "parsed" : "needs_review",
    document_hashes: text ? [hashText(text)] : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const items = parsedItems(provider.id, entry, text).map((draft, index): PublicMeetingItemRecord => {
    const sourceText = draft.sourceText || draft.title;
    const unclear = draft.confidence < 0.5;
    const itemRollCallStatus: RollCallStatus = hasExplicitRollCallNames(sourceText)
      ? "parsed"
      : /\b(roll call|vote result|ayes?|nays?|motion|second(?:ed)? by|approved|adopted|passed|failed)\b/i.test(sourceText)
        ? "needs_roll_call_review"
        : rollCallStatus;
    return {
      id: `item-${meeting.id}-${draft.itemNumber ?? index + 1}-${hashText(sourceText).slice(0, 10)}`,
      meeting_id: meeting.id,
      item_number: draft.itemNumber,
      title: unclear ? `Needs review: ${draft.title}` : draft.title,
      description: unclear ? "Needs review. Text was imported from a saved official source but could not be confidently structured." : summarizeText(sourceText, 520),
      one_sentence_summary: unclear ? "Needs review." : summarizeText(draft.title, 220),
      plain_english_explanation: unclear ? "Needs review. The source text is available for manual interpretation." : summarizeText(draft.title, 520),
      why_it_matters: unclear ? "Needs review before public interpretation." : "This topic appears in a saved official meeting source and may affect public decisions, services, or oversight.",
      affected_groups: draft.affectedGroups ?? extractAffectedGroups(sourceText),
      financial_impact: fiscalImpact(sourceText),
      vote_outcome: voteOutcome(sourceText),
      related_official_names: [],
      related_organization_names: [],
      agenda_section: draft.agendaSection ?? null,
      item_type: inferItemType(sourceText),
      staff_recommendation: draft.staffRecommendation ?? extractRecommendation(sourceText),
      fiscal_impact_summary: fiscalImpact(sourceText),
      department_names: draft.departmentNames ?? extractDepartments(sourceText),
      source_snippet: summarizeText(sourceText, 900),
      policy_area: inferPolicyArea(sourceText),
      source_page: null,
      source_text: sourceText,
      source_url: sourceUrl,
      source_method: sourceMethod,
      source_local_path: localPath,
      parser_status: unclear ? "needs_review" : "partially_parsed",
      roll_call_status: itemRollCallStatus,
      source_document_hash: text ? hashText(text) : null,
      cached_text_path: null,
      confidence_score: Number(draft.confidence.toFixed(2)),
    };
  });
  return { meeting, items };
}

function dedupeById<T extends { id: string }>(records: T[]) {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function dedupeQuestions(questions: CitizenVoteQuestionRecord[]) {
  const seen = new Map<string, CitizenVoteQuestionRecord>();
  for (const question of questions) {
    const key = slugify(`${question.jurisdiction}-${question.policy_area}-${question.question_text.replace(/\b\d{4,}\b/g, "")}`).slice(0, 140);
    const existing = seen.get(key);
    if (!existing || question.confidence_score > existing.confidence_score) seen.set(key, question);
  }
  return [...seen.values()];
}

async function providerDefinitions(includeFixtures: boolean) {
  const seeds = await readJsonFile<PublicMeetingSourceSeed[]>(PUBLIC_MEETING_PATHS.seedSources, []);
  const providerReport = await readJsonFile<PublicMeetingProviderReport[]>(PUBLIC_MEETING_PATHS.providerReport, []);
  const definitions = new Map(MANUAL_PROVIDER_DEFINITIONS.filter((provider) => !isStudentGovernmentScope(`${provider.id} ${provider.name}`)).map((provider) => [provider.id, provider]));
  for (const report of providerReport.filter((entry) => !isStudentGovernmentScope(`${entry.source_id} ${entry.provider_name}`) && (!entry.historical_ingestion_supported || entry.meetings_discovered === 0))) {
    const seed = seeds.find((entry) => entry.id === report.source_id);
    if (!seed || definitions.has(seed.id) || isStudentGovernmentScope(`${seed.id} ${seed.name} ${seed.notes ?? ""}`)) continue;
    definitions.set(seed.id, {
      id: seed.id,
      name: seed.name,
      jurisdiction: seed.jurisdiction,
      level: seed.level,
      officialSourceUrl: seed.sourceUrl ?? seed.meetingIndexUrl ?? seed.website ?? "",
      folders: ["raw-pages", "agenda-packets", "agendas", "minutes", "metadata"],
      readme: "Blocked or partial provider. Save public official pages or files here and add manifest entries.",
    });
  }
  if (!includeFixtures) return [...definitions.values()];
  return [...definitions.values()];
}

function publicBodyForProvider(provider: ManualProviderDefinition, governingBody: string): PublicBodyRecord {
  return {
    id: bodyId(provider.id, governingBody),
    name: governingBody,
    jurisdiction: provider.jurisdiction,
    level: provider.level,
    website: provider.officialSourceUrl,
    source_url: provider.officialSourceUrl,
    meeting_index_url: provider.officialSourceUrl,
    scraper_type: "manual",
    active: true,
    seed_source_id: provider.id,
    notes: "Manual browser-assisted cache source. Imported from saved official public records.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function importManualPublicMeetingSources(options: { includeFixtures?: boolean } = {}): Promise<ManualImportResult> {
  await importPublicMeetingOfficialRosters();
  const providers = await providerDefinitions(Boolean(options.includeFixtures));
  const processedProviderIds = providers.map((provider) => provider.id);
  const existingBodies = await readJsonFile<PublicBodyRecord[]>(PUBLIC_MEETING_PATHS.bodies, []);
  const existingMeetings = await readJsonFile<PublicMeetingRecord[]>(PUBLIC_MEETING_PATHS.meetings, []);
  const existingItems = await readJsonFile<PublicMeetingItemRecord[]>(PUBLIC_MEETING_PATHS.meetingItems, []);
  const existingVotes = await readJsonFile<VoteRecord[]>(PUBLIC_MEETING_PATHS.voteRecords, []);
  const existingOfficialActions = await readJsonFile<OfficialMeetingActionRecord[]>(PUBLIC_MEETING_PATHS.officialActions, []);
  const existingMeetingVotingCards = await readJsonFile<MeetingVotingCardRecord[]>(PUBLIC_MEETING_PATHS.meetingVotingCards, []);
  const existingQuestions = await readJsonFile<CitizenVoteQuestionRecord[]>(PUBLIC_MEETING_PATHS.citizenQuestions, []);
  const errors: PublicMeetingIngestionReport["errors"] = [];
  const bodies: PublicBodyRecord[] = [];
  const meetings: PublicMeetingRecord[] = [];
  const items: PublicMeetingItemRecord[] = [];
  const votes: VoteRecord[] = [];
  const officialActions: OfficialMeetingActionRecord[] = [];
  const questions: CitizenVoteQuestionRecord[] = [];
  const reports: PublicMeetingManualProviderReport[] = [];

  for (const provider of providers) {
    const manifestPath = providerManifestPath(provider.id);
    const rawManifest = await readJsonFile<unknown>(manifestPath, []);
    const manifest = normalizeManifest(rawManifest);
    const manifestFailures =
      typeof rawManifest === "object" && rawManifest && "failures" in rawManifest && Array.isArray((rawManifest as { failures?: unknown[] }).failures)
        ? ((rawManifest as { failures?: Array<{ url?: unknown; reason?: unknown; sourceKind?: unknown }> }).failures ?? [])
            .map((failure) => ({
              url: String(failure.url ?? ""),
              reason: String(failure.reason ?? "Download failed"),
              sourceKind: stringOrNull(failure.sourceKind),
            }))
            .filter((failure) => failure.url)
        : [];
    let cachedFiles = 0;
    let parsedMeetings = 0;
    let parsedItems = 0;
    let parserFailures = 0;
    let fixtureFiles = 0;
    let detailPages = 0;
    let pdfs = 0;
    let json = 0;
    let needsReview = 0;
    let voteActionRecords = 0;
    let rollCallParsed = 0;
    let rollCallNeedsReview = 0;
    let lowConfidencePdfRecords = 0;
    let readyQuestions = 0;
    let needsContextQuestions = 0;
    let needsFinancialReviewQuestions = 0;
    let needsVoteOutcomeQuestions = 0;
    for (const entry of manifest) {
      if (entry.parserStatus === "skip" || entry.providerId !== provider.id) continue;
      if (entry.parserStatus === "fixture" && !options.includeFixtures) {
        fixtureFiles += 1;
        continue;
      }
      cachedFiles += 1;
      if (entry.fileType.toLowerCase() === "html" || entry.sourceKind === "rawHtml") detailPages += 1;
      if (entry.fileType.toLowerCase() === "pdf") pdfs += 1;
      if (entry.fileType.toLowerCase() === "json" || entry.sourceKind === "apiJson") json += 1;
      if (["needs_review", "needs_parser", "source_missing", "unavailable"].includes(entry.parserStatus)) needsReview += 1;
      const sourceMethod: PublicMeetingSourceMethod = entry.parserStatus === "fixture" ? "manual_fixture" : "manual_cache";
      const { text, error } = await readSourceText(provider.id, entry);
      if (error) {
        parserFailures += 1;
        errors.push({ document_id: `${provider.id}:${entry.localPath}`, message: error });
      }
      const { meeting, items: meetingItems } = buildManualRecords(provider, entry, text, sourceMethod);
      for (const item of meetingItems) {
        item.vote_outcome = item.vote_outcome ?? extractTopicOutcome(item.source_text);
        if (itemHasUnnamedVoteOutcome(item) && item.roll_call_status !== "parsed") item.roll_call_status = "needs_roll_call_review";
      }
      bodies.push(publicBodyForProvider(provider, entry.governingBody ?? provider.name));
      meetings.push(meeting);
      items.push(...meetingItems);
      const meetingVotes = meetingItems.flatMap(voteRecordsForItem);
      votes.push(...meetingVotes);
      officialActions.push(...meetingItems.flatMap((item) => extractOfficialActionsForItem(item, { meeting, body: publicBodyForProvider(provider, entry.governingBody ?? provider.name) })));
      voteActionRecords += meetingItems.filter((item) => item.vote_outcome || /\b(motion|vote|ayes?|nays?)\b/i.test(item.source_text)).length;
      rollCallParsed += meetingItems.filter((item) => item.roll_call_status === "parsed").length;
      rollCallNeedsReview += meetingItems.filter((item) => item.roll_call_status === "needs_roll_call_review").length;
      lowConfidencePdfRecords += entry.fileType.toLowerCase() === "pdf" ? meetingItems.filter((item) => item.confidence_score < 0.65).length : 0;
      needsReview += meetingItems.filter((item) => item.parser_status === "needs_review").length;
      const meetingQuestions = meetingItems.map((item) => buildQuestion(item, meeting, provider.jurisdiction)).filter((question): question is CitizenVoteQuestionRecord => Boolean(question));
      readyQuestions += meetingQuestions.filter((question) => question.review_status === "ready").length;
      needsContextQuestions += meetingQuestions.filter((question) => question.review_status === "needs_context").length;
      needsFinancialReviewQuestions += meetingQuestions.filter((question) => question.review_status === "needs_financial_review").length;
      needsVoteOutcomeQuestions += meetingQuestions.filter((question) => question.review_status === "needs_vote_outcome").length;
      questions.push(...meetingQuestions);
      parsedMeetings += 1;
      parsedItems += meetingItems.length;
    }
    const status =
      parsedMeetings > 0 && parserFailures > 0
        ? "partially_parsed"
        : parsedMeetings > 0
          ? "parsed"
          : cachedFiles > 0
            ? "cached"
            : "missing";
    const parserGaps = [
      pdfs > 0 && parsedItems === 0 ? "PDF text extraction or packet chunking needs review." : null,
      rollCallNeedsReview > 0 ? "Vote/action text found but individual roll-call names need review." : null,
      lowConfidencePdfRecords > 0 ? "Some PDF packet records are low confidence." : null,
      manifestFailures.length ? "Some public linked downloads failed and need review." : null,
      needsReview > 0 ? "Some saved source records need manual review." : null,
    ].filter((gap): gap is string => Boolean(gap));
    reports.push({
      provider_id: provider.id,
      source_name: provider.name,
      status,
      manifest_path: manifestPath,
      cached_files: cachedFiles,
      detail_pages_collected: detailPages,
      pdfs_collected: pdfs,
      json_collected: json,
      parsed_meetings: parsedMeetings,
      parsed_items: parsedItems,
      vote_action_records_parsed: voteActionRecords,
      official_action_records_parsed: officialActions.filter((action) => action.meeting_id.startsWith(`meeting-manual-${provider.id}-`)).length,
      roll_call_parsed_count: rollCallParsed,
      roll_call_needs_review_count: rollCallNeedsReview,
      low_confidence_pdf_records: lowConfidencePdfRecords,
      question_ready_count: readyQuestions,
      question_needs_context_count: needsContextQuestions,
      question_needs_financial_review_count: needsFinancialReviewQuestions,
      question_needs_vote_outcome_count: needsVoteOutcomeQuestions,
      needs_review_count: needsReview,
      parser_failures: parserFailures,
      failure_reasons: [...new Set(manifestFailures.map((failure) => failure.reason))],
      boarddocs_failures: provider.officialSourceUrl.includes("boarddocs") || provider.id.includes("school-district") ? manifestFailures : [],
      fixture_files: fixtureFiles,
      interactive_session_needed: status === "missing" || parserFailures > 0,
      parser_gaps: parserGaps,
      next_recommended_action:
        status === "missing"
          ? "Run the interactive Playwright bootstrap or save official source files into this manifest."
          : parserGaps[0] ?? "Run manual import after adding new official source files.",
      notes: status === "missing" ? "No manual source files listed in manifest." : parserGaps[0] ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  const realMeetings = meetings.filter((meeting) => meeting.source_method !== "manual_fixture");
  const realItems = items.filter((item) => item.source_method !== "manual_fixture");
  const realVotes = votes.filter((vote) => realItems.some((item) => item.id === vote.meeting_item_id));
  const realOfficialActions = officialActions.filter((action) => realItems.some((item) => item.id === action.topic_item_id));
  const realQuestions = dedupeQuestions(questions.filter((question) => realItems.some((item) => item.id === question.meeting_item_id)));
  const isProcessedManualMeeting = (meetingId: string) => processedProviderIds.some((providerId) => meetingId.startsWith(`meeting-manual-${providerId}-`));
  const retainedMeetings = existingMeetings.filter((meeting) => meeting.source_method !== "manual_cache" || !isProcessedManualMeeting(meeting.id));
  const retainedItems = existingItems.filter((item) => item.source_method !== "manual_cache" || !isProcessedManualMeeting(item.meeting_id));
  const retainedVotes = existingVotes.filter((vote) => retainedItems.some((item) => item.id === vote.meeting_item_id));
  const retainedOfficialActions = existingOfficialActions.filter((action) => retainedItems.some((item) => item.id === action.topic_item_id));
  const nextItems = dedupeById([...retainedItems, ...realItems]);
  const nextItemIds = new Set(nextItems.map((item) => item.id));
  const retainedQuestions = dedupeQuestions(existingQuestions.filter((question) => nextItemIds.has(question.meeting_item_id)));
  const retainedBodies = existingBodies.filter((body) => !processedProviderIds.some((providerId) => body.id.startsWith(`body-manual-${providerId}-`)));
  const realBodyIds = new Set(realMeetings.map((meeting) => meeting.public_body_id));
  const nextBodies = dedupeById([...retainedBodies, ...bodies.filter((body) => realBodyIds.has(body.id))]);
  const nextMeetings = dedupeById([...retainedMeetings, ...realMeetings]);
  const officialMatchCandidates = await loadOfficialActionMatchCandidates();
  const nextOfficialActions = applyOfficialActionMatches(dedupeById([...retainedOfficialActions, ...realOfficialActions]), {
    meetings: nextMeetings,
    bodies: nextBodies,
    candidates: officialMatchCandidates,
  });
  const rebuiltVotingCards = buildMeetingVotingCards({
    meetings: nextMeetings,
    bodies: nextBodies,
    items: nextItems,
    officialActions: nextOfficialActions,
  });
  const retainedVotingCards = existingMeetingVotingCards.filter((card) => nextItemIds.has(card.topic_item_id) && !isProcessedManualMeeting(card.meeting_id));
  const nextVotingCards = dedupeById([...retainedVotingCards, ...rebuiltVotingCards]);
  await Promise.all([
    writeJsonFile(PUBLIC_MEETING_PATHS.bodies, nextBodies),
    writeJsonFile(PUBLIC_MEETING_PATHS.meetings, nextMeetings),
    writeJsonFile(PUBLIC_MEETING_PATHS.meetingItems, nextItems),
    writeJsonFile(PUBLIC_MEETING_PATHS.voteRecords, dedupeById([...retainedVotes, ...realVotes])),
    writeJsonFile(PUBLIC_MEETING_PATHS.officialActions, nextOfficialActions),
    writeJsonFile(PUBLIC_MEETING_PATHS.meetingVotingCards, nextVotingCards),
    writeJsonFile(PUBLIC_MEETING_PATHS.citizenQuestions, dedupeQuestions(dedupeById([...retainedQuestions, ...realQuestions]))),
    writeJsonFile(PUBLIC_MEETING_PATHS.manualProviderReport, reports),
  ]);

  return { meetings: realMeetings, items: realItems, votes: realVotes, officialActions: realOfficialActions, questions: realQuestions, report: reports, errors };
}

export async function getManualPublicMeetingProviderReport() {
  return readJsonFile<PublicMeetingManualProviderReport[]>(PUBLIC_MEETING_PATHS.manualProviderReport, []);
}

function isSurnameOnlyActorName(value: string) {
  return normalizeWhitespace(value).split(/\s+/).filter(Boolean).length === 1;
}

export async function buildManualMeetingSourceReport() {
  const providerReport = await readJsonFile<PublicMeetingProviderReport[]>(PUBLIC_MEETING_PATHS.providerReport, []);
  const manualReport = await getManualPublicMeetingProviderReport();
  const [allItems, allVotes, allOfficialActions] = await Promise.all([
    readJsonFile<PublicMeetingItemRecord[]>(PUBLIC_MEETING_PATHS.meetingItems, []),
    readJsonFile<VoteRecord[]>(PUBLIC_MEETING_PATHS.voteRecords, []),
    readJsonFile<OfficialMeetingActionRecord[]>(PUBLIC_MEETING_PATHS.officialActions, []),
  ]);
  const allVotingCards = await readJsonFile<MeetingVotingCardRecord[]>(PUBLIC_MEETING_PATHS.meetingVotingCards, []);
  const manualById = new Map(manualReport.map((entry) => [entry.provider_id, entry]));
  return providerReport.filter((provider) => !isStudentGovernmentScope(`${provider.source_id} ${provider.provider_name}`)).map((provider) => {
    const manual = manualById.get(provider.source_id);
    const meetingPrefix = `meeting-manual-${provider.source_id}-`;
    const providerItems = allItems.filter((item) => item.meeting_id.startsWith(meetingPrefix));
    const providerItemIds = new Set(providerItems.map((item) => item.id));
    const providerVotes = allVotes.filter((vote) => providerItemIds.has(vote.meeting_item_id));
    const providerOfficialActions = allOfficialActions.filter((action) => action.meeting_id.startsWith(meetingPrefix));
    const providerVotingCards = allVotingCards.filter((card) => card.meeting_id.startsWith(meetingPrefix));
    return {
      provider_id: provider.source_id,
      source_name: provider.provider_name,
      automated_status: provider.meetings_discovered > 0 ? "parsed" : provider.historical_ingestion_supported ? "cached" : "blocked",
      automated_meetings: provider.meetings_discovered,
      manual_status: manual?.status ?? "missing",
      manual_cached_files: manual?.cached_files ?? 0,
      manual_parsed_meetings: manual?.parsed_meetings ?? 0,
      manual_parsed_items: manual?.parsed_items ?? 0,
      manual_detail_pages: manual?.detail_pages_collected ?? 0,
      manual_pdfs: manual?.pdfs_collected ?? 0,
      manual_json: manual?.json_collected ?? 0,
      manual_votes_or_actions: manual?.vote_action_records_parsed ?? 0,
      manual_official_actions: manual?.official_action_records_parsed ?? 0,
      manual_meeting_voting_cards: providerVotingCards.length,
      manual_meeting_voting_cards_approved: providerVotingCards.filter((card) => card.review_status === "approved").length,
      manual_meeting_voting_cards_needs_review: providerVotingCards.filter((card) => card.review_status !== "approved").length,
      manual_surname_only_actors: providerOfficialActions.filter((action) => isSurnameOnlyActorName(action.official_name_raw)).length,
      manual_auto_matched_actors: providerOfficialActions.filter((action) => action.review_status === "approved" && action.official_id).length,
      manual_suggested_match_actors: providerOfficialActions.filter((action) => action.review_status === "suggested_match").length,
      manual_approved_visible_actions: providerOfficialActions.filter(
        (action) => action.review_status === "approved" && action.official_id && (action.confidence >= 0.82 || (action.match_confidence ?? 0) >= 0.88),
      ).length,
      manual_roll_call_parsed: manual?.roll_call_parsed_count ?? 0,
      manual_roll_call_needs_review: manual?.roll_call_needs_review_count ?? 0,
      manual_roll_call_review_items: providerItems.filter((item) => item.roll_call_status === "needs_roll_call_review").length,
      manual_parsed_topic_outcomes: providerItems.filter((item) => Boolean(item.vote_outcome)).length,
      manual_parsed_named_vote_records: providerVotes.length,
      manual_low_confidence_pdf_records: manual?.low_confidence_pdf_records ?? 0,
      manual_question_ready: manual?.question_ready_count ?? 0,
      manual_question_needs_context: manual?.question_needs_context_count ?? 0,
      manual_question_needs_financial_review: manual?.question_needs_financial_review_count ?? 0,
      manual_question_needs_vote_outcome: manual?.question_needs_vote_outcome_count ?? 0,
      manual_needs_review: manual?.needs_review_count ?? 0,
      boarddocs_failures: manual?.boarddocs_failures ?? [],
      interactive_session_needed: manual?.interactive_session_needed ?? provider.meetings_discovered === 0,
      parser_gaps: manual?.parser_gaps ?? [],
      next_recommended_action: manual?.next_recommended_action ?? null,
      manual_manifest_path: manual?.manifest_path ?? providerManifestPath(provider.source_id),
      notes: manual?.notes ?? provider.notes,
    };
  });
}
