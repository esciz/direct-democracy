"use client";

import Link from "next/link";
import { useState } from "react";

type CommunitySwitchResult = {
  id: string;
  label: string;
  typeLabel: "USA" | "State" | "County" | "City" | "Campus";
  href: string;
  description?: string;
};

type CommunitySwitchButtonProps = {
  currentCommunityName: string;
  results: CommunitySwitchResult[];
};

export function CommunitySwitchButton({ currentCommunityName, results }: CommunitySwitchButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? results
        .filter((entry) => `${entry.label} ${entry.typeLabel} ${entry.description ?? ""}`.toLowerCase().includes(normalized))
        .slice(0, 8)
    : results.slice(0, 8);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Switch community</p>
          <p className="mt-2 text-sm text-slate-600">Open the predictive community search to jump to another place-based page without leaving this flow.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {open ? "Close search" : `Switch from ${currentCommunityName}`}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search communities"
            className="w-full rounded-full border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 outline-none transition focus:border-civic-500"
          />

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {filtered.map((entry) => (
              <Link
                key={entry.id}
                href={entry.href}
                className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 text-sm transition last:border-b-0 hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-ink">{entry.label}</p>
                  {entry.description ? <p className="mt-1 text-slate-600">{entry.description}</p> : null}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                  {entry.typeLabel}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
