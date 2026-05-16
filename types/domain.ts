export type UserRole = "citizen" | "trustedCitizen" | "candidate" | "official" | "media" | "moderator" | "admin";

export type JurisdictionType = "COUNTRY" | "STATE" | "COUNTY" | "CITY" | "DISTRICT";

export type PostType = "TEXT" | "IMAGE" | "VIDEO" | "AUDIO";
export type ContextAttachmentType =
  | "community"
  | "issue"
  | "case"
  | "official"
  | "candidate"
  | "petition"
  | "legislation"
  | "election"
  | "coalition"
  | "event";
export type PerspectiveType =
  | "perspective"
  | "official_update"
  | "candidate_statement"
  | "media_summary"
  | "coalition_update"
  | "petition_update";
export type PostContentType =
  | "statementClaim"
  | "newsStory"
  | "opinionPerspective"
  | "announcementUpdate"
  | "event"
  | "questionPoll"
  | "interview";
export type PostFactualClaimFlagSummary = {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
};

export type VoteQuestionCategory = "civic" | "lifestyle" | "identity";

export type VoteAnswer = "yes" | "no" | "skip";

export type VoteQuestionScope = "local" | "state" | "national";
export type VoteObjectType = "representative" | "decision" | "case" | "community";
export type FormalVoteType =
  | "representativeVote"
  | "legislation"
  | "ballotMeasure"
  | "agendaItem"
  | "schoolBoardDecision"
  | "executiveAction"
  | "caseVote"
  | "publicVote"
  | "citizenElevatedVote";
export type FormalVoteStatus = "proposed" | "active" | "closed" | "passed" | "failed" | "enacted" | "archived";
export type FormalVoteOrigin = "officialDecision" | "ballot" | "communityReview" | "citizenElevated";
export type VoteResponseLabels = {
  yes: string;
  no: string;
  skip: string;
};
export type TruthRatingValue = "Accurate" | "Mostly True" | "Mixed / Unclear" | "Misleading" | "False";
export type TrustLevel = "High Trust" | "Moderate Trust" | "Mixed" | "Low Trust";
export type InfluenceLevel = "High Influence" | "Moderate Influence" | "Emerging";
export type UserVerificationState = "unverified" | "campusVerified" | "voterVerified";
export type VerificationTrustTier =
  | "guestBrowseOnly"
  | "accountCreated"
  | "basicVerified"
  | "verifiedCitizen"
  | "enhancedVerified"
  | "claimEligible"
  | "trustedCitizenEligible"
  | "candidateOfficialClaimCleared";
export type ContactVerificationStatus = "unverified" | "pending" | "verified";
export type VerificationMatchConfidence = "high" | "medium" | "low" | "none";
export type EnhancedIdentityStatus = "notNeeded" | "recommended" | "required" | "submitted" | "verified" | "failed";
export type ManualReviewStatus = "notNeeded" | "available" | "requested" | "inReview" | "approved" | "denied";
export type CandidateOfficialMatchStatus = "none" | "possibleMatch" | "strongMatch" | "claimCleared";
export type VerificationRiskFlag =
  | "newDevice"
  | "duplicateIdentity"
  | "duplicateAccountSignal"
  | "ambiguousVoterMatch"
  | "claimRequiresEnhancedVerification"
  | "manualReviewRequired";
export type MediaTier = "trustedSource" | "verifiedMedia";
export type MediaBiasRatingValue = "Far Left" | "Left" | "Center" | "Right" | "Far Right";
export type CommunityTrustScope = "campus" | "local" | "state" | "national";
export type ReputationTier = "Highly Trusted" | "Trusted" | "Mixed Reliability" | "Low Reliability";

export type PollOptionResult = {
  option: string;
  voteCount: number;
  percentage: number;
};

export type SentimentHistoryPoint = {
  label: string;
  date: string;
  supportPercent: number;
  opposePercent?: number;
  undecidedPercent?: number;
};

export type PoliticalAdSourceType =
  | "print"
  | "mailer"
  | "podcastAd"
  | "internetAd"
  | "socialMediaAd"
  | "searchAd"
  | "displayAd"
  | "streamingAd"
  | "cableAd"
  | "broadcastTvAd"
  | "radioAd"
  | "connectedTvAd"
  | "textSmsAd"
  | "emailAd"
  | "billboardOutdoorAd"
  | "eventHandout"
  | "otherUnknown";

export type PoliticalAdSponsorType =
  | "candidateCampaign"
  | "officeholderCommittee"
  | "oppositionCandidate"
  | "politicalParty"
  | "pac"
  | "superPac"
  | "union"
  | "nonprofitAdvocacyGroup"
  | "corporationTradeAssociation"
  | "ballotMeasureCommittee"
  | "independentExpenditureGroup"
  | "unknownUndisclosed"
  | "other";

export type PoliticalAdEntityType = "candidate" | "official" | "issue" | "ballotMeasure" | "election";
export type PoliticalAdRelationType = "supports" | "opposes" | "mentions" | "related";
export type PoliticalAdTruthRating = "True" | "Mostly True" | "Mostly False" | "False" | "Not Checkable" | "Needs Review";
export type PoliticalAdRatingConfidence = "High" | "Medium" | "Low";
export type PoliticalAdClaimType = "factual" | "opinion" | "prediction" | "notCheckable";
export type PoliticalAdClaimImportance = "high" | "medium" | "low";
export type PoliticalAdMediaType = "thumbnail" | "image" | "video" | "audio" | "transcript" | "ocrText" | "pdf" | "externalEmbed";
export type PoliticalAdChallengeReason =
  | "incorrect"
  | "missingContext"
  | "outdated"
  | "sourceProblem"
  | "misleadingClaimExtraction"
  | "newEvidence"
  | "other";
export type PoliticalAdChallengeStatus = "pending" | "underReview" | "accepted" | "rejected" | "resolved";
export type PoliticalAdStatus = "draft" | "pendingReview" | "published" | "archived" | "removed";

export type PoliticalAdMedia = {
  id: string;
  politicalAdId: string;
  mediaType: PoliticalAdMediaType;
  url?: string | null;
  textContent?: string | null;
  altText?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
  createdAt: string;
};

export type PoliticalAdEntityRelation = {
  id: string;
  politicalAdId: string;
  entityType: PoliticalAdEntityType;
  entityId: string;
  entityLabel: string;
  relationType: PoliticalAdRelationType;
  createdAt: string;
};

export type PoliticalAdGeography = {
  id: string;
  politicalAdId: string;
  country: string;
  state?: string | null;
  county?: string | null;
  city?: string | null;
  districtType?: string | null;
  districtName?: string | null;
  precinct?: string | null;
  boundaryId?: string | null;
  createdAt: string;
};

export type AdClaimEvidence = {
  id: string;
  claimId: string;
  title: string;
  url: string;
  sourceType: string;
  publisher: string;
  publishedAt?: string | null;
  excerpt: string;
  supportsOrRefutes: "supports" | "refutes" | "contextualizes";
  createdAt: string;
};

export type AdClaim = {
  id: string;
  politicalAdId: string;
  claimText: string;
  normalizedClaim: string;
  claimType: PoliticalAdClaimType;
  mediaTimestampStart?: string | null;
  mediaTimestampEnd?: string | null;
  mediaLocation?: string | null;
  importance: PoliticalAdClaimImportance;
  systemRating: PoliticalAdTruthRating;
  systemConfidence: PoliticalAdRatingConfidence;
  systemExplanation: string;
  citizenRating?: PoliticalAdTruthRating | null;
  citizenAgreementPercent?: number | null;
  citizenRatingCount?: number | null;
  evidence: AdClaimEvidence[];
  createdAt: string;
  updatedAt: string;
};

export type CitizenAdRating = {
  id: string;
  userId: string;
  politicalAdId: string;
  rating: PoliticalAdTruthRating;
  explanation: string;
  sourceUrl?: string | null;
  trustWeight?: number | null;
  status: "active" | "flagged" | "removed";
  createdAt: string;
  updatedAt: string;
};

export type CitizenClaimRating = {
  id: string;
  userId: string;
  claimId: string;
  rating: PoliticalAdTruthRating;
  explanation: string;
  sourceUrl?: string | null;
  trustWeight?: number | null;
  status: "active" | "flagged" | "removed";
  createdAt: string;
  updatedAt: string;
};

export type AdRatingChallenge = {
  id: string;
  submittedByUserId: string;
  targetType: "ad" | "claim";
  targetId: string;
  reason: PoliticalAdChallengeReason;
  explanation: string;
  evidenceUrl?: string | null;
  status: PoliticalAdChallengeStatus;
  resolution?: string | null;
  reviewedByUserId?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
};

export type PoliticalAd = {
  id: string;
  title: string;
  description: string;
  sourceType: PoliticalAdSourceType;
  sponsorName: string;
  sponsorType: PoliticalAdSponsorType;
  paidForBy: string;
  producedBy?: string | null;
  authorizedBy?: string | null;
  authorizationText?: string | null;
  totalSpend?: number | null;
  currency: string;
  impressions?: number | null;
  firstSeenAt: string;
  lastSeenAt?: string | null;
  electionCycle: string;
  geographySummary: string;
  platformUrl?: string | null;
  archiveUrl?: string | null;
  overallSystemRating: PoliticalAdTruthRating;
  overallSystemConfidence: PoliticalAdRatingConfidence;
  overallSystemExplanation: string;
  overallCitizenRating?: PoliticalAdTruthRating | null;
  citizenAgreementPercent?: number | null;
  citizenRatingCount?: number | null;
  status: PoliticalAdStatus;
  media: PoliticalAdMedia[];
  entityRelations: PoliticalAdEntityRelation[];
  geographies: PoliticalAdGeography[];
  claims: AdClaim[];
  citizenRatings: CitizenAdRating[];
  challenges: AdRatingChallenge[];
  createdAt: string;
  updatedAt: string;
};

export type PoliticalAdFilters = {
  q?: string;
  candidateId?: string;
  officialId?: string;
  issueId?: string;
  ballotMeasureId?: string;
  electionId?: string;
  sponsor?: string;
  sponsorType?: PoliticalAdSponsorType | "all";
  sourceType?: PoliticalAdSourceType | "all";
  relationType?: PoliticalAdRelationType | "all";
  systemRating?: PoliticalAdTruthRating | "all";
  citizenRating?: PoliticalAdTruthRating | "all";
  geography?: string;
  minSpend?: number;
  maxSpend?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: "newest" | "mostExpensive" | "mostViewed" | "mostMisleading" | "mostDisputed" | "highestCitizenParticipation";
  page?: number;
};

export type ContextAttachmentSummary = {
  type: ContextAttachmentType;
  id: string;
  label: string;
  jurisdictionId?: string | null;
};

export type ExternalLinkPlatform =
  | "website"
  | "linkedin"
  | "instagram"
  | "x"
  | "facebook"
  | "youtube"
  | "tiktok"
  | "newsletter";

export type ExternalLinkSummary = {
  platform: ExternalLinkPlatform;
  url: string;
};

export type TopIssueSource = "curated" | "writeIn";

export type FavoriteSpotType =
  | "restaurant"
  | "bar"
  | "coffeeShop"
  | "park"
  | "hikeOutdoor"
  | "museumCulture"
  | "activityEntertainment";

export type ProfileTagCategory =
  | "religion"
  | "sexualOrientation"
  | "genderIdentity"
  | "profession"
  | "lifestyle"
  | "interests"
  | "community";

export type PoliticalAffiliation = "Democrat" | "Republican" | "Independent" | "Other" | "Prefer not to say";

export type ServiceCategory =
  | "Housing"
  | "Education"
  | "Transportation"
  | "Permits"
  | "Utilities"
  | "Public Safety";

export type CommunityDataLevel = "city" | "county" | "state" | "federal";
export type CommunityType = "geographic" | "campus";
export type InstitutionType = "public" | "private";

export type CommunityGroupType =
  | "tradeUnion"
  | "chamberOfCommerce"
  | "neighborhoodAssociation"
  | "advocacyOrganization"
  | "parentTeacherGroup"
  | "veteransGroup"
  | "environmentalGroup"
  | "smallBusinessGroup"
  | "faithCommunityService"
  | "professionalAssociation";
export type OrganizationType =
  | "campus_org"
  | "coalition"
  | "labor"
  | "public_interest"
  | "special_interest"
  | "religious"
  | "nonprofit"
  | "neighborhood"
  | "professional"
  | "student"
  | "business"
  | "advocacy";
export type OrganizationMembershipRole = "founder" | "admin" | "member";
export type OrganizationMembershipState = "pending" | "approved" | "declined";
export type OrganizationPlatformItemStatus = "draft" | "active" | "adopted";
export type OrganizationVoteChoice = "support" | "oppose";

export type CreditBoostTarget = "issue" | "voice" | "post";
export type CreditTransactionType =
  | "vote"
  | "pollVote"
  | "endorsement"
  | "petition"
  | "debateStart"
  | "debateJoin"
  | "debateComplete"
  | "eventAttendance"
  | "interviewComplete"
  | "caseContribution"
  | "publicResponsiveness";
export type PromiseStatus = "Achieved" | "In Progress" | "Reversed";
export type IssueLifecycleStage = "Issue" | "Petition" | "Seeking Sponsor" | "Sponsored" | "Drafting" | "Proposed Legislation";
export type NotificationType =
  | "petitionSeekingSponsor"
  | "petitionSponsorFound"
  | "petitionDrafting"
  | "pollConvertedToPetition"
  | "nearbyEvent"
  | "eventTrending"
  | "eventReminder"
  | "followeeEventRsvp"
  | "eventLive"
  | "eventPostActivity"
  | "debateChallenge"
  | "debateGroupJoin"
  | "debateUpdate"
  | "debateFollowedUserJoined"
  | "debateCompleted"
  | "debateResolved"
  | "debateRecommended"
  | "followeeTrustedCitizen"
  | "followeeCandidate"
  | "followeeOfficial"
  | "messageRequest"
  | "messageThreadUpdate"
  | "messageReplyReceived"
  | "organizationAnnouncement"
  | "followeePost"
  | "followeeMajorAction";
export type CaseCourtLevel = "local" | "state" | "federal";
export type CaseStage = "trial" | "appeal" | "cert" | "merits";
export type CaseStatus = "active" | "watching" | "closed";
export type ContactActionTargetType = "issue" | "petition" | "legislation";
export type ContactMethod = "email" | "phone" | "form";
export type SchoolGradeLevels = string[];
export type OfficialActionType =
  | "voteCast"
  | "billSponsored"
  | "billCoSponsored"
  | "executiveAction"
  | "publicStatement"
  | "meetingHeld"
  | "budgetProposal"
  | "policyAnnouncement"
  | "committeeAction";
export type OfficialActionSourceType = "official" | "media" | "citizen";
export type OfficialActionVerificationStatus = "unverified" | "sourced" | "verified";
export type OfficialActionReactionType = "support" | "oppose";
export type PublicActionAlignment = "aligned" | "mixed" | "against";
export type DebateMode = "individual" | "group";
export type DebateStatus = "open" | "completed" | "withdrawn" | "agreed";
export type DebateOutcomeType = "resolved_by_agreement" | "withdrawn" | "completed";
export type DebateStartState = "pendingChallenge" | "seekingParticipants" | "active";
export type DebateSide = "A" | "B";
export type DebateParticipantRole = "lead" | "member";
export type DebateTurnType = "opening" | "response" | "closing";
export type DebateTurnReactionType = "support" | "oppose";
export type DebateFallacyReviewPosition = "agree" | "disagree";
export type DebateFallacyStatus = "Supported" | "Contested" | "Rejected";
export type DebateFallacyType =
  | "Ad Hominem"
  | "Straw Man"
  | "Red Herring"
  | "False Dichotomy"
  | "Slippery Slope"
  | "Appeal to Emotion"
  | "Hasty Generalization"
  | "Circular Reasoning"
  | "Whataboutism";
export type CitationSourceType = "government" | "academic" | "news" | "organization";
export type DebateTurnPhase = "awaitingStatement" | "drafting" | "voting" | "readyToFinalize" | "complete";
export type DebateRecommendationCategory =
  | "issueDifference"
  | "localIssue"
  | "publicResponse"
  | "trendingIssue"
  | "trustedVoice";

export type FundingBreakdownItem = {
  label:
    | "Individual / Small Donors"
    | "Large Individual Donors"
    | "PACs / Committees"
    | "Industry / Organization"
    | "Self-funded";
  percentage: number;
};

export type FundingIndustryBreakdownItem = {
  label: string;
  percentage: number;
};

export type PollingComparisonSummary = {
  source: string;
  fieldDate: string;
  externalResult: string;
  platformSentiment: string;
  differenceLabel: string;
};

export type FollowSummary = {
  id: string;
  followerUserId: string;
  followingUserId: string;
  createdAt: string;
};

export type PetitionStatus = "DRAFT" | "ACTIVE" | "ELIGIBLE_FOR_COSPONSORSHIP" | "CLOSED";
export type CivicPetitionProgressStatus = "Active" | "Seeking Sponsor" | "Sponsor Found" | "Drafting";

export type PublicProfileType = "citizen" | "trustedCitizen" | "candidate" | "official" | "media" | "incumbentCandidate";

export type ElectionType = "PRIMARY" | "GENERAL" | "SPECIAL" | "RUNOFF" | "LOCAL";

export type ElectionStatus = "UPCOMING" | "ACTIVE" | "COMPLETED";

export type CampaignStatus = "ANNOUNCED" | "ACTIVE" | "SUSPENDED" | "WITHDRAWN" | "WON" | "LOST";

export type PublicProfileSource = "admin" | "user";

export type ClaimStatus = "UNCLAIMED" | "PENDING" | "CLAIMED";

export type UserSummary = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  role: UserRole;
  verificationState: UserVerificationState;
  studentModeEnabled?: boolean;
  studentVerified?: boolean;
  studentEmail?: string | null;
  studentCampusCommunityId?: string | null;
  mediaTier?: MediaTier | null;
  jurisdictionName: string;
  primaryCommunityId?: string | null;
  campusCommunityIds?: string[];
  followerCount: number;
  isVerifiedVoter: boolean;
  isAnonymousPublic: boolean;
};

export type UserSocialSummary = {
  followerCount: number;
  followingCount: number;
  trustedProgressByCommunity: TrustedCommunityProgressSummary[];
};

export type TrustedCommunityProgressSummary = {
  communityId: string;
  communityName: string;
  communityShortName: string;
  communityScope: CommunityTrustScope;
  communityType: CommunityType;
  currentFollowers: number;
  followerTarget: number;
  followerProgressPercent: number;
  engagedFollowerCount: number;
  engagementTarget: number;
  engagementProgressPercent: number;
  engagementRatePercent: number;
  engagementThresholdPercent: number;
  userCount: number;
  voterVerified: boolean;
  meetsFollowerThreshold: boolean;
  meetsEngagementThreshold: boolean;
  eligible: boolean;
  alreadyTrusted: boolean;
  explanation: string;
};

export type UserReputationSummary = {
  trustLevel: TrustLevel;
  influenceLevel: InfluenceLevel;
  trustSummary: string;
  influenceSummary: string;
  trustedCitizenReputation: {
    score: number;
    tier: ReputationTier;
    summary: string;
    breakdown: {
      truth: number;
      debate: number;
      communityTrust: number;
    };
  } | null;
};

export type IdeologicalLeaningLabel = "Left" | "Lean Left" | "Center" | "Lean Right" | "Right";
export type CivicCredibilityLabel = "High" | "Solid" | "Mixed" | "Still Forming";
export type TruthRecordLabel = "Mostly Accurate" | "Mixed" | "Often Challenged" | "Limited Ratings";

export type ProfileSignalsSummary = {
  ideologicalLeaning: {
    label: IdeologicalLeaningLabel;
    summary: string;
    score?: number | null;
  };
  civicCredibility: {
    label: CivicCredibilityLabel;
    summary: string;
    score?: number | null;
  };
  truthRecord: {
    label: TruthRecordLabel;
    summary: string;
    score?: number | null;
  };
  transparencyNote: string;
};

export type AuthUser = UserSummary & {
  email: string;
};

export type VerificationTrustSummary = {
  trustTier: VerificationTrustTier;
  trustLabel: string;
  explanation: string;
  permissions: string[];
  nextStep: string | null;
  checks: {
    emailStatus: ContactVerificationStatus;
    phoneStatus: ContactVerificationStatus;
    antiBotScreened: boolean;
    voterMatchStatus: UserVerificationState;
    voterMatchConfidence: VerificationMatchConfidence;
    enhancedIdentityStatus: EnhancedIdentityStatus;
    manualReviewStatus: ManualReviewStatus;
    candidateOfficialMatchStatus: CandidateOfficialMatchStatus;
  };
  riskFlags: VerificationRiskFlag[];
};

export type PostSummary = {
  id: string;
  title?: string;
  authorId?: string;
  authorName: string;
  authorRole: UserRole;
  authorMediaTier?: MediaTier | null;
  authorProfileHref?: string | null;
  authorCredibilityLabel?: string | null;
  authorCredibilitySummary?: string | null;
  authorViewerCanFollow?: boolean;
  authorViewerIsFollowing?: boolean;
  jurisdictionName: string;
  content: string;
  issueTags?: string[];
  perspectiveType?: PerspectiveType;
  attachments?: ContextAttachmentSummary[];
  visibilityScope?: "community" | "issue" | "profile" | "petition" | "election" | "coalition" | "crossContext";
  jurisdictionScope?: string[];
  stance?: "support" | "oppose" | "neutral" | "explain" | null;
  moderationStatus?: "draft" | "published" | "flagged" | "removed";
  postType: PostType;
  contentType: PostContentType;
  mediaUrl?: string;
  mediaThumbnailUrl?: string;
  mediaDurationLabel?: string;
  audioFormatLabel?: string;
  createdAt: string;
  promotedLabel?: "Sponsored" | "Promoted" | null;
  reactionTotals: {
    up: number;
    down: number;
  };
  commentCount?: number;
  viewerReaction?: "up" | "down" | null;
  boostCount?: number;
  viewerHasBoosted?: boolean;
  truthEligible?: boolean;
  truthPreviewLabel?: string | null;
  truthRatingCount?: number;
  truthDistribution?: Array<{
    label: TruthRatingValue;
    count: number;
    percentage: number;
  }>;
  claimFlagCount?: number;
  viewerHasClaimFlagged?: boolean;
  claimFlagThresholdReached?: boolean;
  viewerHasReportedContent?: boolean;
  truthScore: {
    media: number | null;
    moderators: number | null;
    citizens: number | null;
  };
  viewerFollowsAuthor?: boolean;
  petitionId?: string;
  targetedOfficialIds?: string[];
  eventId?: string | null;
  eventTitle?: string | null;
  isEventPost?: boolean;
  interviewRequestId?: string | null;
  interviewSubjectName?: string | null;
  interviewSubjectProfileId?: string | null;
  interviewSubjectProfileHref?: string | null;
  interviewerName?: string | null;
  shareMode?: "original" | "post" | "repost";
  sharedItem?: {
    entityType: string;
    entityId: string;
    title: string;
    href: string;
    summary?: string | null;
  } | null;
};

export type MediaBiasRatingSummary = {
  id: string;
  userId: string;
  mediaUserId: string;
  rating: MediaBiasRatingValue;
  createdAt: string;
};

export type MediaBiasSummary = {
  mediaUserId: string;
  totalRatings: number;
  viewerRating: MediaBiasRatingValue | null;
  label: MediaBiasRatingValue | null;
  distribution: Array<{
    label: MediaBiasRatingValue;
    count: number;
    percentage: number;
  }>;
};

export type MediaProfileSummary = {
  userId: string;
  name: string;
  username: string;
  tier: MediaTier;
  jurisdictionName: string;
  bio: string | null;
  websiteUrl?: string | null;
  profileImageUrl?: string | null;
  followerCount: number;
  biasSummary: MediaBiasSummary;
};

export type PostClaimFlagState = {
  postId: string;
  count: number;
  viewerHasFlagged: boolean;
  thresholdReached: boolean;
};

export type ModerationReportReason =
  | "harassment"
  | "hate"
  | "threat"
  | "sexual"
  | "spam"
  | "misinformation"
  | "other";

export type ModerationReportTargetType = "post" | "comment";

export type ModerationReportSummary = {
  id: string;
  targetType: ModerationReportTargetType;
  targetId: string;
  userId: string;
  reason: ModerationReportReason;
  note?: string | null;
  createdAt: string;
  status: "open";
};

export type CommentSummary = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  mediaType?: "IMAGE";
  mediaUrl?: string;
  createdAt: string;
};

export type TruthRatingSummary = {
  id: string;
  userId: string;
  entityId: string;
  rating: TruthRatingValue;
  createdAt: string;
};

export type TruthMeterSummary = {
  entityId: string;
  totalRatings: number;
  viewerRating: TruthRatingValue | null;
  distribution: Array<{
    label: TruthRatingValue;
    count: number;
    percentage: number;
  }>;
  weightedDistribution?: Array<{
    label: TruthRatingValue;
    count: number;
    percentage: number;
  }>;
};

export type VoteQuestionSummary = {
  id: string;
  questionText: string;
  category: VoteQuestionCategory;
  scope: VoteQuestionScope;
  jurisdictionId: string;
  jurisdictionName: string;
  objectType?: VoteObjectType;
  issueTag?: string | null;
  voteType?: FormalVoteType;
  status?: FormalVoteStatus;
  origin?: FormalVoteOrigin;
  shortTitle?: string;
  subjectName?: string | null;
  subjectHref?: string | null;
  plainLanguageSummary?: string;
  whyItMatters?: string;
  whoIsAffected?: string;
  introducedBy?: string;
  introducedByRole?: string;
  officialBody?: string;
  whatYesMeans?: string;
  whatNoMeans?: string;
  responseLabels?: VoteResponseLabels;
  officialPositionSummary?: string;
  officialVoteSummary?: string;
  relatedIssueLabel?: string;
  relatedIssueHref?: string;
  referenceProfileId?: string | null;
  referenceCaseId?: string | null;
  weekOf?: string | null;
  graduatedFromPollId?: string | null;
};

export type VoteResponseSummary = {
  id: string;
  userId: string;
  questionId: string;
  answer: VoteAnswer;
  createdAt: string;
};

export type PollSummary = {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorRole: UserRole;
  question: string;
  scope: VoteQuestionScope;
  jurisdictionId: string;
  jurisdictionName: string;
  attachments?: ContextAttachmentSummary[];
  visibilityScope?: "community" | "issue" | "profile" | "petition" | "election" | "coalition" | "crossContext";
  jurisdictionScope?: string[];
  options: string[];
  createdAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  totalVotes: number;
  engagementCount: number;
  results: PollOptionResult[];
  viewerVote: string | null;
  previousViewerVote?: string | null;
  viewerVoteCreatedAt?: string | null;
  votingPeriodStatus?: "open" | "closed";
  canChangeVote?: boolean;
  canVote: boolean;
  promotionEligible?: boolean;
  promotedPetitionId?: string | null;
  promotedVoteQuestionId?: string | null;
};

export type PollVoteSummary = {
  id: string;
  pollId: string;
  userId: string;
  selectedOption: string;
  createdAt: string;
};

export type VoteQuestionCardSummary = VoteQuestionSummary & {
  totalResponses: number;
  results: Record<VoteAnswer, number>;
  percentages: Record<VoteAnswer, number>;
  userAnswer: VoteAnswer | null;
  previousUserVote?: VoteAnswer | null;
  voteUpdatedAt?: string | null;
  votingPeriodStatus?: "open" | "closed";
  canChangeVote?: boolean;
  onboardingPosition?: number;
  onboardingTotal?: number;
  communityLabel?: string;
};

export type FeedRenderableItem =
  | {
      id: string;
      itemType: "post";
      post: PostSummary;
    }
  | {
      id: string;
      itemType: "voteQuestion";
      question: VoteQuestionCardSummary;
    };

export type CommunityEventType =
  | "civicMeeting"
  | "publicHearing"
  | "demonstration"
  | "rally"
  | "communityEvent"
  | "culturalSocialEvent"
  | "interview";

export type CommunityEventFormat = "virtual" | "inPerson";
export type EventRsvpStatus = "attending" | "maybe" | "confirmed";
export type EventStatementPosition = "support" | "dissent" | "neutral";
export type EventSentimentValue = EventStatementPosition;

export type CommunitySponsorType = "trustedCitizen" | "official" | "candidate" | "community";

export type CommunityGroupSummary = {
  id: string;
  name: string;
  type: CommunityGroupType;
  communityId: string;
  jurisdictionName: string;
  description: string;
  issueFocuses: string[];
};

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  description: string;
  organizationType: OrganizationType;
  communityId: string;
  campusCommunityId?: string | null;
  jurisdictionName: string;
  scopeLabel?: string;
  issueTags: string[];
  founderUserId: string;
  founderName: string;
  adminUserIds: string[];
  adminNames: string[];
  memberCount: number;
  activeDebateCount?: number;
  activeVoteCount?: number;
  viewerMembershipRole: OrganizationMembershipRole | null;
  viewerMembershipState: OrganizationMembershipState | null;
  canManage: boolean;
  platformItemCount: number;
  endorsementCount: number;
  announcementCount: number;
  upcomingEventCount?: number;
  petitionCount?: number;
  statementCount?: number;
  createdAt: string;
};

export type OrganizationMembershipSummary = {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  role: OrganizationMembershipRole;
  state: OrganizationMembershipState;
  createdAt: string;
};

export type OrganizationAnnouncementSummary = {
  id: string;
  organizationId: string;
  title: string;
  body: string;
  createdByUserId: string;
  createdByUserName: string;
  createdAt: string;
};

export type OrganizationPlatformItemSummary = {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  issueTag: string;
  status: OrganizationPlatformItemStatus;
  createdByUserId: string;
  createdByUserName: string;
  createdAt: string;
  supportCount: number;
  opposeCount: number;
  viewerVote: OrganizationVoteChoice | null;
};

export type OrganizationVoteSummary = {
  id: string;
  organizationId: string;
  platformItemId: string;
  userId: string;
  choice: OrganizationVoteChoice;
  createdAt: string;
};

export type OrganizationEndorsementSummary = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationType: OrganizationType;
  candidateCampaignId: string;
  electionId: string;
  electionTitle: string;
  candidateName: string;
  officeSought: string;
  statement?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type OrganizationCreationRequestSummary = {
  id: string;
  organizationType: OrganizationType;
  name: string;
  description: string;
  communityId: string;
  campusCommunityId?: string | null;
  requestedByUserId: string;
  requestedByUserName: string;
  issueTags: string[];
  createdAt: string;
};

export type OrganizationDetail = OrganizationSummary & {
  announcements: OrganizationAnnouncementSummary[];
  platformItems: OrganizationPlatformItemSummary[];
  memberships: OrganizationMembershipSummary[];
  endorsements: OrganizationEndorsementSummary[];
  relatedEvents: CommunityEventSummary[];
  relatedDebates: DebateSummary[];
  relatedPetitions: PetitionSummary[];
};

export type CommunityEventSummary = {
  id: string;
  organizationId?: string | null;
  title: string;
  description: string;
  purpose: string;
  jurisdictionName: string;
  startsAt: string;
  endsAt?: string | null;
  eventType: CommunityEventType;
  format: CommunityEventFormat;
  sponsorName: string;
  sponsorType: CommunitySponsorType;
  sponsorUserId?: string | null;
  sponsorHref?: string | null;
  issueLabel?: string | null;
  issueSlug?: string | null;
  locationLabel?: string | null;
  meetingUrl?: string | null;
  interviewRequestId?: string | null;
  interviewerName?: string | null;
  interviewSubjectName?: string | null;
};

export type EventAttendanceSummary = {
  id: string;
  userId: string;
  eventId: string;
  status: EventRsvpStatus;
  confirmedAt?: string | null;
  createdAt: string;
};

export type EventStatementSummary = {
  id: string;
  userId: string;
  eventId: string;
  position: EventStatementPosition;
  createdAt: string;
};

export type EventSentimentSummary = EventStatementSummary;

export type EventProposalSummary = {
  id: string;
  title: string;
  description: string;
  purpose: string;
  jurisdictionName: string;
  startsAt: string;
  eventType: CommunityEventType;
  format: CommunityEventFormat;
  locationLabel?: string | null;
  meetingUrl?: string | null;
  issueLabel?: string | null;
  issueSlug?: string | null;
  proposerUserId: string;
  proposerName: string;
  supporterUserIds: string[];
  approvedByTrustedCitizenId?: string | null;
  promotedEventId?: string | null;
  createdAt: string;
};

export type EventDiscoverySummary = CommunityEventSummary & {
  attendanceCount: number;
  maybeCount: number;
  confirmedCount: number;
  distanceMiles: number;
  distanceLabel: string;
  viewerStatus: EventRsvpStatus | null;
  interestMatch: boolean;
  momentumLabel: "Rising" | "High attendance" | null;
};

export type CommunityHeroSummary = {
  name: string;
  descriptor: string;
  imagePath: string;
  communityType: CommunityType;
  locationLabel?: string | null;
  institutionType?: InstitutionType | null;
  enrollmentSize?: number | null;
};

export type CommunityFavoritePlaceSummary = {
  name: string;
  type: FavoriteSpotType | "activity";
  popularityCount: number;
  contributorNames: string[];
};

export type CommunitySummary = {
  id: string;
  name: string;
  shortName: string;
  descriptor: string;
  communityType: CommunityType;
  scope: VoteQuestionScope;
  primaryJurisdictionName: string;
  jurisdictionMatches: string[];
  imagePath: string;
  locationLabel?: string | null;
  institutionType?: InstitutionType | null;
  enrollmentSize?: number | null;
};

export type ServiceSummary = {
  id: string;
  title: string;
  description: string;
  category: ServiceCategory;
  externalLink: string;
  jurisdictionId: string;
  jurisdictionName: string;
  responsibleEntity: string;
  responsibleOfficialId?: string | null;
  relatedIssue?: string | null;
  createdAt: string;
};

export type SchoolSummary = {
  id: string;
  name: string;
  district: string;
  gradeLevels: SchoolGradeLevels;
  jurisdictionId: string;
  jurisdictionName: string;
  communityId: string;
  enrollment?: number | null;
  studentTeacherRatio?: number | null;
  createdAt: string;
  relatedOfficialIds: string[];
};

export type IssuePrioritySummary = {
  label: string;
  normalizedKey: string;
  rank: number;
  count: number;
  percentage: number;
  relatedPetitionId?: string | null;
  relatedPetitionTitle?: string | null;
  relatedQuestionCount: number;
  relatedPollCount: number;
  relatedEventCount: number;
  relatedGroups: CommunityGroupSummary[];
  topVoiceMatches: Array<{
    id: string;
    name: string;
  }>;
};

export type IssueComparisonRow = {
  label: string;
  selectedCommunityPercentage: number;
  statePercentage: number;
  nationalPercentage: number;
};

export type CommunitySnapshotBreakdownItem = {
  label: string;
  percentage: number;
};

export type CommunitySnapshotSummary = {
  communityId: string;
  labelNote: string;
  registeredVoterBreakdown: CommunitySnapshotBreakdownItem[];
  ageDistribution: CommunitySnapshotBreakdownItem[];
  genderDistribution: CommunitySnapshotBreakdownItem[];
};

export type CommunityCostCategorySummary = {
  label: "Housing" | "Food" | "Transportation" | "Utilities";
  index: number;
  relatedIssue?: string | null;
  relatedOfficialId?: string | null;
};

export type CommunityBudgetBreakdownItem = {
  label: string;
  percentage: number;
  relatedIssue?: string | null;
  relatedOfficialId?: string | null;
};

export type CommunityEconomicsSummary = {
  id: string;
  communityId: string;
  level: CommunityDataLevel;
  levelLabel: string;
  geographyLabel: string;
  dataNote: string;
  costOfLivingIndex: number;
  salesTaxRate?: number | null;
  propertyTaxRateEstimate?: number | null;
  medianHomePrice?: number | null;
  medianRent?: number | null;
  averageIncome?: number | null;
  estimatedAnnualTaxContribution?: number | null;
  costBreakdown: CommunityCostCategorySummary[];
  revenueBreakdown: CommunityBudgetBreakdownItem[];
  spendingBreakdown: CommunityBudgetBreakdownItem[];
};

export type SchoolDetail = SchoolSummary & {
  schoolQuestions: VoteQuestionCardSummary[];
  relatedPolls: PollSummary[];
  topIssues: TopIssueSummary[];
  issueTrends: IssueTrendSummary[];
  relatedPetitions: PetitionSummary[];
  relatedPosts: PostSummary[];
  relatedEvents: CommunityEventSummary[];
  relatedOfficials: OfficialProfileSummary[];
};

export type IssueSnapshotSummary = {
  id: string;
  communityId: string;
  scope: VoteQuestionScope;
  issue: string;
  percentage: number;
  date: string;
};

export type IssueTrendSummary = {
  issue: string;
  currentPercentage: number;
  previousPercentage: number;
  change: number;
  direction: "up" | "down" | "flat";
  snapshots: number[];
};

export type TopIssueSubmissionSummary = {
  id: string;
  userId: string;
  userName: string;
  issueText: string;
  scope: VoteQuestionScope;
  source?: TopIssueSource;
  jurisdictionName: string;
  createdAt: string;
};

export type TopIssueUpvoteSummary = {
  id: string;
  issueId: string;
  userId: string;
  createdAt: string;
};

export type TopIssueSummary = {
  id: string;
  issueText: string;
  scope: VoteQuestionScope;
  jurisdictionName: string;
  source: TopIssueSource;
  createdAt: string;
  createdByUserId?: string | null;
  createdByName?: string | null;
  upvoteCount: number;
  viewerHasUpvoted: boolean;
};

export type IssueLifecycleSummary = {
  currentStage: IssueLifecycleStage;
  petitionSignatureCount?: number;
  petitionSignatureGoal?: number;
  petitionEligibleForCosponsorship?: boolean;
  sponsorshipRequested: boolean;
  explanation: string;
};

export type PublicOpinionSummary = {
  totalVotes: number;
  categoryCounts: Record<VoteQuestionCategory, number>;
};

export type FavoriteSpotSummary = {
  id?: string;
  name: string;
  category: FavoriteSpotType;
  createdAt?: string;
};

export type StructuredProfileValueSummary = {
  value: string;
  isCustom: boolean;
  createdAt?: string;
};

export type ProfileBackgroundSummary = {
  profession: string;
  experience: string;
  professionPublic: boolean;
  experiencePublic: boolean;
  politicalAffiliation: PoliticalAffiliation | "";
  politicalAffiliationPublic: boolean;
};

export type ProfileTagSummary = {
  value: string;
  category: ProfileTagCategory;
  isCustom: boolean;
  isPublic: boolean;
  createdAt?: string;
};

export type RecentVoteSummary = {
  questionId: string;
  questionText: string;
  answer: VoteAnswer;
  scope: VoteQuestionScope;
  jurisdictionName: string;
  createdAt: string;
};

export type UserProfileContentSummary = {
  userId: string;
  profileImageUrl: string;
  bannerImageUrl: string;
  primaryCommunityId: string;
  localIssues: StructuredProfileValueSummary[];
  stateIssues: StructuredProfileValueSummary[];
  nationalIssues: StructuredProfileValueSummary[];
  favoriteSpots: FavoriteSpotSummary[];
  favoriteClasses?: StructuredProfileValueSummary[];
  groupTags: StructuredProfileValueSummary[];
  background: ProfileBackgroundSummary;
  identityTags: ProfileTagSummary[];
  externalLinks: ExternalLinkSummary[];
  campusCommunityIds: string[];
  recentVotesPublic: boolean;
  bookmarkedScopes: VoteQuestionScope[];
};

export type CreditBoostSummary = {
  id: string;
  userId: string;
  targetType: CreditBoostTarget;
  targetId: string;
  createdAt: string;
  creditsSpent: number;
};

export type CreditTransactionSummary = {
  id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number;
  createdAt: string;
};

export type CivicRewardSummary = {
  boostCreditsAvailable: number;
  totalCreditsEarned: number;
  summary: string;
  highlights: Array<{
    label: string;
    description: string;
  }>;
};

export type VotingLibraryFilters = {
  search?: string;
  scope?: VoteQuestionScope | "all";
  category?: VoteQuestionCategory | "all";
  objectType?: VoteObjectType | "all";
};

export type PublicCitizenProfileSummary = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  bio: string | null;
  profileImageUrl?: string | null;
  bannerImageUrl?: string | null;
  jurisdictionName: string;
  followerCount: number;
  followingCount: number;
  trustLevel: TrustLevel;
  influenceLevel: InfluenceLevel;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  publicOpinionSummary: PublicOpinionSummary;
  topIssuesByScope: {
    local: string[];
    state: string[];
    national: string[];
  };
  topIssuesPreview: string[];
  favoriteSpots: FavoriteSpotSummary[];
  studentProfile?: {
    studentVerified: boolean;
    campusName?: string | null;
    favoriteClasses: string[];
  } | null;
  groupTags: string[];
  groupAffiliations: CommunityGroupSummary[];
  campusCommunityIds: string[];
  background: {
    profession?: string | null;
    experience?: string | null;
    politicalAffiliation?: string | null;
  };
  publicIdentityTags: ProfileTagSummary[];
  recentVotesPublic: boolean;
  recentVotes: RecentVoteSummary[];
  publicEndorsements: CitizenEndorsementDisplaySummary[];
  creditBalance: number;
  bookmarkedScopes: VoteQuestionScope[];
};

export type PublicCitizenDirectorySummary = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  bio: string | null;
  profileImageUrl?: string | null;
  jurisdictionName: string;
  campusCommunityIds: string[];
  studentProfile?: {
    studentVerified: boolean;
    campusName?: string | null;
  } | null;
  followerCount: number;
  topIssuesPreview: string[];
  civicCredibility: {
    label: string;
    summary: string;
  };
  trustSignal: {
    label: string;
  };
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
};

export type TopVoiceSummary = {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  profileImageUrl?: string | null;
  jurisdictionName: string;
  bio: string | null;
  followerCount: number;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  recentVoteCount: number;
  topIssuesPreview: string[];
  groupTags: string[];
  groupAffiliations: CommunityGroupSummary[];
  campusCommunityIds: string[];
  boostCount: number;
  badgeLabel: "Top Voice (Local)" | "Top Voice (Issue)";
  featuredReason: string;
  trustLevel: TrustLevel;
  influenceLevel: InfluenceLevel;
  creditBoostedByViewer: boolean;
};

export type PeopleFilterMode = "all" | "trusted" | "followed";

export type UserProgressionSummary = {
  currentRole: UserRole;
  followerCount: number;
  trustedCitizenScopes: TrustedCommunityProgressSummary[];
  steps: Array<{
    role: UserRole;
    label: string;
    state: "complete" | "current" | "upcoming";
    requirement?: string;
  }>;
  nextStepRequirement?: string;
  viewerConnectionLabel?: string;
  highlightedRole?: UserRole | null;
};

export type UserRoleTransitionSummary = {
  id: string;
  userId: string;
  fromRole: UserRole;
  toRole: UserRole;
  createdAt: string;
  targetProfileId?: string | null;
};

export type NotificationSummary = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityId: string;
  contextEntityId?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type DebateRecommendationSummary = {
  id: string;
  category: DebateRecommendationCategory;
  title: string;
  description: string;
  issueText: string;
  jurisdictionName: string;
  href: string;
  callToActionLabel: string;
  reasonLabel: string;
  reasonDescription: string;
  createdAt: string;
  sourceDebateId?: string | null;
  opponentUserId?: string | null;
  opponentName?: string | null;
  opponentRole?: PublicProfileType | null;
  opponentCredibilityLabel?: string | null;
  rewardHint?: string | null;
};

export type NotificationPreferenceSummary = {
  posts: boolean;
  majorActions: boolean;
};

export type IssueFollowSummary = {
  id: string;
  userId: string;
  issueId: string;
  createdAt: string;
};

export type CaseKeyDateSummary = {
  label: string;
  date: string;
};

export type CaseSummary = {
  id: string;
  title: string;
  summary: string;
  courtLevel: CaseCourtLevel;
  stage: CaseStage;
  jurisdictionId: string;
  jurisdictionName: string;
  issueTags: string[];
  keyDates: CaseKeyDateSummary[];
  status: CaseStatus;
  createdAt: string;
  followCount: number;
  supportCount: number;
  viewerIsFollowing: boolean;
  viewerSupports: boolean;
};

export type SupportStatementSummary = {
  id: string;
  caseId: string;
  userId: string;
  userName: string;
  statement: string;
  createdAt: string;
  isPublic: boolean;
};

export type CommunityBriefThemeSummary = {
  id: string;
  caseId: string;
  creatorUserId: string;
  creatorName: string;
  title: string;
  description: string;
  supportCount: number;
  createdAt: string;
  viewerSupports: boolean;
};

export type CaseDetail = CaseSummary & {
  supportStatements: SupportStatementSummary[];
  communityBriefThemes: CommunityBriefThemeSummary[];
};

export type DraftLegislationStatus = "Drafting";
export type MessageFolder = "inbox" | "sent" | "requests";
export type MessageRequestState = "pending" | "accepted" | "ignored" | "blocked" | "reported";
export type MessageAudienceRule = "everyone" | "followersOnly" | "jurisdictionOnly";
export type LegislationChangeVote = "adopt" | "reject";
export type MessageLevel = "local" | "state" | "federal";
export type MessageRouteType = "officialType" | "issueType";
export type MessageSubjectType = "needHelp" | "supportOppose" | "feedbackConcern" | "interviewRequest" | "other";
export type InterviewRequestStatus = "pending" | "accepted" | "completed" | "declined" | "canceled";
export type InterviewRequestFormat = "written" | "video" | "inPerson" | "remote";
export type OfficialHelpCategory =
  | "potholeRoadIssue"
  | "permitsZoning"
  | "schoolDistrictIssue"
  | "utilitiesWater"
  | "publicSafety"
  | "taxesBilling"
  | "housing"
  | "businessLicensing"
  | "other";

export type DraftLegislationSummary = {
  id: string;
  petitionId: string;
  sponsorOfficialId: string;
  sponsorName: string;
  jurisdictionName: string;
  title: string;
  summary: string;
  body: string;
  status: DraftLegislationStatus;
  createdAt: string;
};

export type PublicFigureMessagingSettingsSummary = {
  userId: string;
  audienceRule: MessageAudienceRule;
};

export type MessageThreadSummary = {
  id: string;
  participantUserId: string;
  participantName: string;
  participantRole: UserRole;
  participantProfileId: string;
  participantProfileHref: string;
  jurisdictionName: string;
  requestState: MessageRequestState;
  latestMessagePreview: string;
  latestMessageAt: string;
  unreadCount: number;
  initiatedByUserId: string;
  requestRecipientUserId: string;
  canReply: boolean;
};

export type DirectMessageSummary = {
  id: string;
  threadId: string;
  senderUserId: string;
  senderName: string;
  senderRole: UserRole;
  subjectLine?: string | null;
  level?: MessageLevel | null;
  routeType?: MessageRouteType | null;
  selectedOfficialType?: string | null;
  selectedIssueType?: string | null;
  selectedRecipientProfileId?: string | null;
  subjectType?: MessageSubjectType | null;
  issueCategory?: OfficialHelpCategory | null;
  issueId?: string | null;
  issueText?: string | null;
  supportPosition?: "support" | "oppose" | null;
  body: string;
  createdAt: string;
};

export type InterviewRequestSummary = {
  id: string;
  threadId: string;
  requesterUserId: string;
  requesterName: string;
  recipientUserId: string;
  recipientName: string;
  recipientRole: "candidate" | "official";
  recipientProfileId: string;
  recipientProfileHref: string;
  topicTitle: string;
  issueTags: string[];
  requestedFormat: InterviewRequestFormat;
  proposedQuestions: string;
  status: InterviewRequestStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
  eventStartsAt?: string | null;
  publishedPostId?: string | null;
  publishedPostTitle?: string | null;
};

export type InterviewResponsivenessSummary = {
  acceptedCount: number;
  completedCount: number;
  declinedCount: number;
  noResponseCount: number;
  signalLabel: string | null;
  signalDescription: string;
};

export type PublicProfileInterviewsSummary = {
  requested: InterviewRequestSummary[];
  accepted: InterviewRequestSummary[];
  completed: InterviewRequestSummary[];
  declined: InterviewRequestSummary[];
  noResponse: InterviewRequestSummary[];
  responsiveness: InterviewResponsivenessSummary;
};

export type GuidedMessageRecipientSummary = {
  userId: string;
  profileId: string;
  name: string;
  role: "candidate" | "official";
  officeTitle: string;
  jurisdictionName: string;
  level: MessageLevel;
  audienceRule: MessageAudienceRule;
};

export type MessagingInboxSummary = {
  inbox: MessageThreadSummary[];
  sent: MessageThreadSummary[];
  requests: MessageThreadSummary[];
  settings?: PublicFigureMessagingSettingsSummary | null;
};

export type MessagingThreadDetail = MessageThreadSummary & {
  messages: DirectMessageSummary[];
  viewerIsRecipient: boolean;
  viewerIsSender: boolean;
  interviewRequest?: InterviewRequestSummary | null;
};

export type ProposedChangeSummary = {
  id: string;
  legislationId: string;
  userId: string;
  userName: string;
  changeText: string;
  sectionReference?: string | null;
  createdAt: string;
  adoptCount: number;
  rejectCount: number;
  viewerVote: LegislationChangeVote | null;
  status: "accepted" | "rejected" | "underReview";
};

export type DraftLegislationDetail = DraftLegislationSummary & {
  linkedPetitionTitle: string;
  viewerCanSuggestChanges: boolean;
  viewerHasSignedPetition: boolean;
  proposedChanges: ProposedChangeSummary[];
};

export type DebateParticipantSummary = {
  debateId: string;
  userId: string;
  userName: string;
  side: DebateSide;
  role: DebateParticipantRole;
};

export type DebateTurnSummary = {
  id: string;
  debateId: string;
  side: DebateSide;
  turnType: DebateTurnType;
  statementText: string;
  videoAttachmentUrl?: string | null;
  citations: Array<{
    id: string;
    debateTurnId: string;
    title: string;
    sourceName: string;
    sourceType?: CitationSourceType | null;
    url: string;
    note?: string | null;
    createdAt: string;
  }>;
  createdByUserId: string;
  createdByUserName: string;
  createdAt: string;
  supportCount: number;
  opposeCount: number;
  viewerReaction: DebateTurnReactionType | null;
  fallacyTags: Array<{
    type: DebateFallacyType;
    count: number;
    viewerTagged: boolean;
    agreeCount: number;
    disagreeCount: number;
    viewerReview: DebateFallacyReviewPosition | null;
    status: DebateFallacyStatus;
  }>;
  totalFallacyTagCount: number;
};

export type DebateCommunityVoteOption = "A" | "B" | "noClearWinner";

export type DebateCommunityVoteSummary = {
  id: string;
  debateId: string;
  userId: string;
  vote: DebateCommunityVoteOption;
  createdAt: string;
};

export type DebateDraftSummary = {
  id: string;
  debateId: string;
  side: DebateSide;
  turnType: DebateTurnType;
  statementText: string;
  createdByUserId: string;
  createdByUserName: string;
  createdAt: string;
  voteCount: number;
  viewerHasVoted: boolean;
};

export type DebateCurrentTurnSummary = {
  side: DebateSide;
  sideName: string;
  turnType: DebateTurnType;
  label: string;
  phase: DebateTurnPhase;
  draftOpensAt: string | null;
  draftClosesAt: string | null;
  votingClosesAt: string | null;
  eligibleGroupTag?: string | null;
  draftCount: number;
  voteCount: number;
};

export type DebateSummary = {
  id: string;
  title: string;
  description: string;
  issueId: string;
  issueText: string;
  jurisdictionName: string;
  mode: DebateMode;
  startState: DebateStartState;
  sideAName: string;
  sideBName: string;
  sideAGroupTag?: string | null;
  sideBGroupTag?: string | null;
  createdByUserId: string;
  createdByUserName: string;
  challengedUserId?: string | null;
  challengedUserName?: string | null;
  status: DebateStatus;
  outcomeType?: DebateOutcomeType | null;
  agreedStatement?: string | null;
  createdAt: string;
  closedAt?: string | null;
  turnCount: number;
  currentTurn?: DebateCurrentTurnSummary | null;
  followerCount: number;
  viewerIsFollowing: boolean;
};

export type DebateDetail = DebateSummary & {
  participants: DebateParticipantSummary[];
  turns: DebateTurnSummary[];
  numberOfRounds: number;
  draftWindowHours?: number | null;
  votingWindowHours?: number | null;
  viewerCanParticipate: boolean;
  viewerCanSubmitTurn: boolean;
  viewerCanSubmitDraft: boolean;
  viewerCanVoteOnDrafts: boolean;
  viewerSide?: DebateSide | null;
  currentDrafts: DebateDraftSummary[];
  aiAnalysis: {
    summary: string;
    agreementHighlights: string[];
    keyThemes: string[];
    strongestEvidenceSummaries: string[];
    label: string;
  };
  sentimentSummary: {
    supportCount: number;
    opposeCount: number;
  };
  truthSummary: {
    ratingCount: number;
    leadingLabel: TruthRatingValue | null;
  };
  communityOutcome: {
    winnerSide: DebateSide | null;
    edgeLabel: string;
    sideA: {
      supportCount: number;
      opposeCount: number;
      communitySentimentPercent: number;
    };
    sideB: {
      supportCount: number;
      opposeCount: number;
      communitySentimentPercent: number;
    };
  };
  advancedOutcome: {
    lowParticipation: boolean;
    tooCloseToCall: boolean;
    consensusLevel: "High consensus" | "Moderate consensus" | "Low consensus";
    compositeWinner: DebateSide | null;
    compositeOutcomeLabel: "Shared outcome" | "Side A edge" | "Side B edge" | "Too close to call" | "Low-participation result" | "Closed by withdrawal";
    highestIntegritySide: DebateSide | null;
    sideA: {
      consensusScore: number;
      persuasionScore: number;
      communityVoteScore: number;
      integrityScore: number;
      compositeScore: number;
      convergenceScore: number;
      agreedStatementBonus: number;
      acknowledgmentBonus: number;
    };
    sideB: {
      consensusScore: number;
      persuasionScore: number;
      communityVoteScore: number;
      integrityScore: number;
      compositeScore: number;
      convergenceScore: number;
      agreedStatementBonus: number;
      acknowledgmentBonus: number;
    };
    communityVote: {
      isOpen: boolean;
      closesAt: string | null;
      totalVotes: number;
      viewerVote: DebateCommunityVoteOption | null;
      winner: DebateCommunityVoteOption | null;
      sideA: {
        count: number;
        percentage: number;
      };
      sideB: {
        count: number;
        percentage: number;
      };
      noClearWinner: {
        count: number;
        percentage: number;
      };
    };
  };
  politicalAffiliationSentiment: Array<{
    label: "Democrat" | "Republican" | "Independent / Nonpartisan" | "Other / Prefer not to say";
    sideA: {
      supportCount: number;
      opposeCount: number;
      sentimentPercent: number;
    };
    sideB: {
      supportCount: number;
      opposeCount: number;
      sentimentPercent: number;
    };
  }>;
  fallacySummary: {
    totalTagCount: number;
    supportedTagCount: number;
    sideA: Array<{
      type: DebateFallacyType;
      count: number;
    }>;
    sideB: Array<{
      type: DebateFallacyType;
      count: number;
    }>;
  };
};

export type DebateFollowSummary = {
  id: string;
  userId: string;
  debateId: string;
  createdAt: string;
};

export type DebateFallacyTagSummary = {
  id: string;
  debateTurnId: string;
  userId: string;
  fallacyType: DebateFallacyType;
  createdAt: string;
};

export type DebateFallacyReviewSummary = {
  id: string;
  debateTurnId: string;
  fallacyType: DebateFallacyType;
  userId: string;
  position: DebateFallacyReviewPosition;
  createdAt: string;
};

export type OfficialContactSummary = {
  officialId: string;
  name: string;
  officeTitle: string;
  jurisdictionName: string;
  officialProfileHref: string;
  issueFocuses: string[];
  email?: string | null;
  phone?: string | null;
  officialFormUrl?: string | null;
};

export type ContactActionSummary = {
  id: string;
  userId: string;
  userName: string;
  entityId: string;
  entityType: ContactActionTargetType;
  officialId: string;
  method: ContactMethod;
  createdAt: string;
};

export type ContactOfficialsPanelSummary = {
  entityId: string;
  entityType: ContactActionTargetType;
  contextTitle: string;
  contextSummary: string;
  jurisdictionName: string;
  talkingPoints: string[];
  defaultSubject: string;
  defaultMessage: string;
  officials: OfficialContactSummary[];
  actionCount: number;
  recentActions: Array<{
    userName: string;
    officialName: string;
    method: ContactMethod;
    createdAt: string;
  }>;
};

export type PetitionSummary = {
  id: string;
  creatorId?: string;
  organizationId?: string | null;
  title: string;
  summary: string;
  body?: string;
  issueTags?: string[];
  jurisdictionName: string;
  creatorName: string;
  status: PetitionStatus;
  signatureCount: number;
  signatureGoal: number;
  eligibleForCosponsorship: boolean;
  createdAt: string;
};

export type BallotInitiativeSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  jurisdictionName: string;
  scope: "local" | "state";
  electionId?: string | null;
  officialLanguage?: string | null;
  communitySentiment: {
    support: number;
    oppose: number;
    unclear: number;
  };
  relatedIssues: string[];
  relatedDiscussionPostIds: string[];
  createdAt: string;
};

export type PetitionSignatureSummary = {
  id: string;
  petitionId: string;
  signerId: string;
  signerName: string;
  jurisdictionName: string;
  status: "PENDING" | "VALID" | "REJECTED";
  signedAt: string;
};

export type PetitionDetail = PetitionSummary & {
  body: string;
  canSign: boolean;
  hasSigned: boolean;
  userIsVerified: boolean;
  jurisdictionMatches: boolean;
  isDrafting: boolean;
  canStartDrafting: boolean;
  recentSignatures: PetitionSignatureSummary[];
  lifecycle: IssueLifecycleSummary;
  sponsorshipRequests: SponsorshipRequestSummary[];
};

export type SponsorshipRequestSummary = {
  id: string;
  petitionId: string;
  requesterId: string;
  requesterName: string;
  targetedOfficialIds: string[];
  targetedOfficialNames: string[];
  createdAt: string;
};

export type UserCivicPetitionActivitySummary = {
  petitionId: string;
  title: string;
  summary: string;
  status: CivicPetitionProgressStatus;
  sponsorName?: string | null;
  signedAt: string;
};

export type CampaignPromiseSummary = {
  id: string;
  title: string;
  description: string;
  category?: string | null;
  status?: PromiseStatus | null;
  notes?: string | null;
};

export type OfficialActionSummary = {
  id: string;
  officialProfileId: string;
  officialName: string;
  title: string;
  summary: string;
  actionType: OfficialActionType;
  actionDate: string;
  issueTags: string[];
  sourceType: OfficialActionSourceType;
  sourceLink?: string | null;
  verificationStatus: OfficialActionVerificationStatus;
  accountabilityAlignment?: PublicActionAlignment | null;
  accountabilityReason?: string | null;
  partyAlignment?: PublicActionAlignment | null;
  partyAlignmentReason?: string | null;
  createdAt: string;
  supportCount: number;
  opposeCount: number;
  viewerReaction: OfficialActionReactionType | null;
};

export type OfficialActionReactionSummary = {
  id: string;
  actionId: string;
  userId: string;
  reaction: OfficialActionReactionType;
  createdAt: string;
};

export type OfficialProfileSummary = {
  id: string;
  claimedByUserId?: string | null;
  name: string;
  officeTitle: string;
  jurisdictionName: string;
  party: string;
  bio: string | null;
  profileImageUrl?: string | null;
  platformSummary: string | null;
  donationUrl?: string | null;
  websiteUrl?: string | null;
  isClaimed?: boolean;
  followerCount: number;
  followThroughScore: number | null;
  truthScore?: {
    media: number | null;
    moderators: number | null;
    citizens: number | null;
  };
  fundingBreakdown?: FundingBreakdownItem[];
  industryFundingBreakdown?: FundingIndustryBreakdownItem[];
  pollingComparisons?: PollingComparisonSummary[];
  viewerIsFollowing?: boolean;
  viewerCanFollow?: boolean;
};

export type OfficialProfileDetail = OfficialProfileSummary & {
  recentPosts: PostSummary[];
  linkedUserId?: string | null;
  followingCount: number;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
  campaignPromises: CampaignPromiseSummary[];
  officialActions: OfficialActionSummary[];
};

export type PublicProfileSummary = {
  id: string;
  claimedByUserId?: string | null;
  slug: string;
  name: string;
  profileType: PublicProfileType;
  jurisdictionName: string;
  partyText?: string | null;
  bio: string | null;
  profileImageUrl?: string | null;
  donationUrl?: string | null;
  websiteUrl?: string | null;
  isClaimed: boolean;
  source: PublicProfileSource;
  claimStatus?: ClaimStatus | null;
  followerCount?: number;
  viewerIsFollowing?: boolean;
  viewerCanFollow?: boolean;
};

export type MediaProfileDetail = MediaProfileSummary & {
  recentPosts: PostSummary[];
};

export type OfficialPositionSummary = {
  id: string;
  publicProfileId: string;
  officeTitle: string;
  jurisdictionName: string;
  partyText?: string | null;
  isCurrent: boolean;
  startedAt?: string | null;
  endedAt?: string | null;
};

export type CandidateCampaignSummary = {
  id: string;
  publicProfileId: string;
  electionId: string;
  electionTitle?: string;
  officeSought: string;
  jurisdictionName: string;
  partyText?: string | null;
  campaignStatus: CampaignStatus;
  donationUrl?: string | null;
  websiteUrl?: string | null;
  isIncumbent: boolean;
  totalRaised?: string | null;
  topDonorCategories?: string[];
  pollingSummary?: string | null;
  fundingBreakdown?: FundingBreakdownItem[];
  industryFundingBreakdown?: FundingIndustryBreakdownItem[];
  pollingComparisons?: PollingComparisonSummary[];
  endorsementCount?: number;
  visibleEndorsers?: VisibleCandidateEndorserSummary[];
  viewerEndorsement?: CandidateEndorsementSummary | null;
  viewerElectionEndorsementCampaignId?: string | null;
};

export type CandidateDraftSummary = {
  id: string;
  userId: string;
  electionId: string;
  officeSought: string;
  electionTitle: string;
  jurisdictionName: string;
  electionDate: string;
  bio: string | null;
  campaignPromises: CampaignPromiseSummary[];
  isPublished: boolean;
  publishedCandidateProfileId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RunForOfficeOpportunitySummary = {
  electionId: string;
  electionSlug: string;
  title: string;
  officeTitle: string;
  jurisdictionName: string;
  electionDate: string;
  electionType: ElectionType;
  electionStatus: ElectionStatus;
  basicInfo: string;
  hasExistingDraft: boolean;
  publishedCandidateProfileId?: string | null;
};

export type CandidateEndorsementSummary = {
  id: string;
  userId: string;
  userName: string;
  candidateCampaignId: string;
  electionId: string;
  electionTitle: string;
  candidateName: string;
  officeSought: string;
  isPublic: boolean;
  createdAt: string;
};

export type VisibleCandidateEndorserSummary = {
  userId: string;
  userName: string;
  username: string;
  jurisdictionName: string;
};

export type CitizenEndorsementDisplaySummary = {
  id: string;
  candidateCampaignId: string;
  electionTitle: string;
  candidateName: string;
  officeSought: string;
  jurisdictionName: string;
  createdAt: string;
};

export type ElectionSummary = {
  id: string;
  slug: string;
  title: string;
  officeTitle: string;
  jurisdictionName: string;
  communityId?: string | null;
  ballotSummary?: string | null;
  electionDate: string;
  registrationDeadline?: string | null;
  mailBallotDeadline?: string | null;
  earlyVotingStartsAt?: string | null;
  earlyVotingEndsAt?: string | null;
  pollsCloseAt?: string | null;
  electionType: ElectionType;
  electionStatus: ElectionStatus;
  isCommunityVoteOnly?: boolean;
  authorityLabel?: string | null;
  candidates: CandidateCampaignSummary[];
  ballotInitiatives: BallotInitiativeSummary[];
};

export type CampusElectionVoteSummary = {
  id: string;
  electionId: string;
  candidateCampaignId: string;
  userId: string;
  createdAt: string;
};

export type CandidateProfileDetail = PublicProfileSummary & {
  campaigns: CandidateCampaignSummary[];
  officialPositions: OfficialPositionSummary[];
  recentPosts: PostSummary[];
  campaignPromises: CampaignPromiseSummary[];
  followerCount: number;
  followingCount: number;
  viewerIsFollowing: boolean;
  viewerCanFollow: boolean;
};

export type CandidateMatchBreakdownItem = {
  issue: string;
  userStance: "aligned" | "disagreed" | "prioritized" | "unknown";
  candidateStance: "supports" | "unknown";
  score: -1 | 0 | 1;
  candidateEvidence?: string | null;
};

export type CandidateMatchSummary = {
  candidateId: string;
  campaignId: string;
  candidateName: string;
  matchPercentage: number;
  alignedIssues: string[];
  differingIssues: string[];
  comparedIssueCount: number;
  breakdown: CandidateMatchBreakdownItem[];
};

export type AdminManagedProfileSummary = PublicProfileSummary & {
  officeTitle?: string | null;
  electionTitle?: string | null;
};
