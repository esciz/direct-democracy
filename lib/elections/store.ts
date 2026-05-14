import { seedUsers } from "@/lib/auth/mock-users";
import { attachEndorsementsToCampaigns } from "@/lib/candidates/endorsements";
import { getBallotInitiativesForElection } from "@/lib/elections/initiatives";
import { mockOfficials, mockPosts } from "@/lib/mock-data";
import { getCandidatePromises } from "@/lib/officials/promises";
import { getFollowState, getUserSocialSummary } from "@/lib/social/follows";
import type {
  AdminManagedProfileSummary,
  CandidateCampaignSummary,
  CandidateProfileDetail,
  ElectionSummary,
  OfficialPositionSummary,
  OfficialProfileDetail,
  OfficialProfileSummary,
  PublicProfileSummary,
} from "@/types/domain";

const buildFundingBreakdown = (
  items: Array<{
    label:
      | "Individual / Small Donors"
      | "Large Individual Donors"
      | "PACs / Committees"
      | "Industry / Organization"
      | "Self-funded";
    percentage: number;
  }>,
) => items;

const buildIndustryFundingBreakdown = (items: Array<{ label: string; percentage: number }>) => items;

const seededPublicProfiles: PublicProfileSummary[] = [
  {
    id: "profile_elena_ramirez",
    claimedByUserId: "user_official_elena_ramirez",
    slug: "elena-ramirez",
    name: "Elena Ramirez",
    profileType: "incumbentCandidate",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    bio: "Elena Ramirez is the current mayor of Carson City and is running for another term on infrastructure, housing, and public budget clarity.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/elena-ramirez",
    websiteUrl: "https://campaign.example.com/elena-ramirez",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_david_park",
    claimedByUserId: "user_official_david_park",
    slug: "david-park",
    name: "David Park",
    profileType: "official",
    jurisdictionName: "Washoe County, Nevada",
    partyText: "Nonpartisan",
    bio: "David Park is a Washoe County commissioner focused on land use, emergency readiness, and transportation planning.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/david-park",
    websiteUrl: "https://campaign.example.com/david-park",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_sofia_bennett",
    claimedByUserId: "user_candidate_sofia_bennett",
    slug: "sofia-bennett",
    name: "Sofia Bennett",
    profileType: "candidate",
    jurisdictionName: "Nevada",
    partyText: "Democratic",
    bio: "Sofia Bennett is running for Nevada Governor on water resilience, housing delivery, school funding, and campaign transparency.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/sofia-bennett",
    websiteUrl: "https://campaign.example.com/sofia-bennett",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_owen_castillo",
    claimedByUserId: "user_candidate_owen_castillo",
    slug: "owen-castillo",
    name: "Owen Castillo",
    profileType: "candidate",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    bio: "Owen Castillo is running for Carson City School Board on classroom support, teacher retention, and transparent district budgeting.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/owen-castillo",
    websiteUrl: "https://campaign.example.com/owen-castillo",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_jasmine_kim",
    claimedByUserId: "user_candidate_jasmine_kim",
    slug: "jasmine-kim",
    name: "Jasmine Kim",
    profileType: "candidate",
    jurisdictionName: "University of Nevada, Reno",
    partyText: "Campus Independent",
    bio: "Jasmine Kim is running in the UNR student government community vote on affordability, student transit, and clearer budget summaries.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/jasmine-kim",
    websiteUrl: "https://campaign.example.com/jasmine-kim",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_noah_brooks",
    claimedByUserId: "user_candidate_noah_brooks",
    slug: "noah-brooks",
    name: "Noah Brooks",
    profileType: "candidate",
    jurisdictionName: "University of Nevada, Reno",
    partyText: "Campus Independent",
    bio: "Noah Brooks is running in the UNR student government community vote on club funding, housing pressure, and easier campus accountability.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/noah-brooks",
    websiteUrl: "https://campaign.example.com/noah-brooks",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_naomi_bishop",
    claimedByUserId: null,
    slug: "naomi-bishop",
    name: "Naomi Bishop",
    profileType: "official",
    jurisdictionName: "Nevada",
    partyText: "Democratic",
    bio: "Naomi Bishop is Nevada Treasurer and is publicly known for focusing on state fiscal stability and school capital planning.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/naomi-bishop",
    websiteUrl: "https://campaign.example.com/naomi-bishop",
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  },
  {
    id: "profile_priya_desai",
    claimedByUserId: null,
    slug: "priya-desai",
    name: "Priya Desai",
    profileType: "official",
    jurisdictionName: "Nevada",
    partyText: "Democratic",
    bio: "Priya Desai is Nevada Attorney General and is known publicly for consumer protection and public integrity work.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/priya-desai",
    websiteUrl: "https://campaign.example.com/priya-desai",
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  },
  {
    id: "profile_helen_cho",
    claimedByUserId: null,
    slug: "helen-cho",
    name: "Helen Cho",
    profileType: "official",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    bio: "Helen Cho is a Carson City school board trustee with a service record focused on staffing and classroom support.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/helen-cho",
    websiteUrl: "https://campaign.example.com/helen-cho",
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  },
  {
    id: "profile_aaron_hale",
    claimedByUserId: null,
    slug: "aaron-hale",
    name: "Aaron Hale",
    profileType: "official",
    jurisdictionName: "Washoe County, Nevada",
    partyText: "Nonpartisan",
    bio: "Aaron Hale is Washoe County sheriff and appears publicly on the platform as an unclaimed profile.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/aaron-hale",
    websiteUrl: "https://campaign.example.com/aaron-hale",
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  },
  {
    id: "profile_adrian_castillo",
    claimedByUserId: "user_official_adrian_castillo",
    slug: "adrian-castillo",
    name: "Adrian Castillo",
    profileType: "official",
    jurisdictionName: "Nevada's 3rd Congressional District",
    partyText: "Democratic",
    bio: "Adrian Castillo is a Democratic U.S. representative focused on housing affordability, prescription-drug costs, ethics reform, veterans services, and western energy transmission.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/adrian-castillo",
    websiteUrl: "https://campaign.example.com/adrian-castillo",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_daniel_rowe",
    claimedByUserId: null,
    slug: "daniel-rowe",
    name: "Daniel Rowe",
    profileType: "candidate",
    jurisdictionName: "Nevada",
    partyText: "Republican",
    bio: "Daniel Rowe is running for Nevada Governor on tax restraint, water infrastructure, and streamlined permitting.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/daniel-rowe",
    websiteUrl: "https://campaign.example.com/daniel-rowe",
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  },
  {
    id: "profile_kristin_sloan",
    claimedByUserId: null,
    slug: "kristin-sloan",
    name: "Kristin Sloan",
    profileType: "candidate",
    jurisdictionName: "Nevada",
    partyText: "Independent",
    bio: "Kristin Sloan is running statewide on campaign finance transparency, land stewardship, and education access.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/kristin-sloan",
    websiteUrl: "https://campaign.example.com/kristin-sloan",
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  },
  {
    id: "profile_renee_dalton",
    claimedByUserId: null,
    slug: "renee-dalton",
    name: "Renee Dalton",
    profileType: "candidate",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    bio: "Renee Dalton is running for Carson City Mayor on neighborhood services, housing balance, and public process transparency.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/renee-dalton",
    websiteUrl: "https://campaign.example.com/renee-dalton",
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  },
  {
    id: "profile_michelle_cortez",
    claimedByUserId: null,
    slug: "michelle-cortez",
    name: "Michelle Cortez",
    profileType: "candidate",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    bio: "Michelle Cortez is running for Carson City School Board on literacy support, safe facilities, and practical parent communication.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/michelle-cortez",
    websiteUrl: "https://campaign.example.com/michelle-cortez",
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  },
  {
    id: "profile_ava_marquette",
    claimedByUserId: "user_candidate_ava_marquette",
    slug: "ava-marquette",
    name: "Ava Marquette",
    profileType: "candidate",
    jurisdictionName: "United States",
    partyText: "Democratic",
    bio: "Ava Marquette is running for President on cost of living relief, healthcare affordability, housing delivery, and ethics reform.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/ava-marquette",
    websiteUrl: "https://campaign.example.com/ava-marquette",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_luke_holloway",
    claimedByUserId: "user_candidate_luke_holloway",
    slug: "luke-holloway",
    name: "Luke Holloway",
    profileType: "candidate",
    jurisdictionName: "United States",
    partyText: "Republican",
    bio: "Luke Holloway is running for President on energy reliability, tax restraint, public safety, and domestic manufacturing.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/luke-holloway",
    websiteUrl: "https://campaign.example.com/luke-holloway",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_nevada_public_signal",
    claimedByUserId: "user_media_nevada_public_signal",
    slug: "nevada-public-signal",
    name: "Nevada Public Signal",
    profileType: "media",
    jurisdictionName: "Nevada",
    bio: "Demo statewide newsroom profile used to surface structured news stories, issue coverage, and community-rated bias context.",
    profileImageUrl: null,
    websiteUrl: "https://news.example.com/nevada-public-signal",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_carson_civic_watch",
    claimedByUserId: "user_media_carson_civic_watch",
    slug: "carson-civic-watch",
    name: "Carson Civic Watch",
    profileType: "media",
    jurisdictionName: "Carson City, Nevada",
    bio: "Demo local outlet profile covering Carson City governance, schools, infrastructure, and neighborhood issues.",
    profileImageUrl: null,
    websiteUrl: "https://news.example.com/carson-civic-watch",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_ines_keller",
    claimedByUserId: null,
    slug: "ines-keller",
    name: "Ines Keller",
    profileType: "candidate",
    jurisdictionName: "United States",
    partyText: "Independent",
    bio: "Ines Keller is running for President on democratic reforms, antitrust policy, housing access, and open-government standards.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/ines-keller",
    websiteUrl: "https://campaign.example.com/ines-keller",
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
  },
  {
    id: "profile_maya_ortega",
    claimedByUserId: "user_candidate_maya_ortega",
    slug: "maya-ortega",
    name: "Maya Ortega",
    profileType: "candidate",
    jurisdictionName: "Nevada",
    partyText: "Democratic",
    bio: "Maya Ortega is running for U.S. Senate in Nevada on healthcare costs, clean-energy jobs, housing, and veteran services.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/maya-ortega",
    websiteUrl: "https://campaign.example.com/maya-ortega",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
  {
    id: "profile_cole_wyatt",
    claimedByUserId: "user_candidate_cole_wyatt",
    slug: "cole-wyatt",
    name: "Cole Wyatt",
    profileType: "candidate",
    jurisdictionName: "Nevada",
    partyText: "Republican",
    bio: "Cole Wyatt is running for U.S. Senate in Nevada on energy production, taxes, border technology, and public safety.",
    profileImageUrl: null,
    donationUrl: "https://donate.example.com/cole-wyatt",
    websiteUrl: "https://campaign.example.com/cole-wyatt",
    isClaimed: true,
    source: "user",
    claimStatus: "CLAIMED",
  },
];

const seededOfficialPositions: OfficialPositionSummary[] = [
  {
    id: "position_elena_current",
    publicProfileId: "profile_elena_ramirez",
    officeTitle: "Mayor",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    isCurrent: true,
    startedAt: "2023-01-09",
    endedAt: null,
  },
  {
    id: "position_david_current",
    publicProfileId: "profile_david_park",
    officeTitle: "County Commissioner",
    jurisdictionName: "Washoe County, Nevada",
    partyText: "Nonpartisan",
    isCurrent: true,
    startedAt: "2024-01-08",
    endedAt: null,
  },
  {
    id: "position_naomi_current",
    publicProfileId: "profile_naomi_bishop",
    officeTitle: "State Treasurer",
    jurisdictionName: "Nevada",
    partyText: "Democratic",
    isCurrent: true,
    startedAt: "2023-01-02",
    endedAt: null,
  },
  {
    id: "position_priya_current",
    publicProfileId: "profile_priya_desai",
    officeTitle: "Attorney General",
    jurisdictionName: "Nevada",
    partyText: "Democratic",
    isCurrent: true,
    startedAt: "2023-01-02",
    endedAt: null,
  },
  {
    id: "position_helen_current",
    publicProfileId: "profile_helen_cho",
    officeTitle: "School Board Trustee",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    isCurrent: true,
    startedAt: "2025-01-06",
    endedAt: null,
  },
  {
    id: "position_aaron_current",
    publicProfileId: "profile_aaron_hale",
    officeTitle: "Sheriff",
    jurisdictionName: "Washoe County, Nevada",
    partyText: "Nonpartisan",
    isCurrent: true,
    startedAt: "2023-01-02",
    endedAt: null,
  },
  {
    id: "position_adrian_current",
    publicProfileId: "profile_adrian_castillo",
    officeTitle: "U.S. Representative",
    jurisdictionName: "Nevada's 3rd Congressional District",
    partyText: "Democratic",
    isCurrent: true,
    startedAt: "2025-01-03",
    endedAt: null,
  },
];

const seededElections: Omit<ElectionSummary, "candidates">[] = [
  {
    id: "election_carson_mayor_2026",
    slug: "carson-city-mayor-2026",
    title: "Carson City Mayor Election",
    officeTitle: "Mayor",
    jurisdictionName: "Carson City, Nevada",
    communityId: "carson-city",
    ballotSummary: "Carson City voters will choose the mayor and weigh a downtown street safety bond question.",
    electionDate: "2026-11-03",
    registrationDeadline: "2026-10-06",
    mailBallotDeadline: "2026-10-27",
    earlyVotingStartsAt: "2026-10-17",
    earlyVotingEndsAt: "2026-10-30",
    pollsCloseAt: "2026-11-03T20:00:00-08:00",
    electionType: "GENERAL",
    electionStatus: "UPCOMING",
    ballotInitiatives: [],
  },
  {
    id: "election_nevada_governor_2026",
    slug: "nevada-governor-2026",
    title: "Nevada Governor Election",
    officeTitle: "Governor",
    jurisdictionName: "Nevada",
    communityId: "nevada",
    ballotSummary: "Nevadans will vote for governor, weigh a water resilience bond, and see several statewide constitutional questions.",
    electionDate: "2026-11-03",
    registrationDeadline: "2026-10-06",
    mailBallotDeadline: "2026-10-27",
    earlyVotingStartsAt: "2026-10-17",
    earlyVotingEndsAt: "2026-10-30",
    pollsCloseAt: "2026-11-03T20:00:00-08:00",
    electionType: "GENERAL",
    electionStatus: "UPCOMING",
    ballotInitiatives: [],
  },
  {
    id: "election_carson_school_board_2026",
    slug: "carson-city-school-board-2026",
    title: "Carson City School Board Election",
    officeTitle: "School Board Trustee",
    jurisdictionName: "Carson City, Nevada",
    communityId: "carson-city",
    ballotSummary: "The ballot includes school board seats, student support funding oversight, and a district facilities question.",
    electionDate: "2026-11-03",
    registrationDeadline: "2026-10-06",
    mailBallotDeadline: "2026-10-27",
    earlyVotingStartsAt: "2026-10-17",
    earlyVotingEndsAt: "2026-10-30",
    pollsCloseAt: "2026-11-03T20:00:00-08:00",
    electionType: "LOCAL",
    electionStatus: "UPCOMING",
    ballotInitiatives: [],
  },
  {
    id: "election_washoe_flood_district_2026",
    slug: "washoe-flood-water-district-2026",
    title: "Washoe Flood and Water Resilience District Election",
    officeTitle: "Special District Board",
    jurisdictionName: "Washoe County, Nevada",
    communityId: "washoe-county",
    ballotSummary: "Washoe County voters will choose district board seats and vote on a flood-control funding package.",
    electionDate: "2026-08-18",
    registrationDeadline: "2026-07-21",
    mailBallotDeadline: "2026-08-11",
    earlyVotingStartsAt: "2026-08-08",
    earlyVotingEndsAt: "2026-08-16",
    pollsCloseAt: "2026-08-18T19:00:00-08:00",
    electionType: "SPECIAL",
    electionStatus: "UPCOMING",
    ballotInitiatives: [],
  },
  {
    id: "election_us_president_2028",
    slug: "united-states-president-2028",
    title: "United States Presidential Election",
    officeTitle: "President",
    jurisdictionName: "United States",
    communityId: "united-states",
    ballotSummary: "Voters nationwide will choose the next president alongside federal, state, and local races on their ballot.",
    electionDate: "2028-11-07",
    registrationDeadline: "2028-10-10",
    mailBallotDeadline: "2028-10-31",
    earlyVotingStartsAt: "2028-10-21",
    earlyVotingEndsAt: "2028-11-03",
    pollsCloseAt: "2028-11-07T20:00:00-08:00",
    electionType: "GENERAL",
    electionStatus: "UPCOMING",
    ballotInitiatives: [],
  },
  {
    id: "election_nevada_senate_2028",
    slug: "nevada-senate-2028",
    title: "Nevada U.S. Senate Election",
    officeTitle: "U.S. Senator",
    jurisdictionName: "Nevada",
    communityId: "nevada",
    ballotSummary: "Nevada’s U.S. Senate race shares the ballot with federal and statewide questions tied to cost of living and public lands.",
    electionDate: "2028-11-07",
    registrationDeadline: "2028-10-10",
    mailBallotDeadline: "2028-10-31",
    earlyVotingStartsAt: "2028-10-21",
    earlyVotingEndsAt: "2028-11-03",
    pollsCloseAt: "2028-11-07T20:00:00-08:00",
    electionType: "GENERAL",
    electionStatus: "UPCOMING",
    ballotInitiatives: [],
  },
  {
    id: "election_unr_student_government_2026",
    slug: "unr-student-government-2026",
    title: "UNR Student Government Community Vote",
    officeTitle: "Student Body President",
    jurisdictionName: "University of Nevada, Reno",
    communityId: "unr-campus",
    ballotSummary: "UNR students are choosing a student body president and voting on student transit and club funding priorities.",
    electionDate: "2026-04-22",
    registrationDeadline: "2026-04-08",
    earlyVotingStartsAt: "2026-04-15",
    earlyVotingEndsAt: "2026-04-21",
    pollsCloseAt: "2026-04-22T18:00:00-08:00",
    electionType: "LOCAL",
    electionStatus: "ACTIVE",
    isCommunityVoteOnly: true,
    authorityLabel: "Community vote only · not official election results",
    ballotInitiatives: [],
  },
];

const seededCandidateCampaigns: CandidateCampaignSummary[] = [
  {
    id: "campaign_elena_2026",
    publicProfileId: "profile_elena_ramirez",
    electionId: "election_carson_mayor_2026",
    officeSought: "Mayor",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/elena-ramirez",
    websiteUrl: "https://campaign.example.com/elena-ramirez",
    isIncumbent: true,
    totalRaised: "$486K",
    topDonorCategories: ["Local business", "Construction", "Community donors"],
    pollingSummary: "Early polling shows Ramirez ahead but facing skepticism on growth management.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 34 },
      { label: "Large Individual Donors", percentage: 24 },
      { label: "PACs / Committees", percentage: 21 },
      { label: "Industry / Organization", percentage: 12 },
      { label: "Self-funded", percentage: 9 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Real Estate", percentage: 28 },
      { label: "Construction", percentage: 23 },
      { label: "Hospitality", percentage: 18 },
      { label: "Healthcare", percentage: 12 },
      { label: "Finance", percentage: 9 },
    ]),
    pollingComparisons: [
      {
        source: "Silver State Pulse",
        fieldDate: "2026-03-18",
        externalResult: "Ramirez 43% · Dalton 35%",
        platformSentiment: "Ramirez 48% favorable in local platform activity",
        differenceLabel: "Platform users are slightly warmer toward Ramirez than the external poll.",
      },
    ],
  },
  {
    id: "campaign_renee_2026",
    publicProfileId: "profile_renee_dalton",
    electionId: "election_carson_mayor_2026",
    officeSought: "Mayor",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/renee-dalton",
    websiteUrl: "https://campaign.example.com/renee-dalton",
    isIncumbent: false,
    totalRaised: "$224K",
    topDonorCategories: ["Neighborhood groups", "Small donors", "Retired residents"],
    pollingSummary: "Dalton is strongest among voters prioritizing development oversight.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 46 },
      { label: "Large Individual Donors", percentage: 14 },
      { label: "PACs / Committees", percentage: 9 },
      { label: "Industry / Organization", percentage: 7 },
      { label: "Self-funded", percentage: 24 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Neighborhood Housing", percentage: 24 },
      { label: "Education", percentage: 19 },
      { label: "Retiree Advocacy", percentage: 16 },
      { label: "Local Retail", percentage: 11 },
    ]),
    pollingComparisons: [
      {
        source: "Silver State Pulse",
        fieldDate: "2026-03-18",
        externalResult: "Dalton 35%",
        platformSentiment: "Dalton 39% favorable among users prioritizing growth oversight",
        differenceLabel: "Platform sentiment is slightly stronger than the external polling snapshot.",
      },
    ],
  },
  {
    id: "campaign_sofia_2026",
    publicProfileId: "profile_sofia_bennett",
    electionId: "election_nevada_governor_2026",
    officeSought: "Governor",
    jurisdictionName: "Nevada",
    partyText: "Democratic",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/sofia-bennett",
    websiteUrl: "https://campaign.example.com/sofia-bennett",
    isIncumbent: false,
    totalRaised: "$3.8M",
    topDonorCategories: ["Education", "Labor", "Small business"],
    pollingSummary: "Bennett leads in Carson City and runs even statewide in the current demo snapshot.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 31 },
      { label: "Large Individual Donors", percentage: 17 },
      { label: "PACs / Committees", percentage: 33 },
      { label: "Industry / Organization", percentage: 12 },
      { label: "Self-funded", percentage: 7 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Education", percentage: 26 },
      { label: "Healthcare", percentage: 21 },
      { label: "Labor", percentage: 18 },
      { label: "Clean Energy", percentage: 12 },
      { label: "Finance", percentage: 8 },
    ]),
    pollingComparisons: [
      {
        source: "Nevada Public Opinion Survey",
        fieldDate: "2026-03-14",
        externalResult: "Bennett 41% · Rowe 40% · Sloan 8%",
        platformSentiment: "Bennett leads on-platform among users focused on housing and school funding",
        differenceLabel: "Platform sentiment runs a bit more favorable to Bennett than the external poll.",
      },
    ],
  },
  {
    id: "campaign_daniel_2026",
    publicProfileId: "profile_daniel_rowe",
    electionId: "election_nevada_governor_2026",
    officeSought: "Governor",
    jurisdictionName: "Nevada",
    partyText: "Republican",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/daniel-rowe",
    websiteUrl: "https://campaign.example.com/daniel-rowe",
    isIncumbent: false,
    totalRaised: "$3.1M",
    topDonorCategories: ["Energy", "Agriculture", "Business PACs"],
    pollingSummary: "Rowe remains competitive statewide and leads on tax-focused issue framing.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 22 },
      { label: "Large Individual Donors", percentage: 19 },
      { label: "PACs / Committees", percentage: 38 },
      { label: "Industry / Organization", percentage: 13 },
      { label: "Self-funded", percentage: 8 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Energy", percentage: 27 },
      { label: "Agriculture", percentage: 21 },
      { label: "Real Estate", percentage: 16 },
      { label: "Transportation", percentage: 10 },
      { label: "Finance", percentage: 9 },
    ]),
    pollingComparisons: [
      {
        source: "Nevada Public Opinion Survey",
        fieldDate: "2026-03-14",
        externalResult: "Rowe 40%",
        platformSentiment: "Rowe performs best on-platform with users focused on taxes and permitting",
        differenceLabel: "Platform sentiment is narrower and more issue-specific than the external poll.",
      },
    ],
  },
  {
    id: "campaign_kristin_2026",
    publicProfileId: "profile_kristin_sloan",
    electionId: "election_nevada_governor_2026",
    officeSought: "Governor",
    jurisdictionName: "Nevada",
    partyText: "Independent",
    campaignStatus: "ANNOUNCED",
    donationUrl: "https://donate.example.com/kristin-sloan",
    websiteUrl: "https://campaign.example.com/kristin-sloan",
    isIncumbent: false,
    totalRaised: "$420K",
    topDonorCategories: ["Civic reform", "Environment", "Small donors"],
    pollingSummary: "Sloan is drawing interest from unaffiliated voters but remains well behind the major campaigns.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 39 },
      { label: "Large Individual Donors", percentage: 8 },
      { label: "PACs / Committees", percentage: 8 },
      { label: "Industry / Organization", percentage: 7 },
      { label: "Self-funded", percentage: 38 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Environment", percentage: 22 },
      { label: "Civic Reform", percentage: 18 },
      { label: "Technology", percentage: 11 },
      { label: "Education", percentage: 9 },
    ]),
    pollingComparisons: [
      {
        source: "Nevada Public Opinion Survey",
        fieldDate: "2026-03-14",
        externalResult: "Sloan 8%",
        platformSentiment: "Sloan has a stronger reform-minded niche on-platform than in external polling",
        differenceLabel: "Platform users show more interest than the external polling topline.",
      },
    ],
  },
  {
    id: "campaign_owen_2026",
    publicProfileId: "profile_owen_castillo",
    electionId: "election_carson_school_board_2026",
    officeSought: "School Board Trustee",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/owen-castillo",
    websiteUrl: "https://campaign.example.com/owen-castillo",
    isIncumbent: false,
    totalRaised: "$58K",
    topDonorCategories: ["Parents", "Educators", "Local donors"],
    pollingSummary: "Castillo is strongest among parents focused on teacher retention and classroom support.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 52 },
      { label: "Large Individual Donors", percentage: 9 },
      { label: "PACs / Committees", percentage: 6 },
      { label: "Industry / Organization", percentage: 8 },
      { label: "Self-funded", percentage: 25 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Education", percentage: 31 },
      { label: "Parent Networks", percentage: 24 },
      { label: "Healthcare", percentage: 10 },
      { label: "Local Service Businesses", percentage: 8 },
    ]),
    pollingComparisons: [
      {
        source: "Carson Education Pulse",
        fieldDate: "2026-03-19",
        externalResult: "Castillo 37% · Cortez 34%",
        platformSentiment: "Castillo leads among platform users focused on teacher support",
        differenceLabel: "Platform sentiment is slightly stronger than the external poll.",
      },
    ],
  },
  {
    id: "campaign_michelle_2026",
    publicProfileId: "profile_michelle_cortez",
    electionId: "election_carson_school_board_2026",
    officeSought: "School Board Trustee",
    jurisdictionName: "Carson City, Nevada",
    partyText: "Nonpartisan",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/michelle-cortez",
    websiteUrl: "https://campaign.example.com/michelle-cortez",
    isIncumbent: false,
    totalRaised: "$44K",
    topDonorCategories: ["Teachers", "Neighborhood groups", "Parents"],
    pollingSummary: "Cortez is polling well among voters most focused on literacy outcomes and school climate.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 48 },
      { label: "Large Individual Donors", percentage: 7 },
      { label: "PACs / Committees", percentage: 5 },
      { label: "Industry / Organization", percentage: 6 },
      { label: "Self-funded", percentage: 34 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Education", percentage: 29 },
      { label: "Neighborhood Groups", percentage: 20 },
      { label: "Public Sector", percentage: 11 },
      { label: "Healthcare", percentage: 8 },
    ]),
    pollingComparisons: [
      {
        source: "Carson Education Pulse",
        fieldDate: "2026-03-19",
        externalResult: "Cortez 34%",
        platformSentiment: "Cortez performs well on-platform with literacy-focused users",
        differenceLabel: "Platform sentiment is close to the external polling snapshot.",
      },
    ],
  },
  {
    id: "campaign_jasmine_unr_2026",
    publicProfileId: "profile_jasmine_kim",
    electionId: "election_unr_student_government_2026",
    officeSought: "Student Body President",
    jurisdictionName: "University of Nevada, Reno",
    partyText: "Campus Independent",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/jasmine-kim",
    websiteUrl: "https://campaign.example.com/jasmine-kim",
    isIncumbent: false,
    totalRaised: "$12K",
    topDonorCategories: ["Students", "Faculty supporters", "Small donors"],
    pollingSummary: "Strong on affordability and late-night transit in the current campus demo snapshot.",
  },
  {
    id: "campaign_noah_unr_2026",
    publicProfileId: "profile_noah_brooks",
    electionId: "election_unr_student_government_2026",
    officeSought: "Student Body President",
    jurisdictionName: "University of Nevada, Reno",
    partyText: "Campus Independent",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/noah-brooks",
    websiteUrl: "https://campaign.example.com/noah-brooks",
    isIncumbent: false,
    totalRaised: "$9K",
    topDonorCategories: ["Students", "Campus clubs", "Small donors"],
    pollingSummary: "Performing best with users focused on student org funding and campus accountability.",
  },
  {
    id: "campaign_ava_2028",
    publicProfileId: "profile_ava_marquette",
    electionId: "election_us_president_2028",
    officeSought: "President",
    jurisdictionName: "United States",
    partyText: "Democratic",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/ava-marquette",
    websiteUrl: "https://campaign.example.com/ava-marquette",
    isIncumbent: false,
    totalRaised: "$184.2M",
    topDonorCategories: ["Healthcare", "Education", "Small donors"],
    pollingSummary: "Marquette runs strongest with voters focused on healthcare affordability, housing costs, and ethics reform.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 36 },
      { label: "Large Individual Donors", percentage: 16 },
      { label: "PACs / Committees", percentage: 21 },
      { label: "Industry / Organization", percentage: 19 },
      { label: "Self-funded", percentage: 8 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Healthcare", percentage: 24 },
      { label: "Education", percentage: 19 },
      { label: "Technology", percentage: 17 },
      { label: "Labor", percentage: 13 },
      { label: "Finance", percentage: 9 },
    ]),
    pollingComparisons: [
      {
        source: "American Voter Monitor",
        fieldDate: "2026-03-22",
        externalResult: "Marquette 45% · Holloway 43% · Keller 6%",
        platformSentiment: "Marquette leads on-platform among users prioritizing healthcare, housing, and ethics reform",
        differenceLabel: "Platform sentiment is modestly more favorable to Marquette than the external national poll.",
      },
    ],
  },
  {
    id: "campaign_luke_2028",
    publicProfileId: "profile_luke_holloway",
    electionId: "election_us_president_2028",
    officeSought: "President",
    jurisdictionName: "United States",
    partyText: "Republican",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/luke-holloway",
    websiteUrl: "https://campaign.example.com/luke-holloway",
    isIncumbent: false,
    totalRaised: "$171.6M",
    topDonorCategories: ["Energy", "Manufacturing", "Large donors"],
    pollingSummary: "Holloway performs best with users focused on taxes, energy reliability, and public safety.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 24 },
      { label: "Large Individual Donors", percentage: 22 },
      { label: "PACs / Committees", percentage: 24 },
      { label: "Industry / Organization", percentage: 22 },
      { label: "Self-funded", percentage: 8 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Energy", percentage: 26 },
      { label: "Manufacturing", percentage: 18 },
      { label: "Real Estate", percentage: 15 },
      { label: "Agriculture", percentage: 11 },
      { label: "Finance", percentage: 10 },
    ]),
    pollingComparisons: [
      {
        source: "American Voter Monitor",
        fieldDate: "2026-03-22",
        externalResult: "Holloway 43%",
        platformSentiment: "Holloway performs strongly on-platform with tax and energy-focused users",
        differenceLabel: "Platform support is narrower and more issue-specific than the external national poll.",
      },
    ],
  },
  {
    id: "campaign_ines_2028",
    publicProfileId: "profile_ines_keller",
    electionId: "election_us_president_2028",
    officeSought: "President",
    jurisdictionName: "United States",
    partyText: "Independent",
    campaignStatus: "ANNOUNCED",
    donationUrl: "https://donate.example.com/ines-keller",
    websiteUrl: "https://campaign.example.com/ines-keller",
    isIncumbent: false,
    totalRaised: "$22.8M",
    topDonorCategories: ["Reform groups", "Small donors", "Independent voters"],
    pollingSummary: "Keller is strongest with reform-minded users but remains far behind the major-party campaigns.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 41 },
      { label: "Large Individual Donors", percentage: 8 },
      { label: "PACs / Committees", percentage: 6 },
      { label: "Industry / Organization", percentage: 11 },
      { label: "Self-funded", percentage: 34 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Civic Reform", percentage: 28 },
      { label: "Technology", percentage: 14 },
      { label: "Consumer Advocacy", percentage: 12 },
      { label: "Education", percentage: 9 },
    ]),
    pollingComparisons: [
      {
        source: "American Voter Monitor",
        fieldDate: "2026-03-22",
        externalResult: "Keller 6%",
        platformSentiment: "Keller has a small but engaged reform-minded niche on-platform",
        differenceLabel: "Platform sentiment is slightly stronger than the external national topline.",
      },
    ],
  },
  {
    id: "campaign_maya_2028",
    publicProfileId: "profile_maya_ortega",
    electionId: "election_nevada_senate_2028",
    officeSought: "U.S. Senator",
    jurisdictionName: "Nevada",
    partyText: "Democratic",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/maya-ortega",
    websiteUrl: "https://campaign.example.com/maya-ortega",
    isIncumbent: false,
    totalRaised: "$12.4M",
    topDonorCategories: ["Healthcare", "Labor", "Small donors"],
    pollingSummary: "Ortega leads among Nevada users focused on healthcare costs, housing, and public schools.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 33 },
      { label: "Large Individual Donors", percentage: 15 },
      { label: "PACs / Committees", percentage: 24 },
      { label: "Industry / Organization", percentage: 18 },
      { label: "Self-funded", percentage: 10 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Healthcare", percentage: 27 },
      { label: "Clean Energy", percentage: 18 },
      { label: "Education", percentage: 14 },
      { label: "Hospitality", percentage: 11 },
      { label: "Labor", percentage: 10 },
    ]),
    pollingComparisons: [
      {
        source: "Nevada State Pulse",
        fieldDate: "2026-03-20",
        externalResult: "Ortega 46% · Wyatt 44%",
        platformSentiment: "Ortega leads on-platform among users focused on healthcare and cost of living",
        differenceLabel: "Platform sentiment is modestly more favorable to Ortega than the external statewide poll.",
      },
    ],
  },
  {
    id: "campaign_cole_2028",
    publicProfileId: "profile_cole_wyatt",
    electionId: "election_nevada_senate_2028",
    officeSought: "U.S. Senator",
    jurisdictionName: "Nevada",
    partyText: "Republican",
    campaignStatus: "ACTIVE",
    donationUrl: "https://donate.example.com/cole-wyatt",
    websiteUrl: "https://campaign.example.com/cole-wyatt",
    isIncumbent: false,
    totalRaised: "$11.1M",
    topDonorCategories: ["Energy", "Public safety", "Business groups"],
    pollingSummary: "Wyatt is strongest with users focused on taxes, energy permitting, and public safety.",
    fundingBreakdown: buildFundingBreakdown([
      { label: "Individual / Small Donors", percentage: 22 },
      { label: "Large Individual Donors", percentage: 21 },
      { label: "PACs / Committees", percentage: 25 },
      { label: "Industry / Organization", percentage: 22 },
      { label: "Self-funded", percentage: 10 },
    ]),
    industryFundingBreakdown: buildIndustryFundingBreakdown([
      { label: "Energy", percentage: 29 },
      { label: "Construction", percentage: 15 },
      { label: "Public Safety Organizations", percentage: 14 },
      { label: "Mining", percentage: 12 },
      { label: "Finance", percentage: 8 },
    ]),
    pollingComparisons: [
      {
        source: "Nevada State Pulse",
        fieldDate: "2026-03-20",
        externalResult: "Wyatt 44%",
        platformSentiment: "Wyatt is strongest on-platform with users prioritizing taxes and energy production",
        differenceLabel: "Platform support is somewhat more issue-clustered than the external statewide poll.",
      },
    ],
  },
];

function isProfile(value: unknown): value is PublicProfileSummary {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).id === "string" &&
      typeof (value as Record<string, unknown>).name === "string" &&
      typeof (value as Record<string, unknown>).slug === "string",
  );
}

function isCampaign(value: unknown): value is CandidateCampaignSummary {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).id === "string" &&
      typeof (value as Record<string, unknown>).electionId === "string",
  );
}

function isOfficialPosition(value: unknown): value is OfficialPositionSummary {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).id === "string" &&
      typeof (value as Record<string, unknown>).publicProfileId === "string",
  );
}
export type ElectionsStoreContext = {
  storedProfiles?: PublicProfileSummary[];
  storedCampaigns?: CandidateCampaignSummary[];
  storedPositions?: OfficialPositionSummary[];
};

export function isStoredPublicProfile(value: unknown): value is PublicProfileSummary {
  return isProfile(value);
}

export function isStoredCandidateCampaign(value: unknown): value is CandidateCampaignSummary {
  return isCampaign(value);
}

export function isStoredOfficialPosition(value: unknown): value is OfficialPositionSummary {
  return isOfficialPosition(value);
}

export async function getAllPublicProfiles(storedProfiles: PublicProfileSummary[] = []): Promise<PublicProfileSummary[]> {
  return [...storedProfiles, ...seededPublicProfiles];
}

export async function getAllCandidateCampaigns(storedCampaigns: CandidateCampaignSummary[] = []): Promise<CandidateCampaignSummary[]> {
  return [...storedCampaigns, ...seededCandidateCampaigns].map((campaign) => ({
    ...campaign,
    electionTitle: seededElections.find((election) => election.id === campaign.electionId)?.title ?? campaign.electionTitle,
  }));
}

export async function getAllOfficialPositions(storedPositions: OfficialPositionSummary[] = []): Promise<OfficialPositionSummary[]> {
  return [...storedPositions, ...seededOfficialPositions];
}

export async function getElectionSummaries(viewerId?: string, context: ElectionsStoreContext = {}): Promise<ElectionSummary[]> {
  const profiles = await getAllPublicProfiles(context.storedProfiles);
  const campaigns = await getAllCandidateCampaigns(context.storedCampaigns);
  const elections = seededElections.map((election) => ({
    ...election,
    ballotInitiatives: getBallotInitiativesForElection(election.id),
    candidates: campaigns.filter((campaign) => {
      const profile = profiles.find((entry) => entry.id === campaign.publicProfileId);

      return (
        campaign.electionId === election.id &&
        Boolean(profile) &&
        (profile?.profileType === "candidate" || profile?.profileType === "incumbentCandidate")
      );
    }),
  }));

  return Promise.all(
    elections.map(async (election) => ({
      ...election,
      candidates: await attachEndorsementsToCampaigns(election.candidates, viewerId),
    })),
  ).then((items) => items.sort((a, b) => Date.parse(a.electionDate) - Date.parse(b.electionDate)));
}

export async function getElectionById(id: string, viewerId?: string, context: ElectionsStoreContext = {}): Promise<ElectionSummary | null> {
  return (await getElectionSummaries(viewerId, context)).find((election) => election.id === id) ?? null;
}

export async function getCandidateProfileById(id: string, context: ElectionsStoreContext = {}): Promise<CandidateProfileDetail | null> {
  const profiles = await getAllPublicProfiles(context.storedProfiles);
  const profile = profiles.find((entry) => entry.id === id);

  if (!profile || (profile.profileType !== "candidate" && profile.profileType !== "incumbentCandidate")) {
    return null;
  }

  const campaigns = (await getAllCandidateCampaigns(context.storedCampaigns)).filter((campaign) => campaign.publicProfileId === id);
  if (!campaigns.length) {
    return null;
  }
  const campaignsWithEndorsements = await attachEndorsementsToCampaigns(campaigns);
  const recentPosts = profile.claimedByUserId
    ? mockPosts.filter((post) => post.authorId === profile.claimedByUserId).slice(0, 3)
    : [];
  const campaignPromises = await getCandidatePromises(id);
  const baseFollowerCount = profile.claimedByUserId
    ? (seedUsers.find((user) => user.id === profile.claimedByUserId)?.followerCount ?? 0)
    : 0;
  const social = profile.claimedByUserId
    ? await getUserSocialSummary(profile.claimedByUserId, baseFollowerCount)
    : { followerCount: 0, followingCount: 0, trustedProgressByCommunity: [] };

  return {
    ...profile,
    campaigns: campaignsWithEndorsements,
    officialPositions: (await getAllOfficialPositions(context.storedPositions)).filter((position) => position.publicProfileId === id),
    recentPosts,
    campaignPromises,
    followerCount: social.followerCount,
    followingCount: social.followingCount,
    viewerIsFollowing: false,
    viewerCanFollow: false,
  };
}

export async function getCandidateProfiles(context: ElectionsStoreContext = {}) {
  return (await getAllPublicProfiles(context.storedProfiles)).filter(
    (profile) => profile.profileType === "candidate" || profile.profileType === "incumbentCandidate",
  );
}

export async function getOfficials(context: ElectionsStoreContext = {}): Promise<OfficialProfileSummary[]> {
  const profiles = await getAllPublicProfiles(context.storedProfiles);
  const positions = await getAllOfficialPositions(context.storedPositions);

  return profiles
    .filter((profile) => profile.profileType === "official" || profile.profileType === "incumbentCandidate")
    .map((profile) => {
      const seedOfficial = mockOfficials.find((official) => official.name === profile.name);
      const currentPosition = positions.find((position) => position.publicProfileId === profile.id && position.isCurrent);

      return {
        id: profile.id,
        claimedByUserId: profile.claimedByUserId,
        name: profile.name,
        officeTitle: currentPosition?.officeTitle ?? seedOfficial?.officeTitle ?? "Official",
        jurisdictionName: profile.jurisdictionName,
        party: profile.partyText ?? seedOfficial?.party ?? "Nonpartisan",
        bio: profile.bio,
        profileImageUrl: profile.profileImageUrl,
        platformSummary: seedOfficial?.platformSummary ?? profile.bio,
        donationUrl: profile.donationUrl ?? seedOfficial?.donationUrl,
        websiteUrl: profile.websiteUrl ?? seedOfficial?.websiteUrl,
        followerCount: seedOfficial?.followerCount ?? 0,
        followThroughScore: seedOfficial?.followThroughScore ?? null,
        truthScore: seedOfficial?.truthScore,
        fundingBreakdown:
          profile.id === "profile_elena_ramirez"
            ? buildFundingBreakdown([
                { label: "Individual / Small Donors", percentage: 34 },
                { label: "Large Individual Donors", percentage: 24 },
                { label: "PACs / Committees", percentage: 21 },
                { label: "Industry / Organization", percentage: 12 },
                { label: "Self-funded", percentage: 9 },
              ])
            : profile.id === "profile_david_park"
              ? buildFundingBreakdown([
                  { label: "Individual / Small Donors", percentage: 41 },
                  { label: "Large Individual Donors", percentage: 14 },
                  { label: "PACs / Committees", percentage: 12 },
                  { label: "Industry / Organization", percentage: 10 },
                  { label: "Self-funded", percentage: 23 },
                ])
              : profile.id === "profile_adrian_castillo"
                ? buildFundingBreakdown([
                    { label: "Individual / Small Donors", percentage: 29 },
                    { label: "Large Individual Donors", percentage: 21 },
                    { label: "PACs / Committees", percentage: 18 },
                    { label: "Industry / Organization", percentage: 24 },
                    { label: "Self-funded", percentage: 8 },
                  ])
              : undefined,
        industryFundingBreakdown:
          profile.id === "profile_elena_ramirez"
            ? buildIndustryFundingBreakdown([
                { label: "Real Estate", percentage: 28 },
                { label: "Construction", percentage: 23 },
                { label: "Hospitality", percentage: 18 },
                { label: "Healthcare", percentage: 12 },
              ])
            : profile.id === "profile_david_park"
              ? buildIndustryFundingBreakdown([
                  { label: "Transportation", percentage: 26 },
                  { label: "Real Estate", percentage: 19 },
                  { label: "Public Safety Organizations", percentage: 14 },
                  { label: "Small Business", percentage: 12 },
                ])
              : profile.id === "profile_adrian_castillo"
                ? buildIndustryFundingBreakdown([
                    { label: "Labor", percentage: 18 },
                    { label: "Healthcare", percentage: 16 },
                    { label: "Real Estate", percentage: 14 },
                    { label: "Clean Energy", percentage: 12 },
                    { label: "Defense / Aerospace", percentage: 10 },
                  ])
              : undefined,
        pollingComparisons:
          profile.id === "profile_elena_ramirez"
            ? [
                {
                  source: "Silver State Pulse",
                  fieldDate: "2026-03-18",
                  externalResult: "Ramirez 43% · Dalton 35%",
                  platformSentiment: "Platform sentiment around Ramirez is modestly more favorable",
                  differenceLabel: "Demo comparison only. Platform sentiment is slightly warmer than the external poll.",
                },
              ]
            : profile.id === "profile_adrian_castillo"
              ? [
                  {
                    source: "Southwest Congressional Monitor",
                    fieldDate: "2026-03-30",
                    externalResult: "Castillo 49% approve · 41% disapprove",
                    platformSentiment: "Platform sentiment is more favorable on healthcare and ethics votes, but weaker after the housing-voucher budget compromise.",
                    differenceLabel: "Demo comparison only. Platform sentiment is stronger on ethics and drug-price votes than the external district poll.",
                  },
                ]
            : undefined,
        isClaimed: profile.isClaimed,
      };
    })
    .sort((a, b) => b.followerCount - a.followerCount);
}

export async function getOfficialById(id: string, context: ElectionsStoreContext = {}): Promise<OfficialProfileDetail | null> {
  const officials = await getOfficials(context);
  const official = officials.find((entry) => entry.id === id);

  if (!official) {
    return null;
  }

  const recentPosts = official.claimedByUserId
    ? mockPosts.filter((post) => post.authorId === official.claimedByUserId).slice(0, 3)
    : [];
  const social = official.claimedByUserId
    ? await getUserSocialSummary(official.claimedByUserId, official.followerCount)
    : { followerCount: official.followerCount, followingCount: 0, trustedProgressByCommunity: [] };

  return {
    ...official,
    recentPosts,
    campaignPromises: [],
    officialActions: [],
    linkedUserId: official.claimedByUserId,
    followerCount: social.followerCount,
    followingCount: social.followingCount,
    viewerIsFollowing: false,
    viewerCanFollow: false,
  };
}

export async function getAdminManagedProfiles(context: ElectionsStoreContext = {}): Promise<AdminManagedProfileSummary[]> {
  const profiles = await getAllPublicProfiles(context.storedProfiles);
  const campaigns = await getAllCandidateCampaigns(context.storedCampaigns);
  const positions = await getAllOfficialPositions(context.storedPositions);
  const elections = await getElectionSummaries(undefined, context);

  return profiles.map((profile) => ({
    ...profile,
    officeTitle: positions.find((position) => position.publicProfileId === profile.id && position.isCurrent)?.officeTitle ?? null,
    electionTitle: elections.find((election) =>
      campaigns.some((campaign) => campaign.publicProfileId === profile.id && campaign.electionId === election.id),
    )?.title ?? null,
  }));
}
