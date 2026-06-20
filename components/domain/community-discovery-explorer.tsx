"use client";

import Link from "next/link";
import { useState } from "react";

type CommunitySearchResult = {
  id: string;
  label: string;
  typeLabel: "State" | "County" | "City" | "Community" | "Campus" | "USA";
  href: string;
  description?: string;
};

type StateTile = {
  code: string;
  name: string;
  row: number;
  col: number;
  href: string;
  hasDedicatedPage: boolean;
};

type CommunityDiscoveryExplorerProps = {
  searchResults: CommunitySearchResult[];
  stateTiles: StateTile[];
};

export function CommunityDiscoveryExplorer({ searchResults, stateTiles }: CommunityDiscoveryExplorerProps) {
  const [query, setQuery] = useState("");
  const [activeStateName, setActiveStateName] = useState<string>("Nevada");

  const normalizedQuery = query.trim().toLowerCase();
  const filteredResults = normalizedQuery
    ? searchResults
        .filter((entry) => {
          const haystack = `${entry.label} ${entry.typeLabel} ${entry.description ?? ""}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-8">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Search</p>
            <p className="mt-2 text-sm text-slate-600">Find a state, county, city, or major community and jump straight to it.</p>
          </div>
          <div className="w-full max-w-2xl">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search communities"
              className="w-full rounded-full border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 outline-none transition focus:border-civic-500"
            />
            {filteredResults.length ? (
              <div className="mt-3 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                {filteredResults.map((entry) => (
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
            ) : normalizedQuery ? (
              <div className="mt-3 rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600 shadow-sm">
                No matching community results yet.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-civic-700">Map</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Nevada launch map</h2>
            <p className="mt-2 text-sm text-slate-600">Open Nevada statewide coverage first. Other state-local coverage remains in the backlog.</p>
          </div>
          <div className="rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
            {activeStateName}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <div
            className="grid min-w-[760px] gap-2"
            style={{
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gridTemplateRows: "repeat(8, minmax(0, 1fr))",
            }}
          >
            {stateTiles.map((state) => (
              <Link
                key={state.code}
                href={state.href}
                title={state.name}
                aria-label={state.name}
                onMouseEnter={() => setActiveStateName(state.name)}
                onFocus={() => setActiveStateName(state.name)}
                className={`flex h-12 items-center justify-center rounded-2xl border text-xs font-semibold transition ${
                  state.hasDedicatedPage
                    ? "border-civic-200 bg-civic-50 text-civic-800 hover:border-civic-400 hover:bg-civic-100"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                }`}
                style={{
                  gridColumn: `${state.col} / span 1`,
                  gridRow: `${state.row} / span 1`,
                }}
              >
                {state.code}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
          Nevada is the active statewide launch. Federal coverage appears as an overlay for actions that affect Nevada.
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap gap-3">
          {searchResults.slice(0, 5).map((entry) => (
            <Link
              key={entry.id}
              href={entry.href}
              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-civic-500 hover:text-civic-700"
            >
              {entry.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
