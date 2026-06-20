export type CivicLayer = "city" | "county" | "school_district" | "state" | "federal" | "special_district";

export type CivicJurisdictionContext = {
  civicLayer: CivicLayer;
  civicLayerLabel: string;
  issueBadge: string;
  jurisdictionName: string;
  governingBodyName: string | null;
  primaryLabel: string;
  secondaryLabel: string | null;
};

type JurisdictionInput = {
  jurisdiction?: string | null;
  jurisdictionName?: string | null;
  body_name?: string | null;
  bodyName?: string | null;
  governing_body?: string | null;
  governingBody?: string | null;
  public_body_name?: string | null;
  officialBody?: string | null;
};

function clean(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function getCivicJurisdictionContext(record: JurisdictionInput): CivicJurisdictionContext {
  const jurisdictionName = clean(record.jurisdiction ?? record.jurisdictionName) || "Jurisdiction pending";
  const governingBodyName = clean(record.body_name ?? record.bodyName ?? record.governing_body ?? record.governingBody ?? record.public_body_name ?? record.officialBody) || null;
  const haystack = `${jurisdictionName} ${governingBodyName ?? ""}`.toLowerCase();

  let civicLayer: CivicLayer = "special_district";
  if (/\bunited states\b|\bfederal\b|\bu\.s\./i.test(haystack)) civicLayer = "federal";
  else if (/\bstate\b|\bnevada\b|\bsenate\b|\bassembly\b|\blegislature\b/i.test(haystack) && !/\bschool district\b/i.test(haystack)) civicLayer = "state";
  else if (/\bschool district\b|\bboard of trustees\b|\beducation\b/i.test(haystack)) civicLayer = "school_district";
  else if (/\bcounty\b|\bcommission\b|\bcommissioners\b/i.test(haystack)) civicLayer = "county";
  else if (/\bcity\b|\bcouncil\b|\bmayor\b|\bmunicipal\b/i.test(haystack)) civicLayer = "city";

  const labels: Record<CivicLayer, { layer: string; badge: string }> = {
    city: { layer: "My City", badge: "City issue" },
    county: { layer: "My County", badge: "County issue" },
    school_district: { layer: "My School District", badge: "School district issue" },
    state: { layer: "State", badge: "State issue" },
    federal: { layer: "Federal", badge: "Federal issue" },
    special_district: { layer: "Special District / Board", badge: "Special district issue" },
  };

  return {
    civicLayer,
    civicLayerLabel: labels[civicLayer].layer,
    issueBadge: labels[civicLayer].badge,
    jurisdictionName,
    governingBodyName,
    primaryLabel: jurisdictionName,
    secondaryLabel: governingBodyName,
  };
}
