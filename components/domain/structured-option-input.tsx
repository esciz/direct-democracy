"use client";

import { useMemo, useState } from "react";

import type { StructuredProfileValueSummary } from "@/types/domain";

type StructuredOptionInputProps = {
  label: string;
  inputName: string;
  options: readonly string[];
  values: StructuredProfileValueSummary[];
  maxItems: number;
  customLabel?: string;
  allowCustom?: boolean;
  helpText?: string;
};

type RowState = {
  option: string;
  custom: string;
};

function buildInitialRows(values: StructuredProfileValueSummary[], options: readonly string[], maxItems: number): RowState[] {
  const rows = Array.from({ length: maxItems }, (_, index) => {
    const value = values[index];

    if (!value) {
      return { option: "", custom: "" };
    }

    return value.isCustom || !options.includes(value.value)
      ? { option: "__custom__", custom: value.value }
      : { option: value.value, custom: "" };
  });

  return rows;
}

export function StructuredOptionInput({
  label,
  inputName,
  options,
  values,
  maxItems,
  customLabel = "Custom",
  allowCustom = true,
  helpText = "Choose a common option or add your own.",
}: StructuredOptionInputProps) {
  const [rows, setRows] = useState<RowState[]>(() => buildInitialRows(values, options, maxItems));

  const serializedValue = useMemo(
    () =>
      JSON.stringify(
        rows.flatMap((row) => {
          if (row.option === "__custom__") {
            const customValue = row.custom.trim();

            return customValue ? [{ value: customValue, isCustom: true }] : [];
          }

          const selectedValue = row.option.trim();
          return selectedValue ? [{ value: selectedValue, isCustom: false }] : [];
        }),
      ),
    [rows],
  );

  const selectedOptions = useMemo(
    () => new Set(rows.map((row) => row.option).filter((option) => option && option !== "__custom__")),
    [rows],
  );

  return (
    <div className="min-w-0">
      <div>
        <p className="text-sm font-semibold text-slate-100">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{helpText}</p>
      </div>
      <input type="hidden" name={inputName} value={serializedValue} />
      <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
        {rows.map((row, index) => (
          <div key={`${inputName}-${index}`} className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-400"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className={allowCustom && row.option === "__custom__" ? "grid min-w-0 gap-2 sm:grid-cols-2" : "min-w-0"}>
              <select
                aria-label={`${label}, choice ${index + 1}`}
                value={row.option}
                onChange={(event) => {
                  const nextRows = [...rows];
                  nextRows[index] = {
                    option: event.target.value,
                    custom: event.target.value === "__custom__" ? row.custom : "",
                  };
                  setRows(nextRows);
                }}
                className="min-h-11 w-full min-w-0 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
              >
                <option value="">Choose a topic</option>
                {options.map((option) => (
                  <option key={option} value={option} disabled={row.option !== option && selectedOptions.has(option)}>
                    {option}
                  </option>
                ))}
                {allowCustom ? <option value="__custom__">{customLabel}</option> : null}
              </select>
              {allowCustom && row.option === "__custom__" ? (
                <input
                  aria-label={`${label}, custom choice ${index + 1}`}
                  value={row.custom}
                  onChange={(event) => {
                    const nextRows = [...rows];
                    nextRows[index] = {
                      ...row,
                      option: row.option || "__custom__",
                      custom: event.target.value,
                    };
                    setRows(nextRows);
                  }}
                  placeholder="Write in your own"
                  className="min-h-11 w-full min-w-0 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
