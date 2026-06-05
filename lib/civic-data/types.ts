import type {
  AgendaItemAction,
  BillChamber,
  BillStatus,
  CampaignFinanceFilingType,
  CandidateStatus,
  CommitteeMemberRole,
  CommitteeType,
  DistrictType,
  ElectionStatus,
  ElectionResultStatus,
  ElectionType,
  InitiativeStatus,
  JurisdictionType,
  LegislativeVoteChoice,
  LegislativeVoteResult,
  MeetingStatus,
  MeetingType,
  OfficeLevel,
  OfficeSelectionMethod,
  OfficialStatus,
  OrganizationType,
  PoliticalAdMedium,
  BallotQuestionType,
  PetitionLifecycleStatus,
  SourceSyncStatus,
  SourceType,
} from "@prisma/client";

export type CivicSourceAdapterKey =
  | "nevada-legislature"
  | "nevada-state-government"
  | "nevada-federal-delegation"
  | "nevada-secretary-of-state"
  | "reno"
  | "carson-city"
  | "washoe-county"
  | "unr"
  | "asun";

export type CivicSourceDefinition = {
  name: string;
  slug: string;
  sourceType: SourceType;
  url: string;
  adapterKey: CivicSourceAdapterKey;
  jurisdictionSlug: string;
  description: string;
};

export type ImportMode = "manual" | "scheduled";

export type IngestionContext = {
  source: CivicSourceDefinition;
  mode: ImportMode;
  cursor?: string | null;
  requestedAt: Date;
};

export type IngestionIssue = {
  severity: "info" | "warning" | "error";
  message: string;
  externalId?: string;
};

export type NormalizedJurisdiction = {
  externalId: string;
  name: string;
  slug: string;
  type: JurisdictionType;
  parentSlug?: string;
  code?: string;
};

export type NormalizedOffice = {
  externalId: string;
  jurisdictionSlug: string;
  districtExternalId?: string;
  slug: string;
  title: string;
  level: OfficeLevel;
  selectionMethod: OfficeSelectionMethod;
  termLengthYears?: number;
  seats?: number;
  description?: string;
};

export type NormalizedOfficial = {
  externalId: string;
  officeExternalId: string;
  jurisdictionSlug: string;
  districtExternalId?: string;
  fullName: string;
  partyText?: string;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  photoUrl?: string;
  status: OfficialStatus;
  termStart?: string;
  termEnd?: string;
};

export type NormalizedDistrict = {
  externalId: string;
  jurisdictionSlug: string;
  slug: string;
  name: string;
  districtType: DistrictType;
  code?: string;
  boundaryGeoJson?: unknown;
};

export type NormalizedElection = {
  externalId: string;
  jurisdictionSlug: string;
  officeExternalId?: string;
  districtExternalId?: string;
  slug: string;
  title: string;
  officeTitle: string;
  electionDate: string;
  electionType: ElectionType;
  status: ElectionStatus;
};

export type NormalizedCandidate = {
  externalId: string;
  electionExternalId: string;
  jurisdictionSlug: string;
  officeExternalId?: string;
  districtExternalId?: string;
  fullName: string;
  partyText?: string;
  ballotName?: string;
  websiteUrl?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  campaignStatement?: string;
  socialLinks?: unknown;
  sourceUrl?: string;
  filingStatus?: string;
  filingDate?: string;
  status: CandidateStatus;
  isIncumbent?: boolean;
};

export type NormalizedElectionResult = {
  externalId: string;
  electionExternalId: string;
  candidateExternalId?: string;
  jurisdictionSlug?: string;
  reportingArea?: string;
  resultStatus: ElectionResultStatus;
  votes: number;
  votePercentage?: number;
  rank?: number;
  isWinner?: boolean;
};

export type NormalizedBallotInitiative = {
  externalId: string;
  electionExternalId: string;
  jurisdictionSlug: string;
  slug: string;
  title: string;
  summary?: string;
  measureNumber?: string;
  fullTextUrl?: string;
  status: InitiativeStatus;
  petitionStatus?: PetitionLifecycleStatus;
  resultStatus?: ElectionResultStatus;
  yesVotes?: number;
  noVotes?: number;
  totalVotes?: number;
  passed?: boolean;
};

export type NormalizedBallotQuestion = {
  externalId: string;
  electionExternalId: string;
  initiativeExternalId?: string;
  jurisdictionSlug: string;
  slug: string;
  questionNumber?: string;
  title: string;
  summary?: string;
  officialText?: string;
  questionType: BallotQuestionType;
  petitionStatus?: PetitionLifecycleStatus;
  resultStatus?: ElectionResultStatus;
  yesVotes?: number;
  noVotes?: number;
  totalVotes?: number;
  passed?: boolean;
  fullTextUrl?: string;
};

export type NormalizedLegislativeBill = {
  externalId: string;
  jurisdictionSlug: string;
  session: string;
  billNumber: string;
  title: string;
  summary?: string;
  chamber: BillChamber;
  status: BillStatus;
  introducedAt?: string;
  lastActionAt?: string;
  billUrl?: string;
  sponsorOfficialExternalIds?: string[];
};

export type NormalizedLegislativeVote = {
  externalId: string;
  billExternalId: string;
  chamber: BillChamber;
  voteDate: string;
  motion: string;
  result: LegislativeVoteResult;
  yeas?: number;
  nays?: number;
  abstentions?: number;
  absences?: number;
  records: Array<{
    officialExternalId: string;
    choice: LegislativeVoteChoice;
  }>;
};

export type NormalizedCommittee = {
  externalId: string;
  jurisdictionSlug: string;
  slug: string;
  name: string;
  committeeType: CommitteeType;
  chamber?: BillChamber;
  description?: string;
  websiteUrl?: string;
  members?: Array<{
    officialExternalId: string;
    role: CommitteeMemberRole;
  }>;
};

export type NormalizedMeeting = {
  externalId: string;
  jurisdictionSlug: string;
  committeeExternalId?: string;
  title: string;
  meetingType: MeetingType;
  status: MeetingStatus;
  startsAt: string;
  endsAt?: string;
  location?: string;
  meetingUrl?: string;
  agendaUrl?: string;
  minutesUrl?: string;
  videoUrl?: string;
};

export type NormalizedAgendaItem = {
  externalId: string;
  meetingExternalId: string;
  billExternalId?: string;
  itemNumber?: string;
  title: string;
  description?: string;
  actionType: AgendaItemAction;
  orderIndex?: number;
};

export type NormalizedCampaignFinanceFiling = {
  externalId: string;
  jurisdictionSlug: string;
  candidateExternalId?: string;
  organizationExternalId?: string;
  filingType: CampaignFinanceFilingType;
  filerName: string;
  periodStart?: string;
  periodEnd?: string;
  filedAt?: string;
  amountRaised?: string;
  amountSpent?: string;
  filingUrl?: string;
  rawData?: unknown;
};

export type NormalizedOrganization = {
  externalId: string;
  jurisdictionSlug?: string;
  slug: string;
  name: string;
  description?: string;
  organizationType: OrganizationType;
  websiteUrl?: string;
  contactEmail?: string;
  issueTags?: string[];
};

export type NormalizedPoliticalAdvertisement = {
  externalId: string;
  jurisdictionSlug: string;
  candidateExternalId?: string;
  organizationExternalId?: string;
  title: string;
  sponsorName: string;
  medium: PoliticalAdMedium;
  firstSeenAt?: string;
  lastSeenAt?: string;
  amountSpent?: string;
  targetSummary?: string;
  creativeUrl?: string;
  archiveUrl?: string;
  rawData?: unknown;
};

export type NormalizedCivicData = {
  jurisdictions: NormalizedJurisdiction[];
  offices: NormalizedOffice[];
  officials: NormalizedOfficial[];
  districts: NormalizedDistrict[];
  elections: NormalizedElection[];
  candidates: NormalizedCandidate[];
  electionResults: NormalizedElectionResult[];
  ballotInitiatives: NormalizedBallotInitiative[];
  ballotQuestions: NormalizedBallotQuestion[];
  legislativeBills: NormalizedLegislativeBill[];
  legislativeVotes: NormalizedLegislativeVote[];
  committees: NormalizedCommittee[];
  meetings: NormalizedMeeting[];
  agendaItems: NormalizedAgendaItem[];
  campaignFinanceFilings: NormalizedCampaignFinanceFiling[];
  organizations: NormalizedOrganization[];
  politicalAdvertisements: NormalizedPoliticalAdvertisement[];
};

export type IngestionResult = {
  sourceSlug: string;
  status: SourceSyncStatus;
  cursor?: string | null;
  data: NormalizedCivicData;
  issues: IngestionIssue[];
  recordsSeen: number;
  recordsChanged: number;
};

export type CivicDataAdapter = {
  key: CivicSourceAdapterKey;
  displayName: string;
  supportsIncremental: boolean;
  supportsScheduled: boolean;
  sync(context: IngestionContext): Promise<IngestionResult>;
};
