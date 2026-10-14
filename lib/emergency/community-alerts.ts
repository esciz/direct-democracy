import { getCommunityById, getNevadaCommunityKind } from "@/lib/community/communities";

export type CommunityEmergencyNotice = {
  id: string;
  kind: "alert" | "declaration";
  title: string;
  summary: string;
  instruction?: string | null;
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  urgency?: string | null;
  area: string;
  effectiveAt?: string | null;
  expiresAt?: string | null;
  sourceName: string;
  sourceUrl: string;
};

export type CommunityEmergencyState = {
  notices: CommunityEmergencyNotice[];
  checkedAt: string;
  coverageLabel: string;
};

type NwsAlertFeature = {
  id?: string;
  properties?: {
    id?: string;
    areaDesc?: string;
    severity?: CommunityEmergencyNotice["severity"];
    urgency?: string;
    event?: string;
    headline?: string;
    description?: string;
    instruction?: string | null;
    effective?: string;
    expires?: string;
    senderName?: string;
  };
};

type FemaDeclaration = {
  id?: string;
  disasterNumber?: number;
  declarationTitle?: string;
  declarationType?: string;
  declarationDate?: string;
  incidentBeginDate?: string;
  incidentEndDate?: string | null;
  designatedArea?: string;
  incidentType?: string;
  state?: string;
};

const COMMUNITY_COUNTY_ZONE: Record<string, string> = {
  "carson-city-county": "NVC510",
  "carson-city": "NVC510",
  "churchill-county": "NVC001",
  fallon: "NVC001",
  "clark-county": "NVC003",
  "las-vegas": "NVC003",
  henderson: "NVC003",
  "north-las-vegas": "NVC003",
  mesquite: "NVC003",
  "boulder-city": "NVC003",
  laughlin: "NVC003",
  "douglas-county": "NVC005",
  gardnerville: "NVC005",
  minden: "NVC005",
  "elko-county": "NVC007",
  elko: "NVC007",
  carlin: "NVC007",
  wells: "NVC007",
  "west-wendover": "NVC007",
  "esmeralda-county": "NVC009",
  "eureka-county": "NVC011",
  "humboldt-county": "NVC013",
  winnemucca: "NVC013",
  "lander-county": "NVC015",
  "battle-mountain": "NVC015",
  "lincoln-county": "NVC017",
  caliente: "NVC017",
  "lyon-county": "NVC019",
  fernley: "NVC019",
  yerington: "NVC019",
  "mineral-county": "NVC021",
  "nye-county": "NVC023",
  tonopah: "NVC023",
  pahrump: "NVC023",
  "pershing-county": "NVC027",
  lovelock: "NVC027",
  "storey-county": "NVC029",
  "washoe-county": "NVC031",
  reno: "NVC031",
  sparks: "NVC031",
  "incline-village": "NVC031",
  "white-pine-county": "NVC033",
  ely: "NVC033",
};

const COUNTY_NAME_BY_ZONE: Record<string, string> = {
  NVC510: "Carson City",
  NVC001: "Churchill",
  NVC003: "Clark",
  NVC005: "Douglas",
  NVC007: "Elko",
  NVC009: "Esmeralda",
  NVC011: "Eureka",
  NVC013: "Humboldt",
  NVC015: "Lander",
  NVC017: "Lincoln",
  NVC019: "Lyon",
  NVC021: "Mineral",
  NVC023: "Nye",
  NVC027: "Pershing",
  NVC029: "Storey",
  NVC031: "Washoe",
  NVC033: "White Pine",
};

const SEVERITY_ORDER: Record<CommunityEmergencyNotice["severity"], number> = {
  Extreme: 0,
  Severe: 1,
  Moderate: 2,
  Minor: 3,
  Unknown: 4,
};

function cleanOfficialText(value: string | null | undefined, fallback: string, limit = 360) {
  const clean = value?.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > limit ? `${clean.slice(0, limit).trimEnd()}…` : clean;
}

async function getNwsAlerts(communityId: string): Promise<CommunityEmergencyNotice[]> {
  const kind = getNevadaCommunityKind(communityId);
  const zone = COMMUNITY_COUNTY_ZONE[communityId];
  if (!zone && kind !== "state") return [];

  const query = kind === "state" ? "area=NV" : `zone=${zone}`;
  const response = await fetch(`https://api.weather.gov/alerts/active?${query}`, {
    headers: {
      Accept: "application/geo+json",
      "User-Agent": "DirectYourDemocracy/1.0 (community safety information)",
    },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { features?: NwsAlertFeature[] };

  return (payload.features ?? [])
    .map((feature): CommunityEmergencyNotice | null => {
      const alert = feature.properties;
      const sourceUrl = feature.id ?? alert?.id;
      if (!alert?.event || !sourceUrl) return null;
      return {
        id: sourceUrl,
        kind: "alert",
        title: alert.headline ?? alert.event,
        summary: cleanOfficialText(alert.description, "Open the official alert for current details."),
        instruction: alert.instruction ? cleanOfficialText(alert.instruction, "", 420) : null,
        severity: alert.severity ?? "Unknown",
        urgency: alert.urgency ?? null,
        area: alert.areaDesc ?? getCommunityById(communityId)?.name ?? "Affected area",
        effectiveAt: alert.effective ?? null,
        expiresAt: alert.expires ?? null,
        sourceName: alert.senderName ?? "National Weather Service",
        sourceUrl,
      };
    })
    .filter((notice): notice is CommunityEmergencyNotice => Boolean(notice))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, kind === "state" ? 5 : 3);
}

function declarationMatchesCommunity(declaration: FemaDeclaration, communityId: string) {
  const kind = getNevadaCommunityKind(communityId);
  if (kind === "state") return true;

  const countyName = COUNTY_NAME_BY_ZONE[COMMUNITY_COUNTY_ZONE[communityId]];
  const area = declaration.designatedArea?.toLowerCase() ?? "";
  return Boolean(countyName && area.includes(countyName.toLowerCase()));
}

async function getRecentFemaDeclarations(communityId: string): Promise<CommunityEmergencyNotice[]> {
  if (communityId === "united-states") return [];

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 120);
  const params = new URLSearchParams({
    "$filter": `state eq 'NV' and declarationDate ge '${cutoff.toISOString()}'`,
    "$orderby": "declarationDate desc",
    "$top": "50",
  });
  const response = await fetch(`https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 1200 },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return [];
  const payload = (await response.json()) as { DisasterDeclarationsSummaries?: FemaDeclaration[] };

  return (payload.DisasterDeclarationsSummaries ?? [])
    .filter((declaration) => declarationMatchesCommunity(declaration, communityId))
    .map((declaration): CommunityEmergencyNotice | null => {
      if (!declaration.disasterNumber || !declaration.declarationDate) return null;
      const title = declaration.declarationTitle ?? `${declaration.incidentType ?? "Emergency"} declaration`;
      return {
        id: `fema-${declaration.disasterNumber}-${declaration.designatedArea ?? "statewide"}`,
        kind: "declaration",
        title: `Federal declaration: ${title}`,
        summary: `${declaration.declarationType ?? "Federal disaster declaration"} affecting ${declaration.designatedArea ?? "Nevada"}. Open the official record to review available assistance and designated areas.`,
        severity: "Moderate",
        area: declaration.designatedArea ?? "Nevada",
        effectiveAt: declaration.declarationDate,
        expiresAt: declaration.incidentEndDate ?? null,
        sourceName: "Federal Emergency Management Agency",
        sourceUrl: `https://www.fema.gov/disaster/${declaration.disasterNumber}`,
      };
    })
    .filter((notice): notice is CommunityEmergencyNotice => Boolean(notice))
    .slice(0, 2);
}

export async function getCommunityEmergencyState(communityId: string): Promise<CommunityEmergencyState> {
  const checkedAt = new Date().toISOString();
  const [alerts, declarations] = await Promise.all([
    getNwsAlerts(communityId).catch(() => []),
    getRecentFemaDeclarations(communityId).catch(() => []),
  ]);

  return {
    notices: [...alerts, ...declarations],
    checkedAt,
    coverageLabel: COMMUNITY_COUNTY_ZONE[communityId]
      ? "Official weather alerts and recent federal declarations"
      : getNevadaCommunityKind(communityId) === "state"
        ? "Nevada-wide official alerts and recent federal declarations"
        : "Emergency coverage is not yet connected for this jurisdiction",
  };
}
