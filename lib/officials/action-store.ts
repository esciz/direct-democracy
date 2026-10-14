import { cookies } from "next/headers";

import { getCommunityById } from "@/lib/community/communities";
import type {
  OfficialActionReactionSummary,
  OfficialActionReactionType,
  OfficialActionSummary,
} from "@/types/domain";

const OFFICIAL_ACTION_REACTIONS_COOKIE = "dd_official_action_reactions";

const seededOfficialActionsBase: Array<Omit<OfficialActionSummary, "supportCount" | "opposeCount" | "viewerReaction">> = [
  {
    id: "official_action_elena_budget_recap",
    officialProfileId: "profile_elena_ramirez",
    officialName: "Elena Ramirez",
    title: "Published a plain-language budget recap before the spring hearing cycle",
    summary:
      "Released a short public-facing budget memo breaking down proposed road maintenance, park staffing, and classroom-support tradeoffs ahead of Carson City's spring budget hearings.",
    actionType: "policyAnnouncement",
    actionDate: "2026-04-02T16:00:00.000Z",
    issueTags: ["budget transparency", "education", "infrastructure"],
    sourceType: "official",
    sourceLink: "https://city.example.com/budget/plain-language-recap",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports Elena Ramirez's public commitment to publish plain-language budget recaps before major hearings.",
    createdAt: "2026-04-02T16:15:00.000Z",
  },
  {
    id: "official_action_elena_budget",
    officialProfileId: "profile_elena_ramirez",
    officialName: "Elena Ramirez",
    title: "Published a joint budget proposal for classroom support and road maintenance",
    summary:
      "Released a Carson City budget proposal that pairs road maintenance funding with classroom-support and teacher-retention commitments ahead of public hearings.",
    actionType: "budgetProposal",
    actionDate: "2026-03-28T17:00:00.000Z",
    issueTags: ["budget transparency", "education", "infrastructure"],
    sourceType: "official",
    sourceLink: "https://city.example.com/budget/classroom-support",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports her public reliability record on budget transparency and funding tradeoffs she said she would make visible.",
    createdAt: "2026-03-28T17:15:00.000Z",
  },
  {
    id: "official_action_elena_housing_tracker",
    officialProfileId: "profile_elena_ramirez",
    officialName: "Elena Ramirez",
    title: "Directed staff to launch a housing-and-street impacts tracker",
    summary:
      "Ordered a public tracker showing which infill housing projects are moving first, what street or water-main work they depend on, and where sequencing delays remain unresolved.",
    actionType: "executiveAction",
    actionDate: "2026-03-27T15:30:00.000Z",
    issueTags: ["housing", "infrastructure", "government transparency"],
    sourceType: "official",
    sourceLink: "https://city.example.com/housing/infrastructure-tracker",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports her promise to pair housing approvals with visible infrastructure sequencing.",
    createdAt: "2026-03-27T15:45:00.000Z",
  },
  {
    id: "official_action_elena_meeting",
    officialProfileId: "profile_elena_ramirez",
    officialName: "Elena Ramirez",
    title: "Held a downtown housing and infrastructure town hall",
    summary:
      "Hosted a public meeting on housing approvals, parking, and water-main sequencing, with a published recap and follow-up materials for residents.",
    actionType: "meetingHeld",
    actionDate: "2026-03-26T18:30:00.000Z",
    issueTags: ["housing", "infrastructure", "public safety"],
    sourceType: "media",
    sourceLink: "https://news.example.com/carson-town-hall-recap",
    verificationStatus: "sourced",
    accountabilityAlignment: "mixed",
    accountabilityReason: "Shows public responsiveness around housing and infrastructure, but it is engagement rather than direct implementation.",
    createdAt: "2026-03-26T20:00:00.000Z",
  },
  {
    id: "official_action_elena_infill_package",
    officialProfileId: "profile_elena_ramirez",
    officialName: "Elena Ramirez",
    title: "Backed an infill approval package linked to phased utility work",
    summary:
      "Supported a downtown infill package that tied faster multifamily approvals to phased water-main and sidewalk work, but left some neighborhood traffic mitigations for a later vote.",
    actionType: "voteCast",
    actionDate: "2026-03-19T19:20:00.000Z",
    issueTags: ["housing", "infrastructure", "cost of living"],
    sourceType: "media",
    sourceLink: "https://news.example.com/carson-infill-phasing-vote",
    verificationStatus: "sourced",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Mostly supports her housing-and-infrastructure pledge by linking approvals to phased utility work, even if some mitigation steps remain incomplete.",
    createdAt: "2026-03-19T20:10:00.000Z",
  },
  {
    id: "official_action_elena_fast_track",
    officialProfileId: "profile_elena_ramirez",
    officialName: "Elena Ramirez",
    title: "Voted for a temporary fast-track review on three growth projects",
    summary:
      "Joined a majority to approve a temporary fast-track review path for three large growth proposals before the full corridor traffic study was posted, drawing criticism from residents who expected that study first.",
    actionType: "voteCast",
    actionDate: "2026-03-11T18:40:00.000Z",
    issueTags: ["housing", "traffic", "government transparency"],
    sourceType: "media",
    sourceLink: "https://news.example.com/carson-fast-track-growth-vote",
    verificationStatus: "sourced",
    accountabilityAlignment: "against",
    accountabilityReason: "Conflicts with her stated promise not to fast-track major growth decisions before updated traffic studies were public.",
    createdAt: "2026-03-11T20:00:00.000Z",
  },
  {
    id: "official_action_elena_traffic_study",
    officialProfileId: "profile_elena_ramirez",
    officialName: "Elena Ramirez",
    title: "Commissioned a corridor traffic and utility study after backlash",
    summary:
      "Approved funding for an outside corridor study and utility-capacity review after residents criticized the city for advancing growth decisions before updated traffic analysis was public.",
    actionType: "committeeAction",
    actionDate: "2026-03-05T17:10:00.000Z",
    issueTags: ["traffic", "infrastructure", "government transparency"],
    sourceType: "official",
    sourceLink: "https://city.example.com/studies/corridor-capacity-review",
    verificationStatus: "verified",
    accountabilityAlignment: "mixed",
    accountabilityReason: "Moves back toward her traffic-study commitment, but it came after the earlier fast-track vote instead of before it.",
    createdAt: "2026-03-05T17:40:00.000Z",
  },
  {
    id: "official_action_adrian_rx_relief",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Voted for the Prescription Cost Relief Act conference package",
    summary:
      "Backed a federal package expanding Medicare drug negotiation, capping more insulin copays, and speeding generic competition for high-cost chronic-care medications used heavily by seniors and veterans in Southern Nevada.",
    actionType: "voteCast",
    actionDate: "2026-04-11T16:10:00.000Z",
    issueTags: ["healthcare", "cost of living", "prescription drugs"],
    sourceType: "official",
    sourceLink: "https://congress.example.com/votes/prescription-cost-relief-act",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Directly supports Castillo's public promise to cut insulin and prescription-drug costs.",
    partyAlignment: "aligned",
    partyAlignmentReason: "Matched the core Democratic caucus position on drug-cost negotiation and insulin caps.",
    createdAt: "2026-04-11T16:22:00.000Z",
  },
  {
    id: "official_action_adrian_stock_trading_ban",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Co-sponsored the Ban Congressional Stock Trading Now Act",
    summary:
      "Joined a bipartisan ethics package banning individual stock trading by members of Congress, senior staff, and spouses while tightening disclosure timing and searchable public reporting.",
    actionType: "billCoSponsored",
    actionDate: "2026-04-09T18:00:00.000Z",
    issueTags: ["ethics reform", "democracy", "government transparency"],
    sourceType: "official",
    sourceLink: "https://congress.example.com/bills/ban-congress-stock-trading-now",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports his public commitment to a stock-trading ban and stronger disclosure rules.",
    partyAlignment: "aligned",
    partyAlignmentReason: "Tracked with the caucus ethics-reform position and leadership support for the bill.",
    createdAt: "2026-04-09T18:08:00.000Z",
  },
  {
    id: "official_action_adrian_housing_tax_credit",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Voted for a housing voucher and tax-credit expansion package",
    summary:
      "Supported a housing package expanding low-income housing tax credits, preserving housing vouchers in high-cost markets, and setting aside veteran-focused supportive housing funds.",
    actionType: "voteCast",
    actionDate: "2026-04-04T17:40:00.000Z",
    issueTags: ["housing", "taxes", "veterans services"],
    sourceType: "official",
    sourceLink: "https://congress.example.com/votes/housing-voucher-lihtc-package",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Strongly supports his housing-affordability and veteran-housing commitments.",
    partyAlignment: "aligned",
    partyAlignmentReason: "Matched the caucus housing and renter-protection position.",
    createdAt: "2026-04-04T17:52:00.000Z",
  },
  {
    id: "official_action_adrian_veteran_housing_amendment",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Broke with caucus leadership to shield veteran-housing vouchers from a budget cap",
    summary:
      "Joined a bipartisan amendment carving veteran housing vouchers out of a broader discretionary cap, arguing that Nevada veterans should not lose housing stability while the larger budget fight remained unresolved.",
    actionType: "voteCast",
    actionDate: "2026-03-31T20:10:00.000Z",
    issueTags: ["veterans services", "housing", "budget transparency"],
    sourceType: "media",
    sourceLink: "https://news.example.com/house-veteran-housing-cap-amendment",
    verificationStatus: "sourced",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports his explicit housing-and-veterans promise even though it complicated the broader budget strategy.",
    partyAlignment: "against",
    partyAlignmentReason: "Split from Democratic leadership, which opposed reopening the larger spending cap fight on this amendment.",
    createdAt: "2026-03-31T21:00:00.000Z",
  },
  {
    id: "official_action_adrian_grid_wildfire",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Voted for the Western Grid and Wildfire Transmission Accord",
    summary:
      "Backed a transmission-and-wildfire bill speeding western grid upgrades while preserving county notice requirements, tribal consultation, and mitigation rules for federal land corridors.",
    actionType: "voteCast",
    actionDate: "2026-03-28T16:05:00.000Z",
    issueTags: ["energy", "wildfire", "public lands"],
    sourceType: "official",
    sourceLink: "https://congress.example.com/votes/western-grid-wildfire-accord",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports his promise to speed transmission without bypassing public-land and community review.",
    partyAlignment: "aligned",
    partyAlignmentReason: "Matched the caucus clean-energy and wildfire-resilience position.",
    createdAt: "2026-03-28T16:18:00.000Z",
  },
  {
    id: "official_action_adrian_budget_backfill",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Voted for a year-end funding package that delayed full housing-voucher backfill",
    summary:
      "Supported a year-end spending package that kept the government open and protected clinic funding, but delayed a full backfill for several local housing voucher accounts until the next supplemental package.",
    actionType: "voteCast",
    actionDate: "2026-03-24T19:30:00.000Z",
    issueTags: ["budget transparency", "housing", "healthcare"],
    sourceType: "official",
    sourceLink: "https://congress.example.com/votes/year-end-funding-package",
    verificationStatus: "verified",
    accountabilityAlignment: "against",
    accountabilityReason: "Undercut his housing-stability promise by accepting a package that delayed full voucher backfill.",
    partyAlignment: "aligned",
    partyAlignmentReason: "Tracked with the caucus leadership position to pass the compromise funding package.",
    createdAt: "2026-03-24T19:42:00.000Z",
  },
  {
    id: "official_action_adrian_border_data",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Backed a narrower border technology package after privacy guardrails were added",
    summary:
      "Voted for a narrower border technology reauthorization once warrant requirements, audit language, and detention-data transparency were added, despite criticism from both civil-liberties and hardline border factions.",
    actionType: "voteCast",
    actionDate: "2026-03-20T17:05:00.000Z",
    issueTags: ["immigration", "civil liberties", "government transparency"],
    sourceType: "media",
    sourceLink: "https://news.example.com/border-technology-privacy-vote",
    verificationStatus: "sourced",
    accountabilityAlignment: "mixed",
    accountabilityReason: "Balanced district security concerns against civil-liberties commitments, making this a mixed accountability signal.",
    partyAlignment: "against",
    partyAlignmentReason: "Split from much of the Democratic caucus, which still opposed the amended package.",
    createdAt: "2026-03-20T18:10:00.000Z",
  },
  {
    id: "official_action_adrian_rural_clinics",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Voted for the Home Care and Rural Clinics Workforce Act",
    summary:
      "Supported a bipartisan bill expanding residency slots, community-clinic staffing grants, and home-care workforce support in shortage areas used by rural Nevada families and veterans.",
    actionType: "voteCast",
    actionDate: "2026-03-17T16:25:00.000Z",
    issueTags: ["healthcare", "education", "veterans services"],
    sourceType: "official",
    sourceLink: "https://congress.example.com/votes/home-care-rural-clinics-workforce-act",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports his healthcare affordability pledge by expanding service capacity where provider shortages drive costs up.",
    partyAlignment: "aligned",
    partyAlignmentReason: "Matched the caucus position on workforce and community-clinic expansion.",
    createdAt: "2026-03-17T16:40:00.000Z",
  },
  {
    id: "official_action_adrian_tax_credit_rider",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Opposed a fast-track data-center tax credit rider",
    summary:
      "Voted against a late-added corporate tax-credit rider for large data-center construction, arguing it did too little for household affordability and left water and power impacts too underexplained for fast-growing Nevada communities.",
    actionType: "voteCast",
    actionDate: "2026-03-14T18:50:00.000Z",
    issueTags: ["taxes", "energy", "housing"],
    sourceType: "official",
    sourceLink: "https://congress.example.com/votes/data-center-tax-credit-rider",
    verificationStatus: "verified",
    accountabilityAlignment: "mixed",
    accountabilityReason: "Fits his affordability framing, but was not tied to one explicit campaign promise and mixed business-labor expectations.",
    partyAlignment: "against",
    partyAlignmentReason: "Broke with part of the caucus coalition that accepted the rider as part of a larger competitiveness package.",
    createdAt: "2026-03-14T19:04:00.000Z",
  },
  {
    id: "official_action_adrian_homefront_housing_bill",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Introduced the Homefront Housing and Service Stability Act",
    summary:
      "Filed legislation pairing veteran-housing case management with faster reuse of underused federal sites for workforce housing, while requiring public reporting on affordability outcomes district by district.",
    actionType: "billSponsored",
    actionDate: "2026-03-12T15:00:00.000Z",
    issueTags: ["housing", "veterans services", "government transparency"],
    sourceType: "official",
    sourceLink: "https://congress.example.com/bills/homefront-housing-service-stability-act",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Directly advances his promise to expand supply and protect veteran housing stability.",
    partyAlignment: "aligned",
    partyAlignmentReason: "Tracked with the caucus housing and veteran-services agenda.",
    createdAt: "2026-03-12T15:12:00.000Z",
  },
  {
    id: "official_action_adrian_va_wait_times",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Pressed VA and Pentagon officials on toxic-exposure clinic wait times",
    summary:
      "Used an oversight hearing to press federal officials on toxic-exposure clinic wait times, Nevada referral delays, and how rural veterans are supposed to navigate overlapping federal systems while housing and healthcare costs keep rising.",
    actionType: "committeeAction",
    actionDate: "2026-03-06T21:15:00.000Z",
    issueTags: ["veterans services", "healthcare", "government transparency"],
    sourceType: "official",
    sourceLink: "https://congress.example.com/hearings/toxic-exposure-clinic-waits",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports his public reliability record on veterans services and healthcare access.",
    partyAlignment: "mixed",
    partyAlignmentReason: "Oversight tone matched the caucus broadly, but the hearing exchange was more district-specific than a clean party-line action.",
    createdAt: "2026-03-06T21:40:00.000Z",
  },
  {
    id: "official_action_adrian_vote_explainer",
    officialProfileId: "profile_adrian_castillo",
    officialName: "Adrian Castillo",
    title: "Published a district explainer tying votes to promises on insulin, housing, and ethics",
    summary:
      "Released a plain-language explainer connecting recent House votes on prescription costs, housing, ethics, and veteran services back to the promises he made during the campaign and in district listening sessions.",
    actionType: "policyAnnouncement",
    actionDate: "2026-03-02T18:35:00.000Z",
    issueTags: ["government transparency", "healthcare", "housing"],
    sourceType: "official",
    sourceLink: "https://castillo.house.gov/vote-explainer-march",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports his pledge to make federal votes and tradeoffs understandable to constituents.",
    partyAlignment: "mixed",
    partyAlignmentReason: "This is a transparency action rather than a clean party-line position signal.",
    createdAt: "2026-03-02T18:48:00.000Z",
  },
  {
    id: "official_action_david_remote",
    officialProfileId: "profile_david_park",
    officialName: "David Park",
    title: "Backed a committee action to improve remote public meeting access",
    summary:
      "Supported a county committee action directing staff to improve agenda posting, archive recordings more reliably, and stabilize remote meeting access.",
    actionType: "committeeAction",
    actionDate: "2026-03-27T16:10:00.000Z",
    issueTags: ["government transparency", "public safety", "education"],
    sourceType: "media",
    sourceLink: "https://news.example.com/washoe-remote-access-committee",
    verificationStatus: "sourced",
    createdAt: "2026-03-27T18:20:00.000Z",
  },
  {
    id: "official_action_david_flood",
    officialProfileId: "profile_david_park",
    officialName: "David Park",
    title: "Announced a flood-control and road-capacity work session",
    summary:
      "Scheduled a public work session focused on traffic growth, drainage, and infrastructure timing in fast-growing Washoe neighborhoods.",
    actionType: "policyAnnouncement",
    actionDate: "2026-03-25T15:00:00.000Z",
    issueTags: ["infrastructure", "housing", "public safety"],
    sourceType: "official",
    sourceLink: "https://county.example.com/flood-control-work-session",
    verificationStatus: "verified",
    createdAt: "2026-03-25T15:20:00.000Z",
  },
  {
    id: "official_action_naomi_finance",
    officialProfileId: "profile_naomi_bishop",
    officialName: "Naomi Bishop",
    title: "Released a state school-capital finance update",
    summary:
      "Published a statewide update outlining school capital needs, debt capacity, and financing options for high-growth communities.",
    actionType: "publicStatement",
    actionDate: "2026-03-24T14:00:00.000Z",
    issueTags: ["education", "taxes", "government transparency"],
    sourceType: "official",
    sourceLink: "https://state.example.com/school-capital-update",
    verificationStatus: "verified",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports her fiscal-planning and transparent state-reporting platform.",
    partyAlignment: "aligned",
    partyAlignmentReason: "Matched the Democratic fiscal-transparency and school-capital planning stance.",
    createdAt: "2026-03-24T14:15:00.000Z",
  },
  {
    id: "official_action_priya_utility",
    officialProfileId: "profile_priya_desai",
    officialName: "Priya Desai",
    title: "Issued a public warning on utility-billing scams",
    summary:
      "Publicly warned Nevada residents about a wave of utility-billing scams targeting seniors and renters, and coordinated a hotline update with consumer-protection staff.",
    actionType: "executiveAction",
    actionDate: "2026-03-23T19:00:00.000Z",
    issueTags: ["public safety", "cost of living", "government transparency"],
    sourceType: "media",
    sourceLink: "https://news.example.com/nevada-utility-scam-warning",
    verificationStatus: "sourced",
    accountabilityAlignment: "aligned",
    accountabilityReason: "Supports her consumer-protection and public integrity platform commitments.",
    partyAlignment: "aligned",
    partyAlignmentReason: "Fits the Democratic consumer-protection and enforcement-accountability posture.",
    createdAt: "2026-03-23T19:20:00.000Z",
  },
  {
    id: "official_action_helen_staffing",
    officialProfileId: "profile_helen_cho",
    officialName: "Helen Cho",
    title: "Spoke in favor of publishing school staffing vacancy updates",
    summary:
      "At a school board meeting, advocated for monthly public staffing updates so families can see where shortages and substitute gaps are most acute.",
    actionType: "publicStatement",
    actionDate: "2026-03-22T18:40:00.000Z",
    issueTags: ["education", "government transparency"],
    sourceType: "citizen",
    sourceLink: null,
    verificationStatus: "unverified",
    createdAt: "2026-03-22T21:00:00.000Z",
  },
];

const seededOfficialActionReactions: OfficialActionReactionSummary[] = [
  {
    id: "official_action_reaction_elena_recap_1",
    actionId: "official_action_elena_budget_recap",
    userId: "user_citizen_alicia_hart",
    reaction: "support",
    createdAt: "2026-04-02T18:05:00.000Z",
  },
  {
    id: "official_action_reaction_elena_recap_2",
    actionId: "official_action_elena_budget_recap",
    userId: "user_trusted_citizen_marco_silva",
    reaction: "support",
    createdAt: "2026-04-02T18:16:00.000Z",
  },
  {
    id: "official_action_reaction_1",
    actionId: "official_action_elena_budget",
    userId: "user_citizen_alicia_hart",
    reaction: "support",
    createdAt: "2026-03-28T18:10:00.000Z",
  },
  {
    id: "official_action_reaction_2",
    actionId: "official_action_elena_budget",
    userId: "user_trusted_citizen_marco_silva",
    reaction: "support",
    createdAt: "2026-03-28T18:14:00.000Z",
  },
  {
    id: "official_action_reaction_3",
    actionId: "official_action_elena_meeting",
    userId: "user_candidate_owen_castillo",
    reaction: "support",
    createdAt: "2026-03-26T20:20:00.000Z",
  },
  {
    id: "official_action_reaction_elena_tracker_1",
    actionId: "official_action_elena_housing_tracker",
    userId: "user_trusted_citizen_marco_silva",
    reaction: "support",
    createdAt: "2026-03-27T18:12:00.000Z",
  },
  {
    id: "official_action_reaction_elena_infill_1",
    actionId: "official_action_elena_infill_package",
    userId: "user_candidate_owen_castillo",
    reaction: "support",
    createdAt: "2026-03-19T20:25:00.000Z",
  },
  {
    id: "official_action_reaction_elena_infill_2",
    actionId: "official_action_elena_infill_package",
    userId: "user_citizen_alicia_hart",
    reaction: "oppose",
    createdAt: "2026-03-19T20:41:00.000Z",
  },
  {
    id: "official_action_reaction_elena_fast_track_1",
    actionId: "official_action_elena_fast_track",
    userId: "user_citizen_alicia_hart",
    reaction: "oppose",
    createdAt: "2026-03-11T21:10:00.000Z",
  },
  {
    id: "official_action_reaction_elena_fast_track_2",
    actionId: "official_action_elena_fast_track",
    userId: "user_trusted_citizen_marco_silva",
    reaction: "oppose",
    createdAt: "2026-03-11T21:18:00.000Z",
  },
  {
    id: "official_action_reaction_elena_study_1",
    actionId: "official_action_elena_traffic_study",
    userId: "user_citizen_miles_reed",
    reaction: "support",
    createdAt: "2026-03-05T19:25:00.000Z",
  },
  {
    id: "official_action_reaction_adrian_rx_1",
    actionId: "official_action_adrian_rx_relief",
    userId: "user_trusted_citizen_nora_patel",
    reaction: "support",
    createdAt: "2026-04-11T17:02:00.000Z",
  },
  {
    id: "official_action_reaction_adrian_rx_2",
    actionId: "official_action_adrian_rx_relief",
    userId: "user_citizen_alicia_hart",
    reaction: "support",
    createdAt: "2026-04-11T17:15:00.000Z",
  },
  {
    id: "official_action_reaction_adrian_stock_1",
    actionId: "official_action_adrian_stock_trading_ban",
    userId: "user_trusted_citizen_marco_silva",
    reaction: "support",
    createdAt: "2026-04-09T18:30:00.000Z",
  },
  {
    id: "official_action_reaction_adrian_housing_1",
    actionId: "official_action_adrian_housing_tax_credit",
    userId: "user_citizen_miles_reed",
    reaction: "support",
    createdAt: "2026-04-04T18:16:00.000Z",
  },
  {
    id: "official_action_reaction_adrian_budget_1",
    actionId: "official_action_adrian_budget_backfill",
    userId: "user_trusted_citizen_hannah_cho",
    reaction: "oppose",
    createdAt: "2026-03-24T20:05:00.000Z",
  },
  {
    id: "official_action_reaction_adrian_border_1",
    actionId: "official_action_adrian_border_data",
    userId: "user_citizen_tiana_moore",
    reaction: "oppose",
    createdAt: "2026-03-20T19:02:00.000Z",
  },
  {
    id: "official_action_reaction_adrian_vets_1",
    actionId: "official_action_adrian_veteran_housing_amendment",
    userId: "user_candidate_maya_ortega",
    reaction: "support",
    createdAt: "2026-03-31T21:20:00.000Z",
  },
  {
    id: "official_action_reaction_adrian_tax_1",
    actionId: "official_action_adrian_tax_credit_rider",
    userId: "user_candidate_cole_wyatt",
    reaction: "oppose",
    createdAt: "2026-03-14T19:30:00.000Z",
  },
  {
    id: "official_action_reaction_adrian_homefront_1",
    actionId: "official_action_adrian_homefront_housing_bill",
    userId: "user_trusted_citizen_nora_patel",
    reaction: "support",
    createdAt: "2026-03-12T16:02:00.000Z",
  },
  {
    id: "official_action_reaction_4",
    actionId: "official_action_david_remote",
    userId: "user_citizen_miles_reed",
    reaction: "support",
    createdAt: "2026-03-27T18:35:00.000Z",
  },
  {
    id: "official_action_reaction_5",
    actionId: "official_action_david_remote",
    userId: "user_trusted_citizen_hannah_cho",
    reaction: "support",
    createdAt: "2026-03-27T18:40:00.000Z",
  },
  {
    id: "official_action_reaction_6",
    actionId: "official_action_david_flood",
    userId: "user_citizen_miles_reed",
    reaction: "oppose",
    createdAt: "2026-03-25T16:10:00.000Z",
  },
  {
    id: "official_action_reaction_7",
    actionId: "official_action_naomi_finance",
    userId: "user_citizen_tiana_moore",
    reaction: "support",
    createdAt: "2026-03-24T15:05:00.000Z",
  },
  {
    id: "official_action_reaction_8",
    actionId: "official_action_priya_utility",
    userId: "user_trusted_citizen_nora_patel",
    reaction: "support",
    createdAt: "2026-03-23T20:05:00.000Z",
  },
  {
    id: "official_action_reaction_9",
    actionId: "official_action_helen_staffing",
    userId: "user_citizen_alicia_hart",
    reaction: "support",
    createdAt: "2026-03-22T21:20:00.000Z",
  },
];

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function isOfficialActionReactionType(value: unknown): value is OfficialActionReactionType {
  return value === "support" || value === "oppose";
}

function isOfficialActionReactionSummary(value: unknown): value is OfficialActionReactionSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const reaction = value as Record<string, unknown>;
  return (
    typeof reaction.id === "string" &&
    typeof reaction.actionId === "string" &&
    typeof reaction.userId === "string" &&
    isOfficialActionReactionType(reaction.reaction) &&
    typeof reaction.createdAt === "string"
  );
}

export async function getStoredOfficialActionReactions() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(OFFICIAL_ACTION_REACTIONS_COOKIE)?.value;

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isOfficialActionReactionSummary) : [];
  } catch {
    return [];
  }
}

export async function setStoredOfficialActionReactions(entries: OfficialActionReactionSummary[]) {
  const cookieStore = await cookies();
  cookieStore.set(OFFICIAL_ACTION_REACTIONS_COOKIE, JSON.stringify(entries.slice(0, 400)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

async function getAllOfficialActionReactions() {
  const merged = new Map<string, OfficialActionReactionSummary>();

  for (const reaction of seededOfficialActionReactions) {
    merged.set(`${reaction.actionId}:${reaction.userId}`, reaction);
  }

  for (const reaction of await getStoredOfficialActionReactions()) {
    merged.set(`${reaction.actionId}:${reaction.userId}`, reaction);
  }

  return [...merged.values()];
}

function hydrateOfficialActions(viewerId?: string) {
  return (
    action: Omit<OfficialActionSummary, "supportCount" | "opposeCount" | "viewerReaction">,
    allReactions: OfficialActionReactionSummary[],
  ): OfficialActionSummary => {
    const reactions = allReactions.filter((entry) => entry.actionId === action.id);

    return {
      ...action,
      supportCount: reactions.filter((entry) => entry.reaction === "support").length,
      opposeCount: reactions.filter((entry) => entry.reaction === "oppose").length,
      viewerReaction: viewerId ? reactions.find((entry) => entry.userId === viewerId)?.reaction ?? null : null,
    };
  };
}

export async function getOfficialActionsByOfficialProfileId(officialProfileId: string, viewerId?: string) {
  const hydrate = hydrateOfficialActions(viewerId);
  const allReactions = await getAllOfficialActionReactions();
  const actions = seededOfficialActionsBase
    .filter((entry) => entry.officialProfileId === officialProfileId)
    .map((entry) => hydrate(entry, allReactions));

  return actions.sort((left, right) => Date.parse(right.actionDate) - Date.parse(left.actionDate));
}

export async function getOfficialActionCountByOfficialProfileId(officialProfileId: string) {
  return seededOfficialActionsBase.filter((entry) => entry.officialProfileId === officialProfileId).length;
}

export async function getOfficialActionsForIssue(issueText: string, jurisdictionName: string, viewerId?: string, limit = 4) {
  const hydrate = hydrateOfficialActions(viewerId);
  const issueTokens = new Set(tokenize(issueText));
  const allReactions = await getAllOfficialActionReactions();
  const actions = seededOfficialActionsBase
    .filter((entry) => entry.issueTags.some((tag) => tokenize(tag).some((token) => issueTokens.has(token))))
    .filter((entry) => {
      if (jurisdictionName === "United States") {
        return true;
      }

      return entry.summary.includes(jurisdictionName.split(",")[0]) || entry.officialProfileId === "profile_naomi_bishop" || entry.officialProfileId === "profile_priya_desai";
    })
    .slice(0, limit)
    .map((entry) => hydrate(entry, allReactions));

  return actions.sort((left, right) => Date.parse(right.actionDate) - Date.parse(left.actionDate));
}

export async function getOfficialActionsForCommunity(communityId: string, viewerId?: string, limit = 4) {
  const community = getCommunityById(communityId);
  const hydrate = hydrateOfficialActions(viewerId);
  const matches = community?.jurisdictionMatches ?? [];
  const allReactions = await getAllOfficialActionReactions();
  const actions = seededOfficialActionsBase
    .filter((entry) =>
      matches.some((match) => entry.summary.includes(match.split(",")[0])) ||
      (communityId === "nevada" && ["profile_naomi_bishop", "profile_priya_desai"].includes(entry.officialProfileId)) ||
      (communityId === "united-states" && entry.issueTags.some((tag) => ["taxes", "public safety", "housing", "healthcare"].includes(tag))),
    )
    .slice(0, limit)
    .map((entry) => hydrate(entry, allReactions));

  return actions.sort((left, right) => Date.parse(right.actionDate) - Date.parse(left.actionDate));
}
