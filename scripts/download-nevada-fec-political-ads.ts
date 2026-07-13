import fs from "node:fs";
import path from "node:path";

const IMPORT_DIR = path.join(process.cwd(), "data/imports/political-ads");
const OUTPUT_PATH = path.join(IMPORT_DIR, "fec-nevada-independent-expenditures.json");

type FecScheduleEResponse = {
  pagination?: {
    count?: number;
    pages?: number;
    per_page?: number;
    last_indexes?: Record<string, string | number | null>;
  };
  results?: FecIndependentExpenditureRecord[];
};

type FecIndependentExpenditureRecord = {
  candidate_id?: string | null;
  candidate_name?: string | null;
  candidate_office?: string | null;
  candidate_office_district?: string | null;
  candidate_office_state?: string | null;
  candidate_party?: string | null;
  committee_id?: string | null;
  committee?: {
    name?: string | null;
    committee_type_full?: string | null;
    state?: string | null;
  } | null;
  disbursement_dt?: string | null;
  dissemination_date?: string | null;
  election_type?: string | null;
  expenditure_amount?: number | null;
  expenditure_date?: string | null;
  expenditure_description?: string | null;
  filing_date?: string | null;
  filing_form?: string | null;
  image_number?: string | null;
  is_notice?: boolean | null;
  payee_name?: string | null;
  payee_city?: string | null;
  payee_state?: string | null;
  pdf_url?: string | null;
  report_year?: string | number | null;
  schedule_type_full?: string | null;
  sub_id?: string | null;
  support_oppose_indicator?: string | null;
  transaction_id?: string | null;
};

function getArg(name: string, fallback: string) {
  const prefixed = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefixed));
  return match ? match.slice(prefixed.length) : fallback;
}

function parseLimit() {
  const requested = Number.parseInt(getArg("limit", "50"), 10);
  if (!Number.isFinite(requested)) return 50;
  return Math.min(100, Math.max(10, requested));
}

function buildSourceUrl(row: FecIndependentExpenditureRecord) {
  if (row.pdf_url) return row.pdf_url;
  if (row.image_number) return `https://docquery.fec.gov/cgi-bin/fecimg/?${row.image_number}`;
  if (row.sub_id) return `https://api.open.fec.gov/v1/schedules/schedule_e/?sub_id=${encodeURIComponent(row.sub_id)}`;
  return "https://www.fec.gov/data/independent-expenditures/";
}

function isPaidCommunication(row: FecIndependentExpenditureRecord) {
  return /\b(advertis|media|mailer|mail |digital|internet|online|facebook|google|youtube|radio|television|tv\b|cable|phone|text|sms|print|postcard|banner|creative|production|communication|persuasion)\b/i.test(
    row.expenditure_description ?? "",
  );
}

function rowDiversityKey(row: FecIndependentExpenditureRecord) {
  return [
    row.candidate_id ?? row.candidate_name ?? "candidate",
    row.committee_id ?? row.committee?.name ?? "committee",
    row.support_oppose_indicator ?? "mentions",
    row.expenditure_description ?? "purpose",
  ].join(":");
}

function candidateKey(row: FecIndependentExpenditureRecord) {
  return row.candidate_id ?? row.candidate_name ?? "unknown";
}

async function main() {
  const limit = parseLimit();
  const apiKey = process.env.FEC_API_KEY || "DEMO_KEY";
  const minDate = getArg("min-date", "2024-01-01");

  const windows = [
    { min: "2026-01-01", max: "2026-12-31" },
    { min: "2024-01-01", max: "2024-12-31" },
  ].filter((window) => window.max >= minDate);
  const downloadedRows: FecIndependentExpenditureRecord[] = [];
  let fecReportedCount: number | null = null;

  for (const window of windows) {
    const endpoint = new URL("https://api.open.fec.gov/v1/schedules/schedule_e/");
    endpoint.searchParams.set("api_key", apiKey);
    endpoint.searchParams.set("candidate_office_state", "NV");
    endpoint.searchParams.set("min_date", window.min);
    endpoint.searchParams.set("max_date", window.max);
    endpoint.searchParams.set("sort", "-expenditure_date");
    endpoint.searchParams.set("per_page", "100");
    endpoint.searchParams.set("most_recent", "true");

    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "Direct Democracy Nevada political ads source audit (contact: admin@directyourdemocracy.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`FEC independent expenditure download failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as FecScheduleEResponse;
    fecReportedCount = (fecReportedCount ?? 0) + (payload.pagination?.count ?? 0);
    downloadedRows.push(...(payload.results ?? []));
  }

  const seen = new Set<string>();
  const candidateCounts = new Map<string, number>();
  const rows = downloadedRows
    .filter((row) => row.candidate_office_state === "NV")
    .filter(isPaidCommunication)
    .filter((row) => {
      const diversityKey = rowDiversityKey(row);
      if (seen.has(diversityKey)) return false;
      const key = candidateKey(row);
      const count = candidateCounts.get(key) ?? 0;
      if (count >= 12) return false;
      seen.add(diversityKey);
      candidateCounts.set(key, count + 1);
      return true;
    })
    .slice(0, limit)
    .map((row) => ({
      ...row,
      source_url: buildSourceUrl(row),
    }));

  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: {
          provider: "fec",
          endpoint: "https://api.open.fec.gov/v1/schedules/schedule_e/",
          candidateOfficeState: "NV",
          minDate,
          sourceUrl: "https://api.open.fec.gov/developers/",
          usedDemoKey: !process.env.FEC_API_KEY,
        },
        totals: {
          requested: limit,
          downloadedRaw: downloadedRows.length,
          downloaded: rows.length,
          fecReportedCount,
        },
        records: rows,
      },
      null,
      2,
    ),
  );

  console.log("Downloaded Nevada FEC independent expenditure communication records.");
  console.log(
    JSON.stringify(
      {
        downloaded: rows.length,
        downloadedRaw: downloadedRows.length,
        output: OUTPUT_PATH,
        usedDemoKey: !process.env.FEC_API_KEY,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
