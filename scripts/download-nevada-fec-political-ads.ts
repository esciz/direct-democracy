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
  source_url?: string | null;
};

type FecCycleFailure = {
  cycle: number;
  status: number | null;
  reason: string;
};

function getArg(name: string, fallback: string) {
  const prefixed = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefixed));
  return match ? match.slice(prefixed.length) : fallback;
}

function parseLimit() {
  const requested = Number.parseInt(getArg("limit", "500"), 10);
  if (!Number.isFinite(requested)) return 500;
  return Math.min(2_000, Math.max(10, requested));
}

function requestedCycles() {
  const explicit = getArg("cycles", "")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value >= 1976 && value <= 2030);
  if (explicit.length) return [...new Set(explicit)].sort((a, b) => b - a);
  const cycles = [2026, 2024, 2022, 2020, 2018, 2016, 2014, 2012];
  if (!process.argv.includes("--scheduled")) return cycles;
  const historical = cycles.slice(1);
  const shard = Math.floor(Date.now() / 86_400_000) % historical.length;
  return [cycles[0], historical[shard]];
}

function readExistingRows() {
  if (!fs.existsSync(OUTPUT_PATH)) return [] as FecIndependentExpenditureRecord[];
  try {
    const parsed = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")) as { records?: FecIndependentExpenditureRecord[] };
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return [] as FecIndependentExpenditureRecord[];
  }
}

function recordKey(row: FecIndependentExpenditureRecord) {
  return row.sub_id ?? row.transaction_id ?? [
    row.committee_id,
    row.candidate_id,
    row.expenditure_date,
    row.expenditure_amount,
    row.expenditure_description,
  ].join(":");
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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFecDate(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : value;
}

function parseCsv(input: string, onRecord: (record: Record<string, string>) => void) {
  let headers: string[] | null = null;
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const finishRow = () => {
    row.push(field);
    field = "";
    if (!headers) {
      headers = row.map((value) => value.replace(/^\uFEFF/, ""));
    } else if (row.some(Boolean)) {
      onRecord(Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
    }
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === "\"") {
      if (quoted && input[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      finishRow();
    } else {
      field += character;
    }
  }

  if (field || row.length) finishRow();
}

async function downloadBulkCycle(cycle: number) {
  const sourceUrl = `https://www.fec.gov/files/bulk-downloads/${cycle}/independent_expenditure_${cycle}.csv`;
  const response = await fetch(sourceUrl, {
    headers: {
      accept: "text/csv",
      "user-agent": "Direct Democracy Nevada political ads source audit (contact: admin@directyourdemocracy.com)",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const records: FecIndependentExpenditureRecord[] = [];
  parseCsv(await response.text(), (row) => {
    if (row.can_office_state !== "NV") return;
    records.push({
      candidate_id: row.cand_id || null,
      candidate_name: row.cand_name || null,
      candidate_office: row.can_office || null,
      candidate_office_district: row.can_office_dis || null,
      candidate_office_state: row.can_office_state || null,
      candidate_party: row.cand_pty_aff || null,
      committee_id: row.spe_id || null,
      committee: {
        name: row.spe_nam || null,
        committee_type_full: "Independent expenditure filer",
        state: null,
      },
      disbursement_dt: normalizeFecDate(row.exp_date),
      dissemination_date: normalizeFecDate(row.dissem_dt),
      election_type: row.ele_type || null,
      expenditure_amount: Number.parseFloat(row.exp_amo) || null,
      expenditure_date: normalizeFecDate(row.exp_date),
      expenditure_description: row.pur || null,
      filing_date: normalizeFecDate(row.receipt_dat),
      image_number: row.image_num || null,
      is_notice: true,
      payee_name: row.pay || null,
      report_year: row.fec_election_yr || String(cycle),
      schedule_type_full: "Independent expenditures (24- and 48-hour reports)",
      sub_id: row.tran_id || null,
      support_oppose_indicator: row.sup_opp || null,
      transaction_id: row.tran_id || null,
      source_url: row.image_num
        ? `https://docquery.fec.gov/cgi-bin/fecimg/?${row.image_num}`
        : sourceUrl,
    });
  });
  return records;
}

async function fetchFecWindow(endpoint: URL) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "Direct Democracy Nevada political ads source audit (contact: admin@directyourdemocracy.com)",
      },
    });

    if (response.ok) return response;

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) return response;

    const retryAfterSeconds = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
    const delayMs = Number.isFinite(retryAfterSeconds)
      ? Math.min(20_000, retryAfterSeconds * 1_000)
      : attempt * 2_000;
    await wait(delayMs);
  }

  return null;
}

async function main() {
  const limit = parseLimit();
  const apiKey = process.env.FEC_API_KEY || "DEMO_KEY";
  const bulkOnly = process.argv.includes("--bulk-only");
  const minDate = getArg("min-date", "2012-01-01");
  const cycles = requestedCycles();
  const windows = cycles
    .map((cycle) => ({ cycle, min: `${cycle - 1}-01-01`, max: `${cycle}-12-31` }))
    .filter((window) => window.max >= minDate);
  const downloadedRows: FecIndependentExpenditureRecord[] = [];
  const successfulCycles: number[] = [];
  const bulkFallbackCycles: number[] = [];
  const failedCycles: FecCycleFailure[] = [];
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

    const response = bulkOnly ? null : await fetchFecWindow(endpoint);
    if (!response?.ok) {
      try {
        const bulkRows = await downloadBulkCycle(window.cycle);
        bulkFallbackCycles.push(window.cycle);
        successfulCycles.push(window.cycle);
        fecReportedCount = (fecReportedCount ?? 0) + bulkRows.length;
        downloadedRows.push(...bulkRows);
      } catch (bulkError) {
        failedCycles.push({
          cycle: window.cycle,
          status: response?.status ?? null,
          reason: [
            bulkOnly
              ? "bulk-only mode"
              : response
                ? `API ${response.status} ${response.statusText}`
                : "API returned no response",
            `bulk ${bulkError instanceof Error ? bulkError.message : String(bulkError)}`,
          ].join("; "),
        });
      }
      continue;
    }

    const payload = (await response.json()) as FecScheduleEResponse;
    successfulCycles.push(window.cycle);
    fecReportedCount = (fecReportedCount ?? 0) + (payload.pagination?.count ?? 0);
    downloadedRows.push(...(payload.results ?? []));
  }

  const seen = new Set<string>();
  const candidateCounts = new Map<string, number>();
  const newRows = downloadedRows
    .filter((row) => row.candidate_office_state === "NV")
    .filter(isPaidCommunication)
    .filter((row) => {
      const diversityKey = rowDiversityKey(row);
      if (seen.has(diversityKey)) return false;
      const key = candidateKey(row);
      const count = candidateCounts.get(key) ?? 0;
      if (count >= 20) return false;
      seen.add(diversityKey);
      candidateCounts.set(key, count + 1);
      return true;
    })
    .slice(0, limit)
    .map((row) => ({
      ...row,
      source_url: buildSourceUrl(row),
    }));
  const existingRows = readExistingRows();
  const rows = [
    ...new Map([...existingRows, ...newRows].map((row) => [recordKey(row), row])).values(),
  ]
    .sort((left, right) => Date.parse(right.expenditure_date ?? right.dissemination_date ?? "") - Date.parse(left.expenditure_date ?? left.dissemination_date ?? ""))
    .slice(0, limit);

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
          cycles,
          successfulCycles,
          bulkFallbackCycles,
          failedCycles,
          sourceUrl: "https://api.open.fec.gov/developers/",
          usedDemoKey: !process.env.FEC_API_KEY,
          bulkOnly,
        },
        totals: {
          requested: limit,
        downloadedRaw: downloadedRows.length,
        downloadedThisRun: newRows.length,
        retainedExisting: existingRows.length,
        downloaded: rows.length,
        fecReportedCount,
        successfulCycles: successfulCycles.length,
        bulkFallbackCycles: bulkFallbackCycles.length,
        failedCycles: failedCycles.length,
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
        downloadedThisRun: newRows.length,
        retainedExisting: existingRows.length,
        downloadedRaw: downloadedRows.length,
        cycles,
        successfulCycles,
        bulkFallbackCycles,
        failedCycles,
        output: OUTPUT_PATH,
        usedDemoKey: !process.env.FEC_API_KEY,
        bulkOnly,
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
