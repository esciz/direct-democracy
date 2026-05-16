import type { ReactNode } from "react";

import type { PoliticalAdFilters, PoliticalAdRelationType, PoliticalAdSourceType, PoliticalAdSponsorType, PoliticalAdTruthRating } from "@/types/domain";
import { POLITICAL_AD_SOURCE_LABELS, POLITICAL_AD_SPONSOR_LABELS } from "@/lib/political-ads/store";

type PoliticalAdFiltersProps = {
  filters: PoliticalAdFilters;
};

const RELATION_OPTIONS: Array<{ value: PoliticalAdRelationType | "all"; label: string }> = [
  { value: "all", label: "All directions" },
  { value: "supports", label: "Supports" },
  { value: "opposes", label: "Opposes" },
  { value: "mentions", label: "Mentions" },
  { value: "related", label: "Related" },
];

const RATING_OPTIONS: Array<PoliticalAdTruthRating | "all"> = ["all", "True", "Mostly True", "Mostly False", "False", "Not Checkable", "Needs Review"];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "mostExpensive", label: "Most expensive" },
  { value: "mostViewed", label: "Most viewed" },
  { value: "mostMisleading", label: "Most misleading" },
  { value: "mostDisputed", label: "Most disputed" },
  { value: "highestCitizenParticipation", label: "Highest citizen participation" },
];

function SelectField({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
      {label}
      <select name={name} defaultValue={value ?? "all"} className="dd-input rounded-2xl px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-cyan-300/40">
        {children}
      </select>
    </label>
  );
}

export function PoliticalAdFilters({ filters }: PoliticalAdFiltersProps) {
  return (
    <form action="/ads" className="dd-panel rounded-[1.75rem] p-5">
      {filters.candidateId ? <input type="hidden" name="candidateId" value={filters.candidateId} /> : null}
      {filters.officialId ? <input type="hidden" name="officialId" value={filters.officialId} /> : null}
      {filters.issueId ? <input type="hidden" name="issueId" value={filters.issueId} /> : null}
      {filters.ballotMeasureId ? <input type="hidden" name="ballotMeasureId" value={filters.ballotMeasureId} /> : null}
      {filters.electionId ? <input type="hidden" name="electionId" value={filters.electionId} /> : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Search ads
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search candidates, sponsors, issues, claims..."
            className="dd-input rounded-2xl px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-cyan-300/40"
          />
        </label>
        <SelectField label="Source" name="sourceType" value={filters.sourceType}>
          <option value="all">All sources</option>
          {Object.entries(POLITICAL_AD_SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Sponsor type" name="sponsorType" value={filters.sponsorType}>
          <option value="all">All sponsors</option>
          {Object.entries(POLITICAL_AD_SPONSOR_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Direction" name="relationType" value={filters.relationType}>
          {RELATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-5">
        <SelectField label="System rating" name="systemRating" value={filters.systemRating}>
          {RATING_OPTIONS.map((rating) => (
            <option key={rating} value={rating}>
              {rating === "all" ? "All system ratings" : rating}
            </option>
          ))}
        </SelectField>
        <SelectField label="Citizen rating" name="citizenRating" value={filters.citizenRating}>
          {RATING_OPTIONS.map((rating) => (
            <option key={rating} value={rating}>
              {rating === "all" ? "All citizen ratings" : rating}
            </option>
          ))}
        </SelectField>
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Geography
          <input name="geography" defaultValue={filters.geography ?? ""} className="dd-input rounded-2xl px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-cyan-300/40" />
        </label>
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Sponsor
          <input name="sponsor" defaultValue={filters.sponsor ?? ""} className="dd-input rounded-2xl px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-cyan-300/40" />
        </label>
        <SelectField label="Sort" name="sort" value={filters.sort}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" className="dd-button-primary rounded-full px-5 py-3 text-sm font-semibold">
          Apply filters
        </button>
        <a href="/ads" className="dd-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
          Reset
        </a>
      </div>
    </form>
  );
}
