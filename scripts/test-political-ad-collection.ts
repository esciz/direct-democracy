import assert from "node:assert/strict";
import { createServer } from "node:http";
import { csvParser, fetchFecPage, isPaidCommunication, mergeFecRecords, nextCursor, normalizeBulkRecord, readBoundedResponse, recordKey } from "../lib/political-ads/fec-collection";

async function main() {
  for (const purpose of ["DIGITAL ADVERTISING", "Printing and mailing", "Television advertisements", "SMS communications"]) assert.ok(isPaidCommunication({ expenditure_description: purpose }), purpose);
  assert.equal(isPaidCommunication({ expenditure_description: "Office rent" }), false);
  const old = { sub_id: "old", candidate_id: "H1NV00001", expenditure_description: "TV ads" };
  const distinct = Array.from({ length: 2100 }, (_, n) => ({ ...old, sub_id: `record-${n}` }));
  assert.equal(mergeFecRecords([old], distinct).length, 2101, "Archive and distinct same-purpose transactions must not be sampled or capped");
  assert.equal(mergeFecRecords([old], [{ ...old, expenditure_amount: 42 }])[0].expenditure_amount, 42);
  const source = { cand_id: "H1NV00001", cand_name: "EXAMPLE, PAT", spe_id: "C123", can_office_state: "NV", can_office: "H", tran_id: "SE.1", file_num: "111", exp_amo: "0", pur: 'Digital "advertising",\ncreative', dissem_dt: "01-SEP-26", amndt_ind: "A", prev_file_num: "100" };
  const first = normalizeBulkRecord(source, 2026)!;
  const second = normalizeBulkRecord({ ...source, file_num: "112" }, 2026)!;
  assert.notEqual(recordKey(first), recordKey(second), "A transaction ID is only unique within its filing");
  assert.equal(first.expenditure_amount, 0); assert.equal(first.dissemination_date, "2026-09-01");
  assert.equal(first.previous_file_number, "100"); assert.equal(first.amendment_indicator, "A");
  const fields = Object.keys(source); const csv = `${fields.join(",")}\r\n${Object.values(source).map((v) => `"${v.replaceAll('"', '""')}"`).join(",")}\r\n`;
  const rows: Record<string, string>[] = []; const parser = csvParser((row) => rows.push(row));
  for (const character of csv) parser.write(character); parser.end();
  assert.deepEqual(rows, [source], "CSV quotes, comma, newline and CRLF must survive single-byte chunks");
  assert.throws(() => { const p = csvParser(() => undefined); p.write('<html>challenge</html>\n'); p.end(); }, /headers/);
  assert.deepEqual(nextCursor({ pagination: { last_indexes: { last_index: "1234567890123456789", last_expenditure_date: "2026-09-01", unused: null } } }), { last_index: "1234567890123456789", last_expenditure_date: "2026-09-01" });
  await assert.rejects(readBoundedResponse(new Response("123456"), () => undefined, 3), /byte limit/);
  const server = createServer((_req, res) => { res.writeHead(200, { "content-type": "application/json" }); res.write('{"results":['); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { const address = server.address() as { port: number }; const started = Date.now(); await assert.rejects(fetchFecPage(new URL(`http://127.0.0.1:${address.port}/`), 80)); assert.ok(Date.now() - started < 2000, "A stalled body must be aborted"); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  console.log("Political ad collection: purpose stems, lossless history, filing identity, CSV streaming, zero amounts, provenance, pagination, response limits and body deadlines passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
