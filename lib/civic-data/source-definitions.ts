import { SourceType } from "@prisma/client";

import type { CivicSourceDefinition } from "@/lib/civic-data/types";

export const NEVADA_BETA_SOURCE_DEFINITIONS: CivicSourceDefinition[] = [
  {
    name: "Nevada Electronic Legislative Information System",
    slug: "nevada-legislature-nelis",
    sourceType: SourceType.LEGISLATIVE_API,
    url: "https://www.leg.state.nv.us/Redir/toCurrentNELIS.cfm",
    adapterKey: "nevada-legislature",
    jurisdictionSlug: "nevada",
    description: "Nevada Legislature bills, sponsors, committees, meetings, agendas, and votes.",
  },
  {
    name: "Nevada Secretary of State Elections",
    slug: "nevada-secretary-of-state-elections",
    sourceType: SourceType.ELECTIONS_PORTAL,
    url: "https://www.nvsos.gov/sos/elections",
    adapterKey: "nevada-secretary-of-state",
    jurisdictionSlug: "nevada",
    description: "Statewide elections, candidates, ballot questions, and campaign finance filings.",
  },
  {
    name: "State of Nevada Constitutional Officers",
    slug: "nevada-state-government-officials",
    sourceType: SourceType.GOVERNMENT_PORTAL,
    url: "https://nv.gov/",
    adapterKey: "nevada-state-government",
    jurisdictionSlug: "nevada",
    description: "Nevada statewide elected executive offices and current officeholders from official state websites.",
  },
  {
    name: "Nevada Federal Delegation",
    slug: "nevada-federal-delegation",
    sourceType: SourceType.GOVERNMENT_PORTAL,
    url: "https://www.congress.gov/members/find-your-member",
    adapterKey: "nevada-federal-delegation",
    jurisdictionSlug: "nevada",
    description: "Nevada U.S. Senators and U.S. Representatives from official congressional websites.",
  },
  {
    name: "City of Reno Government",
    slug: "reno-government",
    sourceType: SourceType.MUNICIPAL_PORTAL,
    url: "https://www.reno.gov/government",
    adapterKey: "reno",
    jurisdictionSlug: "reno",
    description: "Reno offices, officials, council meetings, agendas, and local civic records.",
  },
  {
    name: "Carson City Government",
    slug: "carson-city-government",
    sourceType: SourceType.MUNICIPAL_PORTAL,
    url: "https://www.carson.org/",
    adapterKey: "carson-city",
    jurisdictionSlug: "carson-city",
    description: "Carson City offices, elections, meetings, agendas, and local government records.",
  },
  {
    name: "Washoe County Government",
    slug: "washoe-county-government",
    sourceType: SourceType.COUNTY_PORTAL,
    url: "https://www.washoecounty.gov/",
    adapterKey: "washoe-county",
    jurisdictionSlug: "washoe-county",
    description: "Washoe County commissioners, departments, meetings, agendas, and county records.",
  },
  {
    name: "University of Nevada, Reno",
    slug: "unr-government-relations",
    sourceType: SourceType.UNIVERSITY_PORTAL,
    url: "https://www.unr.edu/government",
    adapterKey: "unr",
    jurisdictionSlug: "unr",
    description: "UNR governance, government relations, campus civic offices, and public meetings.",
  },
  {
    name: "Associated Students of the University of Nevada",
    slug: "asun-student-government",
    sourceType: SourceType.STUDENT_GOVERNMENT_PORTAL,
    url: "https://nevadaasun.com/",
    adapterKey: "asun",
    jurisdictionSlug: "asun",
    description: "ASUN elected student government offices, senate, legislation, minutes, and meetings.",
  },
];

export function getSourceDefinition(slug: string) {
  return NEVADA_BETA_SOURCE_DEFINITIONS.find((source) => source.slug === slug);
}
