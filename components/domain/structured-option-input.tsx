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

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{helpText}</p>
      </div>
      <input type="hidden" name={inputName} value={serializedValue} />
      <div className="grid gap-3">
        {rows.map((row, index) => (
          <div key={`${inputName}-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
              <select
                value={row.option}
                onChange={(event) => {
                  const nextRows = [...rows];
                  nextRows[index] = {
                    option: event.target.value,
                    custom: event.target.value === "__custom__" ? row.custom : "",
                  };
                  setRows(nextRows);
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
              >
                <option value="">Select an option</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                {allowCustom ? <option value="__custom__">{customLabel}</option> : null}
              </select>
              {allowCustom ? (
                <input
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
                  disabled={row.option !== "__custom__"}
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-civic-500"
                />
              ) : (
                <div className="rounded-full border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500">
                  Choose from the shared issue list to keep profiles linked to the same topic hubs.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
