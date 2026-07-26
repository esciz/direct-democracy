"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

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
  const visibleRows = Math.min(maxItems, Math.max(1, values.length + (values.length < maxItems ? 1 : 0)));
  const rows = Array.from({ length: visibleRows }, (_, index) => {
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
          <div key={`${inputName}-${index}`} className="grid min-w-0 grid-cols-[minmax(0,1fr)_2rem] gap-2 py-2.5">
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
                className="h-10 w-full min-w-0 rounded-md border border-white/12 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
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
                  className="h-10 w-full min-w-0 rounded-md border border-white/12 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                />
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                if (rows.length === 1) {
                  setRows([{ option: "", custom: "" }]);
                  return;
                }
                setRows(rows.filter((_, rowIndex) => rowIndex !== index));
              }}
              className="flex h-10 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200"
              aria-label={`Remove ${label.toLowerCase()} choice ${index + 1}`}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      {rows.length < maxItems ? (
        <button
          type="button"
          onClick={() => setRows([...rows, { option: "", custom: "" }])}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10"
        >
          <Plus size={14} />
          Add another
        </button>
      ) : null}
    </div>
  );
}
