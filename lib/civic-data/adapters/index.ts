import { arcgisBoundariesAdapter } from "@/lib/civic-data/adapters/arcgis-boundaries";
import { carsonCityAdapter } from "@/lib/civic-data/adapters/carson-city";
import { countyElectionOfficeAdapter } from "@/lib/civic-data/adapters/county-election-office";
import { nevadaFederalDelegationAdapter } from "@/lib/civic-data/adapters/nevada-federal-delegation";
import { nevadaLegislatureAdapter } from "@/lib/civic-data/adapters/nevada-legislature";
import { nevadaLegislatureRecordsAdapter } from "@/lib/civic-data/adapters/nevada-legislature-records";
import { nevadaSecretaryOfStateAdapter } from "@/lib/civic-data/adapters/nevada-secretary-of-state";
import { nevadaStateGovernmentAdapter } from "@/lib/civic-data/adapters/nevada-state-government";
import { openStatesAdapter } from "@/lib/civic-data/adapters/openstates";
import { renoAdapter } from "@/lib/civic-data/adapters/reno";
import { washoeCountyAdapter } from "@/lib/civic-data/adapters/washoe-county";
import type { CivicDataAdapter, CivicSourceAdapterKey } from "@/lib/civic-data/types";

export const civicDataAdapters: Record<CivicSourceAdapterKey, CivicDataAdapter> = {
  "nevada-legislature": nevadaLegislatureAdapter,
  "nevada-state-government": nevadaStateGovernmentAdapter,
  "nevada-federal-delegation": nevadaFederalDelegationAdapter,
  "nevada-secretary-of-state": nevadaSecretaryOfStateAdapter,
  openstates: openStatesAdapter,
  "nevada-legislature-records": nevadaLegislatureRecordsAdapter,
  "arcgis-boundaries": arcgisBoundariesAdapter,
  reno: renoAdapter,
  "carson-city": carsonCityAdapter,
  "washoe-county": washoeCountyAdapter,
  "county-election-office": countyElectionOfficeAdapter,
};

export function getCivicDataAdapter(adapterKey: CivicSourceAdapterKey) {
  return civicDataAdapters[adapterKey];
}
