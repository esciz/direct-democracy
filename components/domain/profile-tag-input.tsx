"use client";

import { useMemo, useState } from "react";

import { PREDEFINED_PROFILE_TAG_OPTIONS, PROFILE_TAG_CATEGORY_OPTIONS, getProfileTagCategoryLabel } from "@/lib/profile/options";
import type { ProfileTagCategory, ProfileTagSummary } from "@/types/domain";

type ProfileTagInputProps = {
  inputName: string;
  tags: ProfileTagSummary[];
  maxItems?: number;
};

type RowState = {
  category: ProfileTagCategory | "";
  option: string;
  custom: string;
  isPublic: boolean;
};

function buildInitialRows(tags: ProfileTagSummary[], maxItems: number): RowState[] {
  return Array.from({ length: maxItems }, (_, index) => {
    const tag = tags[index];

    if (!tag) {
      return { category: "", option: "", custom: "", isPublic: false };
    }

    const options = PREDEFINED_PROFILE_TAG_OPTIONS[tag.category] ?? [];

    return tag.isCustom || !options.includes(tag.value)
      ? { category: tag.category, option: "__custom__", custom: tag.value, isPublic: tag.isPublic }
      : { category: tag.category, option: tag.value, custom: "", isPublic: tag.isPublic };
  });
}

export function ProfileTagInput({ inputName, tags, maxItems = 6 }: ProfileTagInputProps) {
  const [rows, setRows] = useState<RowState[]>(() => buildInitialRows(tags, maxItems));

  const serializedValue = useMemo(
    () =>
      JSON.stringify(
        rows.flatMap((row) => {
          if (!row.category) {
            return [];
          }

          const value = row.option === "__custom__" ? row.custom.trim() : row.option.trim();

          if (!value) {
            return [];
          }

          return [
            {
              category: row.category,
              value,
              isCustom: row.option === "__custom__",
              isPublic: row.isPublic,
            },
          ];
        }),
      ),
    [rows],
  );

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium text-ink">Identity and community tags</p>
        <p className="mt-1 text-xs text-slate-500">
          Optional, self-managed tags. You control visibility for each one, and nothing is inferred or verified.
        </p>
      </div>
      <input type="hidden" name={inputName} value={serializedValue} />
      <div className="grid gap-3">
        {rows.map((row, index) => {
          const options = row.category ? PREDEFINED_PROFILE_TAG_OPTIONS[row.category] : [];

          return (
            <div key={`${inputName}-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-3 lg:grid-cols-[13rem,minmax(0,1fr),minmax(0,1fr)]">
                <select
                  value={row.category}
                  onChange={(event) => {
                    const nextCategory = event.target.value as ProfileTagCategory | "";
                    const nextRows = [...rows];
                    nextRows[index] = {
                      category: nextCategory,
                      option: "",
                      custom: "",
                      isPublic: row.isPublic,
                    };
                    setRows(nextRows);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500"
                  aria-label={`Select category for tag ${index + 1}`}
                >
                  <option value="">Choose category</option>
                  {PROFILE_TAG_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="grid gap-3">
                  <select
                    value={row.option}
                    onChange={(event) => {
                      const nextRows = [...rows];
                      nextRows[index] = {
                        ...row,
                        option: event.target.value,
                        custom: event.target.value === "__custom__" ? row.custom : "",
                      };
                      setRows(nextRows);
                    }}
                    disabled={!row.category}
                    className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-civic-500"
                    aria-label={
                      row.category
                        ? `Select a ${getProfileTagCategoryLabel(row.category).toLowerCase()} tag`
                        : `Select a tag option`
                    }
                  >
                    <option value="">{row.category ? "Select an option" : "Choose a category first"}</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value="__custom__">Other / Custom</option>
                  </select>
                  <input
                    value={row.custom}
                    onChange={(event) => {
                      const nextRows = [...rows];
                      nextRows[index] = {
                        ...row,
                        option: "__custom__",
                        custom: event.target.value,
                      };
                      setRows(nextRows);
                    }}
                    placeholder="Write in your own"
                    disabled={row.option !== "__custom__"}
                    className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100 focus:border-civic-500"
                  />
                </div>
                <label className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
                  <input
                    type="checkbox"
                    checked={row.isPublic}
                    onChange={(event) => {
                      const nextRows = [...rows];
                      nextRows[index] = { ...row, isPublic: event.target.checked };
                      setRows(nextRows);
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Show publicly
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
