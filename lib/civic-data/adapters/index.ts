import { asunAdapter } from "@/lib/civic-data/adapters/asun";
import { carsonCityAdapter } from "@/lib/civic-data/adapters/carson-city";
import { nevadaFederalDelegationAdapter } from "@/lib/civic-data/adapters/nevada-federal-delegation";
import { nevadaLegislatureAdapter } from "@/lib/civic-data/adapters/nevada-legislature";
import { nevadaSecretaryOfStateAdapter } from "@/lib/civic-data/adapters/nevada-secretary-of-state";
import { nevadaStateGovernmentAdapter } from "@/lib/civic-data/adapters/nevada-state-government";
import { renoAdapter } from "@/lib/civic-data/adapters/reno";
import { unrAdapter } from "@/lib/civic-data/adapters/unr";
import { washoeCountyAdapter } from "@/lib/civic-data/adapters/washoe-county";
import type { CivicDataAdapter, CivicSourceAdapterKey } from "@/lib/civic-data/types";

export const civicDataAdapters: Record<CivicSourceAdapterKey, CivicDataAdapter> = {
  "nevada-legislature": nevadaLegislatureAdapter,
  "nevada-state-government": nevadaStateGovernmentAdapter,
  "nevada-federal-delegation": nevadaFederalDelegationAdapter,
  "nevada-secretary-of-state": nevadaSecretaryOfStateAdapter,
  reno: renoAdapter,
  "carson-city": carsonCityAdapter,
  "washoe-county": washoeCountyAdapter,
  unr: unrAdapter,
  asun: asunAdapter,
};

export function getCivicDataAdapter(adapterKey: CivicSourceAdapterKey) {
  return civicDataAdapters[adapterKey];
}
