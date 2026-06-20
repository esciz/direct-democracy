export type PublicBodyLevel = "city" | "county" | "state" | "school" | "university" | "special_district";

export type PublicMeetingScraperType = "html" | "pdf_index" | "granicus" | "legistar" | "civicclerk" | "manual";

export type PublicMeetingDocumentType =
  | "agenda"
  | "minutes"
  | "staff_report"
  | "board_packet"
  | "ordinance"
  | "resolution"
  | "consent_agenda"
  | "public_comment"
  | "transcript"
  | "roll_call_vote"
  | "attachment"
  | "exhibit"
  | "other";

export type MeetingIngestionStatus = "source_registered" | "uploaded" | "text_extracted" | "parsed" | "needs_review" | "error";

export type MeetingItemType =
  | "consent"
  | "action"
  | "public_hearing"
  | "ordinance"
  | "resolution"
  | "presentation"
  | "public_comment"
  | "closed_session"
  | "other";

export type MeetingPolicyArea =
  | "Housing"
  | "Zoning"
  | "Taxes"
  | "Public Safety"
  | "Schools"
  | "Transportation"
  | "Environment"
  | "Utilities"
  | "Budget"
  | "Labor"
  | "Healthcare"
  | "Elections"
  | "Business Regulation"
  | "Other";

export type VoteChoice = "yes" | "no" | "abstain" | "absent" | "recused" | "unknown";

export type CitizenQuestionStatus = "draft" | "reviewed" | "published";

export type OfficialMeetingActionType =
  | "VOTE_YES"
  | "VOTE_NO"
  | "ABSTAIN"
  | "ABSENT"
  | "MOTION_MADE"
  | "MOTION_SECONDED"
  | "AGENDA_REQUEST"
  | "STAFF_DIRECTION"
  | "PUBLIC_STATEMENT"
  | "SPONSOR"
  | "CO_SPONSOR";

export type PublicMeetingExtractionMethod = "html_text" | "pdf_text" | "plain_text" | "ocr_needed" | "manual_review" | "unsupported";

export type PublicMeetingSourceMethod =
  | "automated_archive"
  | "manual_cache"
  | "manual_fixture"
  | "source_registry";

export type ManualSourceKind =
  | "agenda"
  | "packet"
  | "minutes"
  | "video"
  | "vote"
  | "bill"
  | "journal"
  | "rawHtml"
  | "apiJson";

export type ManualParserStatus =
  | "blank"
  | "cached"
  | "parsed"
  | "partially_parsed"
  | "needs_review"
  | "needs_parser"
  | "source_missing"
  | "unavailable"
  | "fixture"
  | "skip";

export type RollCallStatus = "parsed" | "unavailable" | "needs parser" | "source missing" | "needs_roll_call_review";

export type CitizenQuestionReviewStatus = "ready" | "needs_context" | "needs_financial_review" | "needs_vote_outcome";

export type OfficialActionMatchReviewStatus = "unmatched" | "suggested_match" | "approved" | "rejected";

export type PublicMeetingSourceSeed = {
  id: string;
  name: string;
  jurisdiction: string;
  level: PublicBodyLevel;
  website?: string | null;
  sourceUrl?: string | null;
  meetingIndexUrl: string | null;
  agendaArchiveUrl?: string | null;
  minutesArchiveUrl?: string | null;
  packetArchiveUrl?: string | null;
  videoArchiveUrl?: string | null;
  scraperType: PublicMeetingScraperType;
  active: boolean;
  notes?: string | null;
};

export type PublicBodyRecord = {
  id: string;
  name: string;
  jurisdiction: string;
  level: PublicBodyLevel;
  website: string | null;
  source_url: string | null;
  meeting_index_url: string | null;
  scraper_type: PublicMeetingScraperType;
  active: boolean;
  seed_source_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicMeetingRecord = {
  id: string;
  public_body_id: string;
  meeting_date: string | null;
  meeting_type: string | null;
  title: string;
  agenda_url: string | null;
  minutes_url: string | null;
  packet_url: string | null;
  video_url: string | null;
  transcript_url: string | null;
  meeting_summary: string | null;
  key_actions: string[];
  vote_results: Array<{
    motion: string | null;
    result: string | null;
    vote_text: string | null;
    source_url: string | null;
  }>;
  source_document_count: number;
  source_urls: string[];
  source_method?: PublicMeetingSourceMethod;
  source_local_paths?: string[];
  parser_status?: ManualParserStatus | null;
  roll_call_status?: RollCallStatus | null;
  ingestion_status: MeetingIngestionStatus;
  document_hashes: string[];
  created_at: string;
  updated_at: string;
};

export type PublicMeetingItemRecord = {
  id: string;
  meeting_id: string;
  item_number: string | null;
  title: string;
  description: string | null;
  one_sentence_summary: string;
  plain_english_explanation: string;
  why_it_matters: string;
  affected_groups: string[];
  financial_impact: string | null;
  vote_outcome: string | null;
  related_official_names: string[];
  related_organization_names: string[];
  agenda_section: string | null;
  item_type: MeetingItemType;
  staff_recommendation: string | null;
  fiscal_impact_summary: string | null;
  department_names?: string[];
  source_snippet?: string | null;
  policy_area: MeetingPolicyArea;
  source_page: number | null;
  source_text: string;
  source_url: string | null;
  source_method?: PublicMeetingSourceMethod;
  source_local_path?: string | null;
  parser_status?: ManualParserStatus | null;
  roll_call_status?: RollCallStatus | null;
  source_document_hash: string | null;
  cached_text_path: string | null;
  confidence_score: number;
};

export type ManualPublicMeetingManifestEntry = {
  providerId: string;
  sourceName: string;
  officialSourceUrl: string | null;
  downloadedAt: string | null;
  fileType: string;
  meetingDate: string | null;
  meetingTitle: string | null;
  governingBody: string | null;
  sourceKind: ManualSourceKind;
  localPath: string;
  notes: string | null;
  parserStatus: ManualParserStatus;
};

export type VoteRecord = {
  id: string;
  meeting_item_id: string;
  official_id: string | null;
  official_name: string;
  motion: string | null;
  vote: VoteChoice;
  result: string | null;
  vote_text: string;
  source_snippet?: string | null;
  confidence_score: number;
  source_url: string | null;
  source_page: number | null;
};

export type OfficialMeetingActionRecord = {
  id: string;
  official_id: string | null;
  official_name_raw: string;
  jurisdiction_body: string;
  meeting_id: string;
  topic_item_id: string;
  action_type: OfficialMeetingActionType;
  action_text: string;
  source_url: string | null;
  source_snippet: string;
  confidence: number;
  match_confidence?: number | null;
  match_reason?: string | null;
  review_status?: OfficialActionMatchReviewStatus;
  needs_review: boolean;
  created_at: string;
};

export type PublicMeetingOfficialRosterSeed = {
  providerId: string;
  sourceName: string;
  sourceUrl: string;
  jurisdictionName: string;
  jurisdictionSlug: string;
  jurisdictionType: "STATE" | "COUNTY" | "CITY" | "AGENCY";
  bodyName: string;
  bodyAliases?: string[];
  officeTitle: string;
  officeLevel: "STATE" | "COUNTY" | "CITY";
  members: Array<{
    externalId: string;
    fullName: string;
    surname: string;
    seatTitle?: string | null;
    termStart?: string | null;
    termEnd?: string | null;
    status?: "CURRENT" | "FORMER" | "ACTING" | "ELECT";
    sourceUrl?: string | null;
    aliases?: string[];
  }>;
  notes?: string | null;
};

export type PublicMeetingOfficialRosterReport = {
  generated_at: string;
  seeded_roster_count: number;
  seeded_member_count: number;
  imported_member_count: number;
  body_reports: Array<{
    body_id: string;
    body_name: string;
    jurisdiction: string;
    meeting_count: number;
    roll_call_review_items: number;
    surname_only_actions: string[];
    roster_member_count: number;
    matched_surnames: string[];
    missing_surnames: string[];
    coverage_percent: number;
    has_roster: boolean;
  }>;
};

export type MeetingVotingCardOutcomeStatus = "proposed" | "approved" | "denied" | "continued" | "pending" | "unknown";

export type MeetingVotingCardReviewStatus = "ready" | "needs_review" | "approved" | "rejected";

export type MeetingVotingCardFinancialImpactType =
  | "revenue"
  | "expense"
  | "transfer"
  | "bond_debt"
  | "fee"
  | "grant"
  | "enterprise_fund"
  | "tax"
  | "existing_fund"
  | "budget_authority"
  | "unknown";

export type MeetingVotingCardTaxImpactStatus = "stated" | "unlikely" | "unknown" | "needs_review";

export type MeetingVotingCardFinancialImpactContext = {
  amount: string | null;
  amounts: string[];
  fund_source: string | null;
  fiscal_year: string | null;
  impact_types: MeetingVotingCardFinancialImpactType[];
  direct_tax_impact: MeetingVotingCardTaxImpactStatus;
  tax_cost_summary: string;
  plain_english_summary: string;
  source_snippet: string | null;
  badges: string[];
  confidence: number;
  needs_review: boolean;
};

export type MeetingVotingCardRecord = {
  id: string;
  generation_key: string;
  meeting_id: string;
  topic_item_id: string;
  jurisdiction: string;
  body_name: string;
  civic_layer?: "city" | "county" | "school_district" | "state" | "federal" | "special_district";
  civic_layer_label?: string;
  jurisdiction_display_name?: string;
  governing_body_display_name?: string | null;
  meeting_date: string | null;
  meeting_status: "upcoming" | "completed" | "unknown";
  policy_area: MeetingPolicyArea;
  title: string;
  question_text: string;
  public_title?: string;
  public_question?: string;
  source_title?: string;
  source_item_number?: string | null;
  plain_action?: string;
  plain_purpose?: string;
  citizen_summary?: string;
  agenda_language_original?: string;
  plain_language_summary: string;
  source_event_href: string;
  source_topic_href: string;
  source_url: string | null;
  source_snippets: string[];
  financial_impact: string | null;
  financial_impact_context?: MeetingVotingCardFinancialImpactContext | null;
  affected_groups: string[];
  outcome_status: MeetingVotingCardOutcomeStatus;
  outcome_text: string | null;
  review_status: MeetingVotingCardReviewStatus;
  confidence_score: number;
  related_official_actions: Array<{
    id: string;
    official_id: string | null;
    official_name_raw: string;
    action_type: OfficialMeetingActionType;
    action_text: string;
    review_status?: OfficialActionMatchReviewStatus;
  }>;
  needs_roll_call_review: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicCivicCaseStatus = "new" | "open" | "under_review" | "referred" | "resolved" | "closed" | "archived";
export type PublicCivicCasePriority = "low" | "medium" | "high" | "urgent";
export type PublicCivicCaseSourceType =
  | "public_submission"
  | "meeting_public_comment"
  | "agenda_item"
  | "news"
  | "government_notice"
  | "imported_case_system"
  | "manual_admin";
export type PublicCivicCaseReviewStatus = "needs_review" | "approved" | "rejected";

export type PublicCivicCaseRecord = {
  id: string;
  title: string;
  plain_language_summary: string;
  status: PublicCivicCaseStatus;
  priority: PublicCivicCasePriority;
  jurisdiction: string;
  civic_layer: "city" | "county" | "school_district" | "state" | "federal" | "special_district";
  civic_layer_label: string;
  body_or_department: string | null;
  source_type: PublicCivicCaseSourceType;
  source_url: string | null;
  source_snippet: string | null;
  related_meeting_id: string | null;
  related_agenda_item_id: string | null;
  related_voting_card_id: string | null;
  related_official_ids: string[];
  related_community_id: string | null;
  policy_area: MeetingPolicyArea;
  created_at: string;
  updated_at: string;
  last_public_update_at: string | null;
  review_status: PublicCivicCaseReviewStatus;
  confidence_score: number;
  badges: string[];
};

export type CitizenVoteQuestionRecord = {
  id: string;
  meeting_item_id: string;
  jurisdiction: string;
  question_text: string;
  short_summary: string;
  neutral_context: string;
  fiscal_impact: string | null;
  arguments_for: string[];
  arguments_against: string[];
  affected_groups: string[];
  policy_area: MeetingPolicyArea;
  status: CitizenQuestionStatus;
  review_status?: CitizenQuestionReviewStatus;
  source_urls: string[];
  confidence_score: number;
};

export type PublicMeetingImportDocument = {
  id: string;
  source_id: string | null;
  public_body_id: string | null;
  public_body_name: string | null;
  meeting_date: string | null;
  meeting_type: string | null;
  title: string | null;
  document_type: PublicMeetingDocumentType;
  local_file_path: string | null;
  source_url: string | null;
  agenda_url: string | null;
  minutes_url: string | null;
  packet_url: string | null;
  video_url: string | null;
  transcript_url: string | null;
  notes: string | null;
};

export type PublicMeetingIngestionReport = {
  generated_at: string;
  seed_sources: number;
  public_bodies: number;
  manual_documents_found: number;
  manual_documents_parsed: number;
  meetings: number;
  meeting_items: number;
  vote_records: number;
  official_actions?: number;
  meeting_voting_cards?: number;
  citizen_vote_questions: number;
  low_confidence_items: number;
  ocr_needed_documents: number;
  errors: Array<{ document_id?: string | null; message: string }>;
  provider_reports: PublicMeetingProviderReport[];
  output_files: Record<string, string>;
};

export type PublicMeetingProviderReport = {
  source_id: string;
  provider_name: string;
  jurisdiction: string;
  scraper_type: PublicMeetingScraperType;
  historical_ingestion_supported: boolean;
  meetings_discovered: number;
  meetings_parsed: number;
  minutes_parsed: number;
  agenda_packets_parsed: number;
  failures: number;
  oldest_meeting_found: string | null;
  newest_meeting_found: string | null;
  notes: string | null;
};

export type PublicMeetingManualProviderReport = {
  provider_id: string;
  source_name: string;
  status: "blocked" | "cached" | "parsed" | "partially_parsed" | "missing";
  manifest_path: string;
  cached_files: number;
  detail_pages_collected?: number;
  pdfs_collected?: number;
  json_collected?: number;
  parsed_meetings: number;
  parsed_items: number;
  vote_action_records_parsed?: number;
  official_action_records_parsed?: number;
  meeting_voting_cards_generated?: number;
  meeting_voting_cards_approved?: number;
  meeting_voting_cards_needs_review?: number;
  roll_call_parsed_count?: number;
  roll_call_needs_review_count?: number;
  low_confidence_pdf_records?: number;
  question_ready_count?: number;
  question_needs_context_count?: number;
  question_needs_financial_review_count?: number;
  question_needs_vote_outcome_count?: number;
  needs_review_count?: number;
  parser_failures: number;
  failure_reasons?: string[];
  boarddocs_failures?: Array<{ url: string; reason: string; sourceKind?: string | null }>;
  fixture_files: number;
  interactive_session_needed?: boolean;
  parser_gaps?: string[];
  next_recommended_action?: string | null;
  notes: string | null;
  updated_at: string;
};

export type OfficialMeetingPolicySummary = {
  policy_area: MeetingPolicyArea;
  yes: number;
  no: number;
  abstain: number;
  absent: number;
  recused: number;
  unknown: number;
  total: number;
};

export type OfficialMeetingTimelineEntry = {
  id: string;
  meeting_date: string | null;
  public_body_name: string;
  item_title: string;
  policy_area: MeetingPolicyArea;
  vote: VoteChoice;
  result: string | null;
  source_url: string | null;
  confidence_score: number;
};

export type OfficialMeetingRecordSummary = {
  official_name: string;
  matched_vote_count: number;
  matched_question_count: number;
  by_policy_area: OfficialMeetingPolicySummary[];
  recent_notable_votes: OfficialMeetingTimelineEntry[];
  source_backed_timeline: OfficialMeetingTimelineEntry[];
  citizen_alignment_percent: number | null;
  last_updated_at: string | null;
};

export type CommunityMeetingSummary = {
  community_name: string;
  matching_public_body_count: number;
  upcoming_meetings: Array<{
    id: string;
    title: string;
    public_body_name: string;
    meeting_date: string | null;
    agenda_url: string | null;
    major_topics?: string[];
  }>;
  recent_decisions: Array<{
    id: string;
    title: string;
    public_body_name: string;
    meeting_date: string | null;
    result: string | null;
    source_url: string | null;
  }>;
  open_questions: MeetingVotingCardRecord[];
  recently_approved_spending: PublicMeetingItemRecord[];
  public_cases?: PublicCivicCaseRecord[];
  public_comment_opportunities: Array<{
    id: string;
    title: string;
    public_body_name: string;
    meeting_date: string | null;
    agenda_url: string | null;
  }>;
  last_updated_at: string | null;
};
