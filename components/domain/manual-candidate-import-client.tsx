"use client";

import { useActionState } from "react";

import {
  importManualCandidateRowsAction,
  previewManualCandidateImportAction,
  type ManualCandidateImportState,
} from "@/lib/civic-data/manual-candidate-import";

const initialState: ManualCandidateImportState = {
  status: "idle",
};

function StatusBanner({ state }: { state: ManualCandidateImportState }) {
  if (!state.message) return null;

  const tone =
    state.status === "error"
      ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
      : state.status === "imported"
        ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
        : "border-cyan-300/20 bg-cyan-500/10 text-cyan-100";

  return <div className={`rounded-2xl border p-4 text-sm ${tone}`}>{state.message}</div>;
}

function confidenceClass(confidence: string) {
  if (confidence === "High") return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  if (confidence === "Medium") return "border-cyan-300/20 bg-cyan-500/10 text-cyan-100";
  if (confidence === "Duplicate") return "border-slate-300/20 bg-white/10 text-slate-200";
  return "border-amber-300/20 bg-amber-500/10 text-amber-100";
}

export function ManualCandidateImportClient() {
  const [previewState, previewAction, previewPending] = useActionState(previewManualCandidateImportAction, initialState);
  const [importState, importAction, importPending] = useActionState(importManualCandidateRowsAction, initialState);
  const rows = previewState.rows ?? [];
  const duplicateCount = rows.filter((row) => row.confidence === "Duplicate").length;
  const needsReviewCount = rows.filter((row) => row.confidence === "Low").length;

  return (
    <div className="space-y-6">
      <StatusBanner state={previewState} />
      <StatusBanner state={importState} />

      {importState.summary ? (
        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["Rows reviewed", importState.summary.recordsSeen],
            ["Imported", importState.summary.recordsImported],
            ["Duplicates skipped", importState.summary.duplicatesSkipped],
            ["Needs review", importState.summary.needsReviewImported],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
              <p className="mt-3 text-3xl font-semibold text-slate-50">{Number(value).toLocaleString()}</p>
            </div>
          ))}
        </section>
      ) : null}

      <form action={previewAction} className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-slate-100">Official source URL</span>
            <input
              name="sourceUrl"
              type="url"
              placeholder="https://www.nvsos.gov/..."
              className="dd-input w-full rounded-2xl px-4 py-3 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-slate-100">Source name or file label</span>
            <input
              name="sourceName"
              placeholder="Nevada SOS candidate filing list"
              className="dd-input w-full rounded-2xl px-4 py-3 text-sm"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-slate-100">Format</span>
            <select name="sourceFormat" defaultValue="auto" className="dd-input w-full rounded-2xl px-4 py-3 text-sm">
              <option value="auto">Auto-detect</option>
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
              <option value="html">Copied HTML/table</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-semibold text-slate-100">Upload official file</span>
            <input
              name="candidateFile"
              type="file"
              accept=".csv,.xlsx,.json,.html,.htm,text/csv,application/json,text/html"
              className="block w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-cyan-400 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-950"
            />
          </label>
        </div>
        <label className="mt-4 block space-y-2 text-sm">
          <span className="font-semibold text-slate-100">Paste official CSV, copied table, HTML, or JSON</span>
          <textarea
            name="pastedContent"
            rows={9}
            placeholder="Paste official candidate table content here."
            className="dd-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" disabled={previewPending} className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold disabled:opacity-60">
            {previewPending ? "Parsing..." : "Preview Candidates"}
          </button>
        </div>
      </form>

      {rows.length ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Review before import</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{rows.length} parsed candidate rows</h2>
              <p className="mt-2 text-sm text-slate-400">
                {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"} detected · {needsReviewCount} row{needsReviewCount === 1 ? "" : "s"} need review
              </p>
            </div>
            <form action={importAction}>
              <input type="hidden" name="rowsJson" value={JSON.stringify(rows)} />
              <input type="hidden" name="sourceName" value={previewState.sourceName ?? "Manual Candidate Import"} />
              <input type="hidden" name="sourceUrl" value={previewState.sourceUrl ?? "manual://candidate-import"} />
              <input type="hidden" name="sourceFormat" value={previewState.sourceFormat ?? "manual"} />
              <button type="submit" disabled={importPending} className="dd-button-primary rounded-full px-4 py-3 text-sm font-semibold disabled:opacity-60">
                {importPending ? "Importing..." : "Import Reviewed Rows"}
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[1fr_1fr_0.7fr_0.9fr_0.9fr_0.8fr]">
              <span>Candidate</span>
              <span>Office</span>
              <span>Party</span>
              <span>Election</span>
              <span>Match</span>
              <span>QA flags</span>
            </div>
            <div className="divide-y divide-white/10">
              {rows.map((row) => (
                <article key={`${row.rowNumber}-${row.candidateName}`} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1fr_1fr_0.7fr_0.9fr_0.9fr_0.8fr]">
                  <div>
                    <p className="font-semibold text-slate-50">{row.candidateName || "Missing name"}</p>
                    <p className="mt-1 text-xs text-slate-500">Row {row.rowNumber}</p>
                  </div>
                  <div>
                    <p className="text-slate-200">{row.officeSought ?? "Missing office"}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.jurisdiction ?? "Missing jurisdiction"} · {row.district ?? "No district"}</p>
                  </div>
                  <p className="text-slate-300">{row.party ?? "Missing party"}</p>
                  <p className="text-slate-300">{row.election ?? "Missing election"}</p>
                  <div className="space-y-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${confidenceClass(row.confidence)}`}>
                      {row.confidence}
                    </span>
                    <p className="text-xs text-slate-500">{row.matchStatus}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.qaFlags.length ? (
                      row.qaFlags.map((flag) => (
                        <span key={flag} className="rounded-full border border-amber-300/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-100">
                          {flag}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">Clean</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
