const seedUsers = [
  ["citizen", "Alicia Hart"],
  ["citizen", "Miles Reed"],
  ["citizen", "Tiana Moore"],
  ["trustedCitizen", "Marco Silva"],
  ["trustedCitizen", "Hannah Cho"],
  ["candidate", "Sofia Bennett"],
  ["candidate", "Owen Castillo"],
  ["official", "Elena Ramirez"],
  ["official", "David Park"],
  ["admin", "Riley Morgan"],
];

const seedPetitions = [
  ["petition_carson_meeting_archives", "Require Carson City public meetings to be livestreamed and archived"],
  ["petition_teacher_funding", "Increase classroom and teacher retention funding in Carson City"],
  ["petition_finance_transparency", "Require clearer statewide campaign finance disclosures"],
  ["petition_meeting_accessibility", "Improve public meeting accessibility in Washoe County"],
  ["petition_north_valley_zoning", "Pause the North Valley rezoning until traffic and water impacts are published"],
];

const seedSignatures = [
  ["signature_meeting_archives_1", "petition_carson_meeting_archives"],
  ["signature_meeting_archives_2", "petition_carson_meeting_archives"],
  ["signature_meeting_archives_3", "petition_carson_meeting_archives"],
  ["signature_teacher_1", "petition_teacher_funding"],
  ["signature_teacher_2", "petition_teacher_funding"],
  ["signature_finance_1", "petition_finance_transparency"],
  ["signature_finance_2", "petition_finance_transparency"],
  ["signature_access_1", "petition_meeting_accessibility"],
  ["signature_access_2", "petition_meeting_accessibility"],
  ["signature_zoning_1", "petition_north_valley_zoning"],
  ["signature_zoning_2", "petition_north_valley_zoning"],
];

const seedOfficials = [
  ["profile_elena_ramirez", "claimed mayor"],
  ["profile_david_park", "claimed county commissioner"],
  ["profile_naomi_bishop", "unclaimed statewide official"],
  ["profile_priya_desai", "unclaimed statewide official"],
  ["profile_helen_cho", "unclaimed school board trustee"],
  ["profile_aaron_hale", "unclaimed sheriff"],
];

const seedCandidates = [
  ["profile_elena_ramirez", "claimed incumbent candidate"],
  ["profile_sofia_bennett", "claimed gubernatorial candidate"],
  ["profile_owen_castillo", "claimed school board candidate"],
  ["profile_daniel_rowe", "unclaimed gubernatorial candidate"],
  ["profile_kristin_sloan", "unclaimed gubernatorial candidate"],
  ["profile_renee_dalton", "unclaimed mayoral candidate"],
  ["profile_michelle_cortez", "unclaimed school board candidate"],
];

const seedElections = [
  ["election_carson_mayor_2026", "Carson City Mayor Election"],
  ["election_nevada_governor_2026", "Nevada Governor Election"],
  ["election_carson_school_board_2026", "Carson City School Board Election"],
];

const seedVoteQuestions = [
  ["vote_budget_summary_carson", "Should Carson City publish a plain-language budget summary before public hearings?"],
  ["vote_meeting_hours_nevada", "Would you use evening public meeting times more often if they were offered regularly?"],
  ["vote_finance_dashboard_nevada", "Should Nevada create a single public dashboard for campaign finance disclosures?"],
  ["vote_school_updates_carson", "Should Carson City schools publish monthly staffing and classroom vacancy updates?"],
  ["vote_hybrid_meetings_washoe", "Should Washoe County guarantee remote access and recordings for major public meetings?"],
  ["vote_growth_updates_carson", "Should Carson City post project updates for major housing and road work in one place?"],
  ["vote_water_planning_nevada", "Should Nevada publish simpler long-term water planning summaries for residents?"],
  ["vote_school_meeting_recaps_carson", "Would short school board recaps make Carson City education issues easier to follow?"],
  ["vote_washoe_road_dashboard", "Should Washoe County maintain a public dashboard for road and traffic projects?"],
  ["vote_neighborhood_identity_carson", "Do you feel Carson City is keeping its local identity as it grows?"],
  ["vote_public_space_washoe", "Would you use more public spaces in Washoe County if they had clearer event calendars?"],
  ["vote_state_belonging_nevada", "Do you feel represented by the statewide issues getting the most attention in Nevada?"],
  ["vote_meeting_notice_washoe", "Should Washoe County give more notice before major development hearings?"],
  ["vote_downtown_events_carson", "Do community events make downtown Carson City feel more connected?"],
  ["vote_housing_options_nevada", "Should Nevada do more to support housing options for workers and young families?"],
  ["vote_local_news_habit_washoe", "Would you check the feed more often for short local civic updates in Washoe County?"],
  ["vote_school_pride_carson", "Do Carson City schools feel like a strong part of community identity?"],
  ["vote_campaign_disclosure_nevada", "Should candidate donation data be easier to compare across Nevada races?"],
  ["vote_busyness_washoe", "Does growth in Washoe County make daily life feel meaningfully busier than it did a few years ago?"],
  ["vote_state_identity_nevada", "Do statewide civic conversations in Nevada feel relevant to your daily life?"],
  ["vote_carson_walkability", "Should Carson City invest more in sidewalks, crossings, and everyday walkability?"],
  ["vote_washoe_community_voice", "Do you feel neighborhood voices are heard early enough in Washoe County decisions?"],
];

const seedJurisdictions = [
  "Carson City, Nevada",
  "Washoe County, Nevada",
  "Nevada",
];

const seedDraftLegislation = [
  ["draft_legislation_carson_meeting_access", "Draft ordinance to require Carson City public meetings to be livestreamed and archived"],
];

console.log("Mock auth seed users:");
seedUsers.forEach(([role, name]) => {
  console.log(`- ${role}: ${name}`);
});

console.log("\nMock jurisdictions:");
seedJurisdictions.forEach((name) => {
  console.log(`- ${name}`);
});

console.log("\nMock petitions:");
seedPetitions.forEach(([id, title]) => {
  console.log(`- ${id}: ${title}`);
});

console.log("\nMock petition signatures:");
seedSignatures.forEach(([id, petitionId]) => {
  console.log(`- ${id}: ${petitionId}`);
});

console.log("\nMock draft legislation:");
seedDraftLegislation.forEach(([id, title]) => {
  console.log(`- ${id}: ${title}`);
});

console.log("\nMock officials:");
seedOfficials.forEach(([id, name]) => {
  console.log(`- ${id}: ${name}`);
});

console.log("\nMock candidates:");
seedCandidates.forEach(([id, description]) => {
  console.log(`- ${id}: ${description}`);
});

console.log("\nMock elections:");
seedElections.forEach(([id, title]) => {
  console.log(`- ${id}: ${title}`);
});

console.log("\nMock quick vote questions:");
seedVoteQuestions.forEach(([id, question]) => {
  console.log(`- ${id}: ${question}`);
});
