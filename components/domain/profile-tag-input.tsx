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
    <div className="min-w-0">
      <div>
        <p className="text-sm font-semibold text-slate-100">About you</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          Optional, self-reported details. You choose which ones are public.
        </p>
      </div>
      <input type="hidden" name={inputName} value={serializedValue} />
      <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
        {rows.map((row, index) => {
          const options = row.category ? PREDEFINED_PROFILE_TAG_OPTIONS[row.category] : [];

          return (
            <div key={`${inputName}-${index}`} className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-400"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="grid min-w-0 gap-2 lg:grid-cols-[11rem_minmax(0,1fr)_9rem]">
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
                  className="min-h-11 w-full min-w-0 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                  aria-label={`Select category for tag ${index + 1}`}
                >
                  <option value="">Choose category</option>
                  {PROFILE_TAG_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className={row.option === "__custom__" ? "grid min-w-0 gap-2 sm:grid-cols-2" : "min-w-0"}>
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
                    className="min-h-11 w-full min-w-0 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none disabled:cursor-not-allowed disabled:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
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
                  {row.option === "__custom__" ? (
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
                      className="min-h-11 w-full min-w-0 rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                    />
                  ) : null}
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={row.isPublic}
                    onChange={(event) => {
                      const nextRows = [...rows];
                      nextRows[index] = { ...row, isPublic: event.target.checked };
                      setRows(nextRows);
                    }}
                    className="h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
                  />
                  Public
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
