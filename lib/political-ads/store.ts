import fs from "node:fs";
import path from "node:path";

import type {
  AdClaim,
  PoliticalAd,
  PoliticalAdEntityRelation,
  PoliticalAdFilters,
  PoliticalAdRelationType,
  PoliticalAdSourceType,
  PoliticalAdSponsorType,
  PoliticalAdTruthRating,
} from "@/types/domain";

const GENERATED_POLITICAL_ADS_PATH = path.join(process.cwd(), "data/generated/nevada-political-ads.json");

type GeneratedPoliticalAdsFile = {
  generatedAt?: string;
  ads?: PoliticalAd[];
};

export const POLITICAL_AD_SOURCE_LABELS: Record<PoliticalAdSourceType, string> = {
  print: "Print",
  mailer: "Mailer",
  podcastAd: "Podcast ad",
  internetAd: "Internet ad",
  socialMediaAd: "Social media ad",
  searchAd: "Search ad",
  displayAd: "Display ad",
  streamingAd: "Streaming ad",
  cableAd: "Cable ad",
  broadcastTvAd: "Broadcast TV ad",
  radioAd: "Radio ad",
  connectedTvAd: "Connected TV ad",
  textSmsAd: "Text/SMS ad",
  emailAd: "Email ad",
  billboardOutdoorAd: "Billboard / outdoor ad",
  eventHandout: "Event handout",
  otherUnknown: "Other / unknown",
};

export const POLITICAL_AD_SPONSOR_LABELS: Record<PoliticalAdSponsorType, string> = {
  candidateCampaign: "Candidate campaign",
  officeholderCommittee: "Elected official / officeholder committee",
  oppositionCandidate: "Opposition candidate",
  politicalParty: "Political party",
  pac: "PAC",
  superPac: "Super PAC",
  union: "Union",
  nonprofitAdvocacyGroup: "Nonprofit / advocacy group",
  corporationTradeAssociation: "Corporation / trade association",
  ballotMeasureCommittee: "Ballot measure committee",
  independentExpenditureGroup: "Independent expenditure group",
  unknownUndisclosed: "Unknown / undisclosed",
  other: "Other",
};

export const POLITICAL_AD_RELATION_LABELS: Record<PoliticalAdRelationType, string> = {
  supports: "Supports",
  opposes: "Opposes",
  mentions: "Mentions",
  related: "Related to",
};

function isPoliticalAd(value: unknown): value is PoliticalAd {
  if (!value || typeof value !== "object") {
    return false;
  }

  const ad = value as Partial<PoliticalAd>;
  return (
    typeof ad.id === "string" &&
    typeof ad.title === "string" &&
    typeof ad.description === "string" &&
    typeof ad.sourceType === "string" &&
    typeof ad.sponsorName === "string" &&
    typeof ad.sponsorType === "string" &&
    typeof ad.paidForBy === "string" &&
    typeof ad.currency === "string" &&
    typeof ad.firstSeenAt === "string" &&
    typeof ad.electionCycle === "string" &&
    typeof ad.geographySummary === "string" &&
    typeof ad.overallSystemRating === "string" &&
    typeof ad.overallSystemConfidence === "string" &&
    typeof ad.status === "string" &&
    Array.isArray(ad.media) &&
    Array.isArray(ad.entityRelations) &&
    Array.isArray(ad.geographies) &&
    Array.isArray(ad.claims) &&
    Array.isArray(ad.citizenRatings) &&
    Array.isArray(ad.challenges)
  );
}

function readGeneratedPoliticalAds(): PoliticalAd[] {
  if (!fs.existsSync(GENERATED_POLITICAL_ADS_PATH)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(GENERATED_POLITICAL_ADS_PATH, "utf8")) as GeneratedPoliticalAdsFile | PoliticalAd[];
    const ads = Array.isArray(parsed) ? parsed : parsed.ads;
    return Array.isArray(ads) ? ads.filter(isPoliticalAd) : [];
  } catch (error) {
    console.error("Failed to read generated Nevada political ads.", error);
    return [];
  }
}

export function getGeneratedPoliticalAds() {
  return readGeneratedPoliticalAds();
}

export function getPoliticalAdRepositoryAds(options?: { includeSeededDemoAds?: boolean }) {
  const generatedAds = readGeneratedPoliticalAds();
  if (options?.includeSeededDemoAds) {
    const merged = new Map<string, PoliticalAd>();
    for (const ad of seededPoliticalAds) merged.set(ad.id, ad);
    for (const ad of generatedAds) merged.set(ad.id, ad);
    return [...merged.values()];
  }

  return generatedAds;
}

const RATING_SEVERITY: Record<PoliticalAdTruthRating, number> = {
  True: 0,
  "Mostly True": 1,
  "Needs Review": 2,
  "Not Checkable": 2,
  "Mostly False": 3,
  False: 4,
};

function nowIso(daysAgo: number) {
  const date = new Date("2026-05-01T12:00:00.000Z");
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function relation(
  politicalAdId: string,
  entityType: PoliticalAdEntityRelation["entityType"],
  entityId: string,
  entityLabel: string,
  relationType: PoliticalAdRelationType,
): PoliticalAdEntityRelation {
  return {
    id: `${politicalAdId}-${entityType}-${entityId}-${relationType}`,
    politicalAdId,
    entityType,
    entityId,
    entityLabel,
    relationType,
    createdAt: nowIso(30),
  };
}

function claim(
  politicalAdId: string,
  index: number,
  claimText: string,
  rating: PoliticalAdTruthRating,
  explanation: string,
  importance: AdClaim["importance"] = "medium",
  claimType: AdClaim["claimType"] = "factual",
): AdClaim {
  const id = `${politicalAdId}-claim-${index}`;
  return {
    id,
    politicalAdId,
    claimText,
    normalizedClaim: claimText.toLowerCase(),
    claimType,
    mediaTimestampStart: index === 1 ? "00:08" : null,
    mediaTimestampEnd: index === 1 ? "00:17" : null,
    mediaLocation: index === 1 ? "Opening frame" : "Body copy",
    importance,
    systemRating: rating,
    systemConfidence: rating === "Needs Review" ? "Low" : "Medium",
    systemExplanation: explanation,
    citizenRating: rating === "Needs Review" ? "Mostly False" : rating,
    citizenAgreementPercent: rating === "Needs Review" ? 61 : 78,
    citizenRatingCount: rating === "Needs Review" ? 9 : 18 + index,
    evidence: [
      {
        id: `${id}-evidence-1`,
        claimId: id,
        title: "Public filing and source archive review",
        url: "https://example.com/public-archive",
        sourceType: "Archive",
        publisher: "Direct Democracy demo archive",
        publishedAt: nowIso(22),
        excerpt: "Seeded demo evidence summarizes public filings, source archives, and contextual reporting.",
        supportsOrRefutes: rating === "True" || rating === "Mostly True" ? "supports" : rating === "Not Checkable" ? "contextualizes" : "refutes",
        createdAt: nowIso(20),
      },
    ],
    createdAt: nowIso(18),
    updatedAt: nowIso(12),
  };
}

export const seededPoliticalAds: PoliticalAd[] = [
  {
    id: "ad_sofia_water_resilience_streaming",
    title: "Sofia Bennett: Water Resilience Plan",
    description: "A streaming ad presenting Sofia Bennett's plan for water planning, conservation grants, and infrastructure coordination.",
    sourceType: "streamingAd",
    sponsorName: "Bennett for Nevada",
    sponsorType: "candidateCampaign",
    paidForBy: "Bennett for Nevada",
    producedBy: "Silver State Creative",
    authorizedBy: "Sofia Bennett campaign",
    authorizationText: "Paid for by Bennett for Nevada and authorized by Sofia Bennett.",
    totalSpend: 185000,
    currency: "USD",
    impressions: 840000,
    firstSeenAt: "2026-03-12",
    lastSeenAt: "2026-04-08",
    electionCycle: "2026",
    geographySummary: "Nevada statewide, with heavier delivery in Washoe and Clark counties",
    platformUrl: "https://example.com/streaming/ad-sofia-water",
    archiveUrl: "https://example.com/archive/ad-sofia-water",
    overallSystemRating: "Mostly True",
    overallSystemConfidence: "Medium",
    overallSystemExplanation: "Most claims match public budget and water planning records, but one timeline claim depends on pending agency coordination.",
    overallCitizenRating: "Mostly True",
    citizenAgreementPercent: 81,
    citizenRatingCount: 47,
    status: "published",
    media: [
      {
        id: "media-sofia-water-thumbnail",
        politicalAdId: "ad_sofia_water_resilience_streaming",
        mediaType: "thumbnail",
        altText: "Stylized blue-green ad frame for Sofia Bennett water resilience ad",
        sortOrder: 0,
        createdAt: nowIso(50),
      },
      {
        id: "media-sofia-water-transcript",
        politicalAdId: "ad_sofia_water_resilience_streaming",
        mediaType: "transcript",
        textContent: "Nevada needs a water plan that is honest about growth, conservation, and long-term resilience.",
        sortOrder: 1,
        createdAt: nowIso(50),
      },
    ],
    entityRelations: [
      relation("ad_sofia_water_resilience_streaming", "candidate", "profile_sofia_bennett", "Sofia Bennett", "supports"),
      relation("ad_sofia_water_resilience_streaming", "election", "election_nevada_governor_2026", "Nevada Governor Election", "related"),
      relation("ad_sofia_water_resilience_streaming", "issue", "water-resilience", "Water resilience", "supports"),
    ],
    geographies: [
      {
        id: "geo-sofia-water-nevada",
        politicalAdId: "ad_sofia_water_resilience_streaming",
        country: "United States",
        state: "Nevada",
        county: null,
        city: null,
        districtType: "statewide",
        districtName: "Nevada",
        precinct: null,
        createdAt: nowIso(50),
      },
    ],
    claims: [
      claim("ad_sofia_water_resilience_streaming", 1, "Nevada has not updated several regional drought response assumptions since before the latest growth forecasts.", "Mostly True", "Regional plans have been updated unevenly, and several assumptions predate the latest growth projections.", "high"),
      claim("ad_sofia_water_resilience_streaming", 2, "The Bennett plan would fund conservation grants without raising state sales tax.", "True", "The cited plan identifies bonding and federal match sources rather than sales tax changes.", "medium"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(52),
    updatedAt: nowIso(10),
  },
  {
    id: "ad_against_sofia_housing_mailer",
    title: "Too Fast on Housing",
    description: "A mailer arguing Sofia Bennett would approve housing projects before infrastructure is ready.",
    sourceType: "mailer",
    sponsorName: "Nevadans for Responsible Growth",
    sponsorType: "superPac",
    paidForBy: "Nevadans for Responsible Growth",
    producedBy: "Desert Print House",
    authorizedBy: null,
    authorizationText: "Not authorized by any candidate or candidate committee.",
    totalSpend: 425000,
    currency: "USD",
    impressions: 260000,
    firstSeenAt: "2026-04-01",
    lastSeenAt: "2026-04-28",
    electionCycle: "2026",
    geographySummary: "Nevada statewide mail households, concentrated in suburban ZIP codes",
    archiveUrl: "https://example.com/archive/ad-sofia-housing-mailer",
    overallSystemRating: "Mostly False",
    overallSystemConfidence: "High",
    overallSystemExplanation: "The ad cites real housing votes but overstates the candidate's authority and leaves out infrastructure conditions in the proposal.",
    overallCitizenRating: "Mostly False",
    citizenAgreementPercent: 74,
    citizenRatingCount: 63,
    status: "published",
    media: [
      {
        id: "media-sofia-housing-thumbnail",
        politicalAdId: "ad_against_sofia_housing_mailer",
        mediaType: "thumbnail",
        altText: "Mailer-style preview for housing attack ad",
        sortOrder: 0,
        createdAt: nowIso(34),
      },
      {
        id: "media-sofia-housing-ocr",
        politicalAdId: "ad_against_sofia_housing_mailer",
        mediaType: "ocrText",
        textContent: "Too fast. Too much traffic. Sofia Bennett's housing agenda puts neighborhoods last.",
        sortOrder: 1,
        createdAt: nowIso(34),
      },
    ],
    entityRelations: [
      relation("ad_against_sofia_housing_mailer", "candidate", "profile_sofia_bennett", "Sofia Bennett", "opposes"),
      relation("ad_against_sofia_housing_mailer", "issue", "affordable-housing", "Affordable Housing", "mentions"),
      relation("ad_against_sofia_housing_mailer", "election", "election_nevada_governor_2026", "Nevada Governor Election", "related"),
    ],
    geographies: [
      {
        id: "geo-sofia-housing-nevada",
        politicalAdId: "ad_against_sofia_housing_mailer",
        country: "United States",
        state: "Nevada",
        county: "Washoe County",
        city: null,
        districtType: "statewide",
        districtName: "Nevada",
        precinct: null,
        createdAt: nowIso(34),
      },
    ],
    claims: [
      claim("ad_against_sofia_housing_mailer", 1, "Sofia Bennett voted to approve unlimited high-density projects with no traffic review.", "False", "The referenced proposal included traffic review triggers and did not create unlimited approvals.", "high"),
      claim("ad_against_sofia_housing_mailer", 2, "Neighborhood infrastructure funding has not kept pace with projected growth.", "Mostly True", "Local capital plans show several infrastructure categories trailing projected demand.", "medium"),
      claim("ad_against_sofia_housing_mailer", 3, "The proposal would make every neighborhood less safe.", "Not Checkable", "This is a broad predictive slogan and is not specific enough for a factual rating.", "low", "opinion"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(35),
    updatedAt: nowIso(7),
  },
  {
    id: "ad_elena_budget_transparency_radio",
    title: "Mayor Ramirez: Open Budget Nights",
    description: "A radio ad from an officeholder committee highlighting public budget sessions and published spending dashboards.",
    sourceType: "radioAd",
    sponsorName: "Ramirez Accountability Committee",
    sponsorType: "officeholderCommittee",
    paidForBy: "Ramirez Accountability Committee",
    producedBy: "High Desert Audio",
    authorizedBy: "Elena Ramirez",
    authorizationText: "Paid for by Ramirez Accountability Committee.",
    totalSpend: 68000,
    currency: "USD",
    impressions: 190000,
    firstSeenAt: "2026-02-10",
    lastSeenAt: "2026-03-02",
    electionCycle: "2026",
    geographySummary: "Carson City radio market",
    overallSystemRating: "True",
    overallSystemConfidence: "High",
    overallSystemExplanation: "The public sessions and dashboard releases cited in the ad are supported by city records.",
    overallCitizenRating: "Mostly True",
    citizenAgreementPercent: 88,
    citizenRatingCount: 29,
    status: "published",
    media: [
      {
        id: "media-elena-budget-thumbnail",
        politicalAdId: "ad_elena_budget_transparency_radio",
        mediaType: "thumbnail",
        altText: "Radio waveform preview for budget transparency ad",
        sortOrder: 0,
        createdAt: nowIso(80),
      },
      {
        id: "media-elena-budget-audio",
        politicalAdId: "ad_elena_budget_transparency_radio",
        mediaType: "audio",
        textContent: "Audio placeholder for demo repository.",
        duration: 30,
        sortOrder: 1,
        createdAt: nowIso(80),
      },
    ],
    entityRelations: [
      relation("ad_elena_budget_transparency_radio", "official", "profile_elena_ramirez", "Elena Ramirez", "supports"),
      relation("ad_elena_budget_transparency_radio", "issue", "campaign-finance-transparency", "Campaign Finance Transparency", "mentions"),
    ],
    geographies: [
      {
        id: "geo-elena-budget-carson",
        politicalAdId: "ad_elena_budget_transparency_radio",
        country: "United States",
        state: "Nevada",
        county: "Carson City",
        city: "Carson City",
        districtType: "city",
        districtName: "Carson City",
        precinct: null,
        createdAt: nowIso(80),
      },
    ],
    claims: [
      claim("ad_elena_budget_transparency_radio", 1, "Carson City published departmental spending dashboards this year.", "True", "The city records referenced by the demo data include a public dashboard release.", "high"),
      claim("ad_elena_budget_transparency_radio", 2, "Open budget nights were held in every ward.", "Mostly True", "The sessions were broadly distributed, though one ward used a joint session format.", "medium"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(81),
    updatedAt: nowIso(8),
  },
  {
    id: "ad_finance_measure_social_support",
    title: "Yes on Transparent Campaign Finance",
    description: "A social media ad supporting Nevada's campaign finance transparency ballot measure.",
    sourceType: "socialMediaAd",
    sponsorName: "Nevada Disclosure Coalition",
    sponsorType: "ballotMeasureCommittee",
    paidForBy: "Nevada Disclosure Coalition",
    producedBy: "Civic Pixel Studio",
    authorizationText: "Paid for by Nevada Disclosure Coalition.",
    totalSpend: 112000,
    currency: "USD",
    impressions: 1300000,
    firstSeenAt: "2026-03-20",
    lastSeenAt: "2026-04-25",
    electionCycle: "2026",
    geographySummary: "Nevada statewide digital audiences",
    platformUrl: "https://example.com/social/finance-transparency",
    archiveUrl: "https://example.com/archive/finance-transparency-support",
    overallSystemRating: "Mostly True",
    overallSystemConfidence: "Medium",
    overallSystemExplanation: "Disclosure timing and donor threshold claims match the measure text, but enforcement staffing is not fully specified.",
    overallCitizenRating: "Mostly True",
    citizenAgreementPercent: 79,
    citizenRatingCount: 54,
    status: "published",
    media: [
      {
        id: "media-finance-support-thumbnail",
        politicalAdId: "ad_finance_measure_social_support",
        mediaType: "thumbnail",
        altText: "Social media preview for campaign finance transparency measure",
        sortOrder: 0,
        createdAt: nowIso(45),
      },
    ],
    entityRelations: [
      relation("ad_finance_measure_social_support", "ballotMeasure", "initiative_nevada_finance_2026", "Campaign Finance Transparency Demo", "supports"),
      relation("ad_finance_measure_social_support", "issue", "campaign-finance-transparency", "Campaign Finance Transparency", "supports"),
      relation("ad_finance_measure_social_support", "election", "election_nevada_governor_2026", "Nevada Governor Election", "related"),
    ],
    geographies: [
      {
        id: "geo-finance-support-nevada",
        politicalAdId: "ad_finance_measure_social_support",
        country: "United States",
        state: "Nevada",
        districtType: "statewide",
        districtName: "Nevada",
        createdAt: nowIso(45),
      },
    ],
    claims: [
      claim("ad_finance_measure_social_support", 1, "The measure requires faster disclosure for large campaign donors.", "True", "The seeded measure language includes accelerated disclosure windows for large donations.", "high"),
      claim("ad_finance_measure_social_support", 2, "The measure ends dark money in Nevada politics.", "Mostly False", "The measure improves disclosure but does not end every form of indirect spending.", "high"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(46),
    updatedAt: nowIso(6),
  },
  {
    id: "ad_finance_measure_opposition_search",
    title: "No on Costly Disclosure Rules",
    description: "A search ad opposing the campaign finance ballot measure by emphasizing administrative costs.",
    sourceType: "searchAd",
    sponsorName: "Free Speech Nevada",
    sponsorType: "nonprofitAdvocacyGroup",
    paidForBy: "Free Speech Nevada",
    producedBy: "Search Civic Media",
    authorizationText: "Paid for by Free Speech Nevada.",
    totalSpend: 54000,
    currency: "USD",
    impressions: 420000,
    firstSeenAt: "2026-04-04",
    lastSeenAt: "2026-04-30",
    electionCycle: "2026",
    geographySummary: "Nevada statewide search traffic",
    platformUrl: "https://example.com/search/no-costly-disclosure",
    overallSystemRating: "Needs Review",
    overallSystemConfidence: "Low",
    overallSystemExplanation: "The ad cites plausible implementation costs, but the cited estimate is incomplete in the demo archive.",
    overallCitizenRating: "Mostly False",
    citizenAgreementPercent: 58,
    citizenRatingCount: 22,
    status: "published",
    media: [
      {
        id: "media-finance-oppose-thumbnail",
        politicalAdId: "ad_finance_measure_opposition_search",
        mediaType: "thumbnail",
        altText: "Search ad preview opposing campaign finance measure",
        sortOrder: 0,
        createdAt: nowIso(31),
      },
    ],
    entityRelations: [
      relation("ad_finance_measure_opposition_search", "ballotMeasure", "initiative_nevada_finance_2026", "Campaign Finance Transparency Demo", "opposes"),
      relation("ad_finance_measure_opposition_search", "issue", "campaign-finance-transparency", "Campaign Finance Transparency", "opposes"),
    ],
    geographies: [
      {
        id: "geo-finance-oppose-nevada",
        politicalAdId: "ad_finance_measure_opposition_search",
        country: "United States",
        state: "Nevada",
        districtType: "statewide",
        districtName: "Nevada",
        createdAt: nowIso(31),
      },
    ],
    claims: [
      claim("ad_finance_measure_opposition_search", 1, "The disclosure measure creates millions in new administrative costs.", "Needs Review", "The ad references a cost estimate, but the source in the demo archive does not provide enough detail.", "high"),
      claim("ad_finance_measure_opposition_search", 2, "Current law already discloses every major donor in real time.", "False", "Current reporting windows are not universally real-time.", "high"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(32),
    updatedAt: nowIso(5),
  },
  {
    id: "ad_carson_livestream_event_handout",
    title: "Open Meetings, Live Streams, Public Notes",
    description: "An event handout supporting a Carson City transparency initiative for live-streamed meetings and searchable notes.",
    sourceType: "eventHandout",
    sponsorName: "Carson Open Meetings Committee",
    sponsorType: "ballotMeasureCommittee",
    paidForBy: "Carson Open Meetings Committee",
    producedBy: "Volunteer design team",
    totalSpend: 12500,
    currency: "USD",
    impressions: 18000,
    firstSeenAt: "2026-02-28",
    lastSeenAt: "2026-03-18",
    electionCycle: "2026",
    geographySummary: "Carson City civic events and library meetings",
    overallSystemRating: "True",
    overallSystemConfidence: "High",
    overallSystemExplanation: "The ad accurately describes the seeded initiative's live-streaming and note-publication requirements.",
    overallCitizenRating: "True",
    citizenAgreementPercent: 92,
    citizenRatingCount: 31,
    status: "published",
    media: [
      {
        id: "media-carson-livestream-thumbnail",
        politicalAdId: "ad_carson_livestream_event_handout",
        mediaType: "thumbnail",
        altText: "Event handout preview supporting open meetings initiative",
        sortOrder: 0,
        createdAt: nowIso(63),
      },
      {
        id: "media-carson-livestream-ocr",
        politicalAdId: "ad_carson_livestream_event_handout",
        mediaType: "ocrText",
        textContent: "Open meetings should be easy to watch, search, and understand.",
        sortOrder: 1,
        createdAt: nowIso(63),
      },
    ],
    entityRelations: [
      relation("ad_carson_livestream_event_handout", "ballotMeasure", "initiative_carson_livestream_2026", "Carson City meeting livestream initiative", "supports"),
      relation("ad_carson_livestream_event_handout", "issue", "government-transparency", "Government transparency", "supports"),
    ],
    geographies: [
      {
        id: "geo-carson-livestream",
        politicalAdId: "ad_carson_livestream_event_handout",
        country: "United States",
        state: "Nevada",
        county: "Carson City",
        city: "Carson City",
        districtType: "city",
        districtName: "Carson City",
        createdAt: nowIso(63),
      },
    ],
    claims: [
      claim("ad_carson_livestream_event_handout", 1, "The initiative requires meeting livestreams and searchable public notes.", "True", "The seeded initiative language contains both requirements.", "high"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(64),
    updatedAt: nowIso(4),
  },
  {
    id: "ad_owen_school_board_email",
    title: "Classroom Support First",
    description: "An email ad from Owen Castillo's school board campaign focused on teacher retention and classroom supplies.",
    sourceType: "emailAd",
    sponsorName: "Owen Castillo for School Board",
    sponsorType: "candidateCampaign",
    paidForBy: "Owen Castillo for School Board",
    producedBy: "Campaign volunteer team",
    authorizedBy: "Owen Castillo",
    totalSpend: 8500,
    currency: "USD",
    impressions: 36000,
    firstSeenAt: "2026-03-03",
    lastSeenAt: "2026-03-26",
    electionCycle: "2026",
    geographySummary: "Carson City school district email list",
    overallSystemRating: "Mostly True",
    overallSystemConfidence: "Medium",
    overallSystemExplanation: "Teacher retention and supply-cost claims align with school budget context, though some comparisons use statewide figures.",
    overallCitizenRating: "Mostly True",
    citizenAgreementPercent: 76,
    citizenRatingCount: 16,
    status: "published",
    media: [
      {
        id: "media-owen-email-thumbnail",
        politicalAdId: "ad_owen_school_board_email",
        mediaType: "thumbnail",
        altText: "Email preview for Owen Castillo school board ad",
        sortOrder: 0,
        createdAt: nowIso(58),
      },
    ],
    entityRelations: [
      relation("ad_owen_school_board_email", "candidate", "profile_owen_castillo", "Owen Castillo", "supports"),
      relation("ad_owen_school_board_email", "election", "election_carson_school_board_2026", "Carson City School Board Election", "related"),
      relation("ad_owen_school_board_email", "issue", "education-funding", "Education funding", "supports"),
    ],
    geographies: [
      {
        id: "geo-owen-carson-school",
        politicalAdId: "ad_owen_school_board_email",
        country: "United States",
        state: "Nevada",
        county: "Carson City",
        city: "Carson City",
        districtType: "school district",
        districtName: "Carson City School District",
        createdAt: nowIso(58),
      },
    ],
    claims: [
      claim("ad_owen_school_board_email", 1, "Teacher retention is one of the district's largest budget pressures.", "Mostly True", "Budget notes and public meeting summaries identify retention as a recurring pressure.", "medium"),
      claim("ad_owen_school_board_email", 2, "A classroom supply stipend can be funded without cutting student programs.", "Needs Review", "The funding path depends on final budget allocations.", "medium", "prediction"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(59),
    updatedAt: nowIso(11),
  },
  {
    id: "ad_maya_healthcare_cable",
    title: "Maya Ortega: Rural Clinics",
    description: "A cable ad supporting Maya Ortega's Senate campaign and rural healthcare access plan.",
    sourceType: "cableAd",
    sponsorName: "Ortega for Senate",
    sponsorType: "candidateCampaign",
    paidForBy: "Ortega for Senate",
    producedBy: "Western States Media",
    authorizedBy: "Maya Ortega campaign",
    totalSpend: 310000,
    currency: "USD",
    impressions: 710000,
    firstSeenAt: "2026-04-06",
    lastSeenAt: "2026-04-29",
    electionCycle: "2028",
    geographySummary: "Nevada statewide cable markets",
    overallSystemRating: "Mostly True",
    overallSystemConfidence: "Medium",
    overallSystemExplanation: "The ad's clinic access statistics are directionally supported, but one wait-time comparison uses an older source.",
    overallCitizenRating: "Mostly True",
    citizenAgreementPercent: 73,
    citizenRatingCount: 38,
    status: "published",
    media: [
      {
        id: "media-maya-cable-thumbnail",
        politicalAdId: "ad_maya_healthcare_cable",
        mediaType: "thumbnail",
        altText: "Cable ad preview for Maya Ortega rural clinics ad",
        sortOrder: 0,
        createdAt: nowIso(27),
      },
    ],
    entityRelations: [
      relation("ad_maya_healthcare_cable", "candidate", "profile_maya_ortega", "Maya Ortega", "supports"),
      relation("ad_maya_healthcare_cable", "election", "election_nevada_senate_2028", "Nevada U.S. Senate Election", "related"),
      relation("ad_maya_healthcare_cable", "issue", "healthcare-access", "Healthcare access", "supports"),
    ],
    geographies: [
      {
        id: "geo-maya-healthcare",
        politicalAdId: "ad_maya_healthcare_cable",
        country: "United States",
        state: "Nevada",
        districtType: "statewide",
        districtName: "Nevada",
        createdAt: nowIso(27),
      },
    ],
    claims: [
      claim("ad_maya_healthcare_cable", 1, "Some rural Nevada counties have no full-service hospital.", "True", "Public health facility data supports the claim for several counties.", "high"),
      claim("ad_maya_healthcare_cable", 2, "Average specialist wait times doubled in the last year.", "Mostly False", "The cited comparison uses a multi-year baseline, not the last year alone.", "medium"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(28),
    updatedAt: nowIso(3),
  },
  {
    id: "ad_luke_energy_display",
    title: "Energy Reliability First",
    description: "A display ad supporting Luke Holloway and his energy reliability platform.",
    sourceType: "displayAd",
    sponsorName: "Holloway for America",
    sponsorType: "candidateCampaign",
    paidForBy: "Holloway for America",
    producedBy: "National Digital Desk",
    authorizedBy: "Luke Holloway campaign",
    totalSpend: 275000,
    currency: "USD",
    impressions: 2100000,
    firstSeenAt: "2026-03-18",
    lastSeenAt: "2026-04-20",
    electionCycle: "2028",
    geographySummary: "National display inventory with Nevada retargeting",
    overallSystemRating: "Needs Review",
    overallSystemConfidence: "Low",
    overallSystemExplanation: "The ad combines factual energy-price claims with policy predictions that cannot yet be checked.",
    overallCitizenRating: "Needs Review",
    citizenAgreementPercent: 66,
    citizenRatingCount: 41,
    status: "published",
    media: [
      {
        id: "media-luke-energy-thumbnail",
        politicalAdId: "ad_luke_energy_display",
        mediaType: "thumbnail",
        altText: "Display ad preview for energy reliability message",
        sortOrder: 0,
        createdAt: nowIso(47),
      },
    ],
    entityRelations: [
      relation("ad_luke_energy_display", "candidate", "profile_luke_holloway", "Luke Holloway", "supports"),
      relation("ad_luke_energy_display", "issue", "energy-reliability", "Energy reliability", "supports"),
    ],
    geographies: [
      {
        id: "geo-luke-national",
        politicalAdId: "ad_luke_energy_display",
        country: "United States",
        state: null,
        districtType: "national",
        districtName: "United States",
        createdAt: nowIso(47),
      },
    ],
    claims: [
      claim("ad_luke_energy_display", 1, "Grid reliability warnings have increased in several regions.", "Mostly True", "Reliability warnings have increased in some regions, but not uniformly nationwide.", "medium"),
      claim("ad_luke_energy_display", 2, "The plan will lower every household's energy bill in year one.", "Not Checkable", "The claim is a future policy prediction and depends on market conditions.", "high", "prediction"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(48),
    updatedAt: nowIso(9),
  },
  {
    id: "ad_affordable_housing_podcast",
    title: "Housing Permits Explained",
    description: "A podcast ad from a nonprofit explaining how permit timing connects to housing affordability.",
    sourceType: "podcastAd",
    sponsorName: "Nevada Housing Data Project",
    sponsorType: "nonprofitAdvocacyGroup",
    paidForBy: "Nevada Housing Data Project",
    producedBy: "Civic Audio Network",
    totalSpend: 22000,
    currency: "USD",
    impressions: 95000,
    firstSeenAt: "2026-01-16",
    lastSeenAt: "2026-02-14",
    electionCycle: "2026",
    geographySummary: "Reno, Carson City, and Las Vegas civic podcasts",
    overallSystemRating: "Mostly True",
    overallSystemConfidence: "Medium",
    overallSystemExplanation: "The permit timing claims are consistent with public reporting, while affordability impacts vary by market.",
    overallCitizenRating: "Mostly True",
    citizenAgreementPercent: 82,
    citizenRatingCount: 27,
    status: "archived",
    media: [
      {
        id: "media-housing-podcast-thumbnail",
        politicalAdId: "ad_affordable_housing_podcast",
        mediaType: "thumbnail",
        altText: "Podcast ad preview for housing permits explainer",
        sortOrder: 0,
        createdAt: nowIso(100),
      },
      {
        id: "media-housing-podcast-transcript",
        politicalAdId: "ad_affordable_housing_podcast",
        mediaType: "transcript",
        textContent: "Permit timing is only one part of affordability, but it shapes how quickly homes can actually reach families.",
        sortOrder: 1,
        createdAt: nowIso(100),
      },
    ],
    entityRelations: [
      relation("ad_affordable_housing_podcast", "issue", "affordable-housing", "Affordable Housing", "mentions"),
      relation("ad_affordable_housing_podcast", "official", "profile_elena_ramirez", "Elena Ramirez", "mentions"),
    ],
    geographies: [
      {
        id: "geo-housing-podcast",
        politicalAdId: "ad_affordable_housing_podcast",
        country: "United States",
        state: "Nevada",
        county: null,
        districtType: "regional",
        districtName: "Northern and Southern Nevada metros",
        createdAt: nowIso(100),
      },
    ],
    claims: [
      claim("ad_affordable_housing_podcast", 1, "Permit timing contributes to housing supply delays.", "Mostly True", "Public housing research generally supports the direction of the claim.", "medium"),
      claim("ad_affordable_housing_podcast", 2, "Permit reform alone will solve housing affordability.", "Mostly False", "Housing affordability depends on land, financing, wages, infrastructure, and supply, not permits alone.", "high"),
    ],
    citizenRatings: [],
    challenges: [],
    createdAt: nowIso(101),
    updatedAt: nowIso(15),
  },
  {
    id: "ad_unknown_sms_public_safety",
    title: "Public Safety Text Alert",
    description: "A text/SMS ad mentioning public safety funding and linking to an unknown outside landing page.",
    sourceType: "textSmsAd",
    sponsorName: "Undisclosed sender",
    sponsorType: "unknownUndisclosed",
    paidForBy: "Unknown",
    producedBy: null,
    authorizationText: "No authorization disclaimer found in the archived message.",
    totalSpend: null,
    currency: "USD",
    impressions: null,
    firstSeenAt: "2026-04-22",
    lastSeenAt: "2026-04-22",
    electionCycle: "2026",
    geographySummary: "Carson City phone numbers, exact targeting unknown",
    platformUrl: "https://example.com/sms/public-safety",
    overallSystemRating: "Needs Review",
    overallSystemConfidence: "Low",
    overallSystemExplanation: "The sender and targeting source are unclear, and the landing page changed after capture.",
    overallCitizenRating: "Needs Review",
    citizenAgreementPercent: 49,
    citizenRatingCount: 12,
    status: "pendingReview",
    media: [
      {
        id: "media-public-safety-sms-thumbnail",
        politicalAdId: "ad_unknown_sms_public_safety",
        mediaType: "thumbnail",
        altText: "SMS ad preview for public safety message",
        sortOrder: 0,
        createdAt: nowIso(12),
      },
    ],
    entityRelations: [
      relation("ad_unknown_sms_public_safety", "issue", "public-safety", "Public safety", "mentions"),
      relation("ad_unknown_sms_public_safety", "official", "profile_elena_ramirez", "Elena Ramirez", "mentions"),
    ],
    geographies: [
      {
        id: "geo-public-safety-sms",
        politicalAdId: "ad_unknown_sms_public_safety",
        country: "United States",
        state: "Nevada",
        county: "Carson City",
        city: "Carson City",
        districtType: "city",
        districtName: "Carson City",
        createdAt: nowIso(12),
      },
    ],
    claims: [
      claim("ad_unknown_sms_public_safety", 1, "Public safety funding was cut by half.", "Needs Review", "The ad does not identify the budget line or time period.", "high"),
    ],
    citizenRatings: [],
    challenges: [
      {
        id: "challenge-public-safety-sender",
        submittedByUserId: "user_trusted_citizen_marco_silva",
        targetType: "ad",
        targetId: "ad_unknown_sms_public_safety",
        reason: "sourceProblem",
        explanation: "The sender is not disclosed and the destination page changed after capture.",
        evidenceUrl: "https://example.com/archive/sms-capture",
        status: "underReview",
        createdAt: nowIso(8),
      },
    ],
    createdAt: nowIso(13),
    updatedAt: nowIso(2),
  },
];

export function formatPoliticalAdMoney(value: number | null | undefined, currency = "USD") {
  if (!value) {
    return "Spend not reported";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPoliticalAdDateRange(ad: PoliticalAd) {
  const start = new Date(ad.firstSeenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const end = ad.lastSeenAt ? new Date(ad.lastSeenAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Present";
  return `${start} - ${end}`;
}

export function getPrimaryAdRelation(ad: PoliticalAd) {
  return ad.entityRelations[0] ?? null;
}

export function getPoliticalAdById(adId: string) {
  const includeSeededDemoAds = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
  return getPoliticalAdRepositoryAds({ includeSeededDemoAds }).find((ad) => ad.id === adId) ?? null;
}

export function getPoliticalAdsForEntity(entityType: PoliticalAdEntityRelation["entityType"], entityId: string, limit = 4) {
  const includeSeededDemoAds = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
  return getPoliticalAdRepositoryAds({ includeSeededDemoAds })
    .filter((ad) => ad.entityRelations.some((relationItem) => relationItem.entityType === entityType && relationItem.entityId === entityId))
    .sort((left, right) => Date.parse(right.firstSeenAt) - Date.parse(left.firstSeenAt))
    .slice(0, limit);
}

export function getPoliticalAdsForIssue(issueId: string, issueLabel?: string, limit = 4) {
  const normalizedId = issueId.toLowerCase();
  const normalizedLabel = issueLabel?.toLowerCase() ?? "";
  const includeSeededDemoAds = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
  return getPoliticalAdRepositoryAds({ includeSeededDemoAds })
    .filter((ad) =>
      ad.entityRelations.some((relationItem) => {
        if (relationItem.entityType !== "issue") return false;
        const relationId = relationItem.entityId.toLowerCase();
        const relationLabel = relationItem.entityLabel.toLowerCase();
        return (
          relationId === normalizedId ||
          relationLabel === normalizedLabel ||
          relationId.includes(normalizedId) ||
          normalizedId.includes(relationId) ||
          (normalizedLabel ? relationLabel.includes(normalizedLabel) || normalizedLabel.includes(relationLabel) : false)
        );
      }),
    )
    .sort((left, right) => Date.parse(right.firstSeenAt) - Date.parse(left.firstSeenAt))
    .slice(0, limit);
}

function matchesText(ad: PoliticalAd, query: string) {
  if (!query) return true;
  const text = [
    ad.title,
    ad.description,
    ad.sponsorName,
    ad.paidForBy,
    ad.producedBy ?? "",
    ad.geographySummary,
    ad.electionCycle,
    ...ad.entityRelations.map((relationItem) => relationItem.entityLabel),
    ...ad.claims.map((claimItem) => claimItem.claimText),
  ]
    .join(" ")
    .toLowerCase();
  return text.includes(query.toLowerCase());
}

function matchesRelation(ad: PoliticalAd, filters: PoliticalAdFilters) {
  const relationFilters = [
    filters.candidateId ? ["candidate", filters.candidateId] : null,
    filters.officialId ? ["official", filters.officialId] : null,
    filters.issueId ? ["issue", filters.issueId] : null,
    filters.ballotMeasureId ? ["ballotMeasure", filters.ballotMeasureId] : null,
    filters.electionId ? ["election", filters.electionId] : null,
  ].filter((entry): entry is [PoliticalAdEntityRelation["entityType"], string] => Boolean(entry));

  if (!relationFilters.length) {
    return true;
  }

  return relationFilters.some(([entityType, entityId]) =>
    ad.entityRelations.some((relationItem) => relationItem.entityType === entityType && relationItem.entityId === entityId),
  );
}

export function getFilteredPoliticalAds(filters: PoliticalAdFilters = {}) {
  const includeSeededDemoAds = process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";
  const relationType = filters.relationType && filters.relationType !== "all" ? filters.relationType : null;
  const minSpend = typeof filters.minSpend === "number" ? filters.minSpend : null;
  const maxSpend = typeof filters.maxSpend === "number" ? filters.maxSpend : null;
  const dateFrom = filters.dateFrom ? Date.parse(filters.dateFrom) : null;
  const dateTo = filters.dateTo ? Date.parse(filters.dateTo) : null;

  const filtered = getPoliticalAdRepositoryAds({ includeSeededDemoAds }).filter((ad) => {
    if (!matchesText(ad, filters.q?.trim() ?? "")) return false;
    if (!matchesRelation(ad, filters)) return false;
    if (filters.sponsor && !ad.sponsorName.toLowerCase().includes(filters.sponsor.toLowerCase())) return false;
    if (filters.sponsorType && filters.sponsorType !== "all" && ad.sponsorType !== filters.sponsorType) return false;
    if (filters.sourceType && filters.sourceType !== "all" && ad.sourceType !== filters.sourceType) return false;
    if (relationType && !ad.entityRelations.some((relationItem) => relationItem.relationType === relationType)) return false;
    if (filters.systemRating && filters.systemRating !== "all" && ad.overallSystemRating !== filters.systemRating) return false;
    if (filters.citizenRating && filters.citizenRating !== "all" && ad.overallCitizenRating !== filters.citizenRating) return false;
    if (filters.geography && !ad.geographySummary.toLowerCase().includes(filters.geography.toLowerCase())) return false;
    if (minSpend !== null && (ad.totalSpend ?? 0) < minSpend) return false;
    if (maxSpend !== null && (ad.totalSpend ?? 0) > maxSpend) return false;
    if (dateFrom && Date.parse(ad.firstSeenAt) < dateFrom) return false;
    if (dateTo && Date.parse(ad.firstSeenAt) > dateTo) return false;
    return true;
  });

  return filtered.sort((left, right) => {
    switch (filters.sort) {
      case "mostExpensive":
        return (right.totalSpend ?? 0) - (left.totalSpend ?? 0);
      case "mostViewed":
        return (right.impressions ?? 0) - (left.impressions ?? 0);
      case "mostMisleading":
        return RATING_SEVERITY[right.overallSystemRating] - RATING_SEVERITY[left.overallSystemRating];
      case "mostDisputed":
        return right.challenges.length - left.challenges.length;
      case "highestCitizenParticipation":
        return (right.citizenRatingCount ?? 0) - (left.citizenRatingCount ?? 0);
      case "newest":
      default:
        return Date.parse(right.firstSeenAt) - Date.parse(left.firstSeenAt);
    }
  });
}

export function paginatePoliticalAds(ads: PoliticalAd[], page = 1, pageSize = 8) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    pageSize,
    total: ads.length,
    totalPages: Math.max(1, Math.ceil(ads.length / pageSize)),
    items: ads.slice(start, start + pageSize),
  };
}

export function getPoliticalAdRepositoryFilterLabel(filters: PoliticalAdFilters) {
  const relationFilter = filters.candidateId ?? filters.officialId ?? filters.issueId ?? filters.ballotMeasureId ?? filters.electionId;
  if (relationFilter) return "Filtered archive";
  if (filters.q) return `Search: ${filters.q}`;
  return "Full archive";
}
