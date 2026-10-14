import { DistrictType } from "@prisma/client";

export type DistrictSourceAdapterStub = {
  key: string;
  label: string;
  sourceName: string;
  sourceUrl: string;
  districtTypes: DistrictType[];
  boundarySupport: "ready" | "stub";
  notes: string;
};

export const DISTRICT_SOURCE_ADAPTER_STUBS: DistrictSourceAdapterStub[] = [
  {
    key: "nevada-secretary-of-state",
    label: "Nevada SOS candidate/election data",
    sourceName: "Nevada Secretary of State Elections",
    sourceUrl: "https://www.nvsos.gov/sos/elections",
    districtTypes: [DistrictType.CONGRESSIONAL, DistrictType.STATE_SENATE, DistrictType.STATE_ASSEMBLY, DistrictType.COUNTY_COMMISSION, DistrictType.CITY_WARD, DistrictType.SCHOOL_BOARD],
    boundarySupport: "stub",
    notes: "Candidate and election records are linked to normalized districts. Exact address matching still requires official GIS boundary imports.",
  },
  {
    key: "nevada-legislature-districts",
    label: "Nevada Legislature district data",
    sourceName: "Nevada Legislature",
    sourceUrl: "https://www.leg.state.nv.us/",
    districtTypes: [DistrictType.STATE_SENATE, DistrictType.STATE_ASSEMBLY],
    boundarySupport: "stub",
    notes: "Exact legislative district matching is unavailable until the official boundary layer is imported.",
  },
  {
    key: "washoe-county-commission-districts",
    label: "County commission districts",
    sourceName: "Washoe County Government",
    sourceUrl: "https://www.washoecounty.gov/",
    districtTypes: [DistrictType.COUNTY_COMMISSION],
    boundarySupport: "stub",
    notes: "Exact county commission district matching is unavailable until the official boundary layer is imported.",
  },
  {
    key: "city-ward-districts",
    label: "City ward districts",
    sourceName: "Reno / Sparks / Carson City municipal sources",
    sourceUrl: "https://www.reno.gov/government",
    districtTypes: [DistrictType.CITY_WARD],
    boundarySupport: "stub",
    notes: "Exact municipal ward matching is unavailable until official city boundary layers are imported.",
  },
  {
    key: "school-board-trustee-districts",
    label: "School board trustee districts",
    sourceName: "Washoe County School District",
    sourceUrl: "https://www.washoeschools.net/",
    districtTypes: [DistrictType.SCHOOL_DISTRICT, DistrictType.SCHOOL_BOARD],
    boundarySupport: "stub",
    notes: "Exact school trustee district matching is unavailable until the official boundary layer is imported.",
  },
  {
    key: "nevada-courts",
    label: "Nevada courts / judicial districts",
    sourceName: "Nevada Judiciary",
    sourceUrl: "https://nvcourts.gov/",
    districtTypes: [DistrictType.JUDICIAL_DISTRICT],
    boundarySupport: "stub",
    notes: "Exact judicial district matching is unavailable until official court boundary data is imported.",
  },
  {
    key: "municipal-courts",
    label: "Municipal courts",
    sourceName: "Municipal court public sources",
    sourceUrl: "https://www.reno.gov/government/departments",
    districtTypes: [DistrictType.MUNICIPAL_COURT],
    boundarySupport: "stub",
    notes: "Exact municipal court matching is unavailable until official court jurisdiction data is imported.",
  },
  {
    key: "justice-courts",
    label: "Justice courts",
    sourceName: "County justice court public sources",
    sourceUrl: "https://www.washoecounty.gov/",
    districtTypes: [DistrictType.JUSTICE_COURT],
    boundarySupport: "stub",
    notes: "Exact justice court township matching is unavailable until official jurisdiction data is imported.",
  },
];
