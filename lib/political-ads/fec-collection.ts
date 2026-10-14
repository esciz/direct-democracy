import crypto from "node:crypto";

export type FecCommunicationRecord = {
  candidate_id?: string | null;
  candidate_name?: string | null;
  candidate_office?: string | null;
  candidate_office_district?: string | null;
  candidate_office_state?: string | null;
  candidate_party?: string | null;
  committee_id?: string | null;
  committee?: { name?: string | null; committee_type_full?: string | null; state?: string | null } | null;
  expenditure_amount?: number | null;
  expenditure_date?: string | null;
  dissemination_date?: string | null;
  expenditure_description?: string | null;
  filing_date?: string | null;
  election_type?: string | null;
  report_year?: string | number | null;
  sub_id?: string | null;
  transaction_id?: string | null;
  file_number?: string | number | null;
  previous_file_number?: string | number | null;
  amendment_indicator?: string | null;
  image_number?: string | null;
  source_url?: string | null;
  pdf_url?: string | null;
  support_oppose_indicator?: string | null;
  payee_name?: string | null;
  is_notice?: boolean | null;
  most_recent?: boolean | null;
  source_dataset?: "api_schedule_e" | "bulk_24_48_hour_notices";
  [key: string]: unknown;
};

export type FecCursor = Record<string, string | number>;
export type FecPage = { results?: FecCommunicationRecord[]; pagination?: { count?: number; last_indexes?: Record<string, string | number | null> } };

// Word stems matter: the old exact-word expression silently excluded "advertising" and "mailing".
export function isPaidCommunication(row: FecCommunicationRecord) {
  return /\b(advertis\w*|media|mail\w*|digital|internet|online|facebook|google|youtube|radio|television|tv|cable|phone|text|sms|print\w*|postcard\w*|banner\w*|creative|production|communication\w*|persuasion)\b/i.test(row.expenditure_description ?? "");
}

export function recordKey(row: FecCommunicationRecord) {
  // Bulk TRA_ID is unique only within its filing. A committee prefix alone is insufficient.
  if (row.sub_id && !row.source_dataset?.startsWith("bulk")) return `sub:${row.sub_id}`;
  return `filing:${crypto.createHash("sha256").update(JSON.stringify([
    row.committee_id, row.file_number, row.transaction_id, row.candidate_id,
    row.image_number, row.expenditure_date, row.dissemination_date, row.expenditure_amount,
    row.support_oppose_indicator, row.expenditure_description,
  ])).digest("hex").slice(0, 24)}`;
}

export function mergeFecRecords(existing: FecCommunicationRecord[], incoming: FecCommunicationRecord[]) {
  // Limits bound collection work, never the archive. Distinct same-purpose transactions are evidence.
  return [...new Map([...existing, ...incoming].map((row) => [recordKey(row), row])).values()]
    .sort((a, b) => (Date.parse(b.expenditure_date ?? b.dissemination_date ?? "") || 0) - (Date.parse(a.expenditure_date ?? a.dissemination_date ?? "") || 0));
}

export function nextCursor(page: FecPage): FecCursor | null {
  const entries = Object.entries(page.pagination?.last_indexes ?? {}).filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== "");
  return entries.length && entries.some(([key]) => key === "last_index") ? Object.fromEntries(entries) : null;
}

export function normalizeFecDate(value?: string) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

export function normalizeBulkRecord(row: Record<string, string>, cycle: number): FecCommunicationRecord | null {
  if (row.can_office_state?.trim().toUpperCase() !== "NV") return null;
  const amount = Number.parseFloat(row.exp_amo);
  const result: FecCommunicationRecord = {
    candidate_id: row.cand_id || null, candidate_name: row.cand_name || null,
    candidate_office: row.can_office || null, candidate_office_district: row.can_office_dis || null,
    candidate_office_state: "NV", candidate_party: row.cand_pty_aff || null,
    committee_id: row.spe_id || null, committee: { name: row.spe_nam || null, committee_type_full: "Independent expenditure filer", state: null },
    expenditure_amount: Number.isFinite(amount) ? amount : null,
    expenditure_date: normalizeFecDate(row.exp_date), dissemination_date: normalizeFecDate(row.dissem_dt),
    expenditure_description: row.pur || null, filing_date: normalizeFecDate(row.receipt_dat),
    election_type: row.ele_type || null, report_year: row.fec_election_yr || cycle,
    file_number: row.file_num || null, previous_file_number: row.prev_file_num || null,
    amendment_indicator: row.amndt_ind || null, image_number: row.image_num || null,
    transaction_id: row.tran_id || null, support_oppose_indicator: row.sup_opp || null,
    payee_name: row.pay || null, is_notice: true, source_dataset: "bulk_24_48_hour_notices",
    source_url: row.image_num ? `https://docquery.fec.gov/cgi-bin/fecimg/?${row.image_num}` : `https://www.fec.gov/files/bulk-downloads/${cycle}/independent_expenditure_${cycle}.csv`,
  };
  result.sub_id = `bulk-${recordKey(result).slice(7)}`;
  return result;
}

/** Incremental RFC 4180 parser; quoted fields and CRLF may cross network chunk boundaries. */
export function csvParser(onRecord: (record: Record<string, string>) => void) {
  let headers: string[] | null = null;
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let quotePending = false;
  let previousCr = false;
  let rowCharacters = 0;
  function finishRow() {
    row.push(field); field = "";
    if (!headers) {
      headers = row.map((value) => value.replace(/^\uFEFF/, "").trim().toLowerCase());
      if (!["cand_id", "spe_id", "can_office_state", "tran_id", "file_num"].every((key) => headers?.includes(key))) throw new Error("Unexpected FEC bulk CSV headers; retained data was not replaced.");
    } else if (row.some(Boolean)) onRecord(Object.fromEntries(headers.map((key, i) => [key, row[i] ?? ""])));
    row = []; rowCharacters = 0;
  }
  function write(input: string) {
    for (const ch of input) {
      if (++rowCharacters > 1_000_000) throw new Error("FEC CSV row exceeded size limit.");
      if (previousCr) { previousCr = false; if (ch === "\n") continue; }
      if (quotePending) {
        quotePending = false;
        if (ch === '"') { field += ch; continue; }
        quoted = false;
      }
      if (quoted) { if (ch === '"') quotePending = true; else field += ch; }
      else if (ch === '"' && !field) quoted = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\r" || ch === "\n") { finishRow(); previousCr = ch === "\r"; }
      else field += ch;
    }
  }
  return { write, end() { if (quoted && !quotePending) throw new Error("Truncated quoted FEC CSV field."); if (field || row.length) finishRow(); if (!headers) throw new Error("Empty FEC bulk CSV response."); } };
}

export async function readBoundedResponse(response: Response, consume: (text: string) => void, maxBytes: number) {
  if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status} ${response.statusText}`); }
  const length = Number(response.headers.get("content-length"));
  if (length > maxBytes) { await response.body?.cancel(); throw new Error("FEC response exceeds byte limit."); }
  if (!response.body) throw new Error("FEC response had no body.");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error("FEC response exceeds byte limit.");
      consume(decoder.decode(chunk.value, { stream: true }));
    }
    consume(decoder.decode()); return bytes;
  } finally { await reader.cancel().catch(() => undefined); }
}

export async function fetchFecPage(endpoint: URL, timeoutMs = 25_000): Promise<FecPage> {
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json", "user-agent": "Direct Democracy public civic source collector" } });
  let text = ""; await readBoundedResponse(response, (chunk) => { text += chunk; }, 8 * 1024 * 1024);
  const payload = JSON.parse(text) as FecPage;
  if (!Array.isArray(payload.results)) throw new Error("FEC API response did not contain results.");
  return payload;
}

export async function fetchFecBulk(cycle: number, timeoutMs = 90_000) {
  const response = await fetch(`https://www.fec.gov/files/bulk-downloads/${cycle}/independent_expenditure_${cycle}.csv`, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "text/csv", "user-agent": "Direct Democracy public civic source collector" } });
  const records: FecCommunicationRecord[] = [];
  const parser = csvParser((row) => { const record = normalizeBulkRecord(row, cycle); if (record && isPaidCommunication(record)) records.push(record); });
  await readBoundedResponse(response, parser.write, 256 * 1024 * 1024); parser.end();
  return records;
}
