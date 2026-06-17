import { getPublicBallotMeasures, getPublicImportedCandidates, getPublicImportedElections } from "@/lib/civic-data/public";
import type { CandidateCampaignSummary, CandidateProfileDetail, PublicProfileSummary, ElectionSummary } from "@/types/domain";

function getDisplayJurisdictionName(slug: string, name: string) {
  if (slug === "reno") return "Reno, Nevada";
  if (slug === "washoe-county") return "Washoe County, Nevada";
  if (slug === "carson-city") return "Carson City, Nevada";
  if (slug === "united-states") return "United States";
  return name;
}

function getCommunityIdForJurisdiction(slug: string) {
  if (slug === "washoe-county") return "washoe-county";
  if (slug === "carson-city") return "carson-city";
  if (slug === "reno") return "reno";
  if (slug === "united-states") return "united-states";
  if (slug === "nevada") return "nevada";
  return slug;
}

function slugifyCandidateName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCandidateDataWarnings(candidate: Awaited<ReturnType<typeof getPublicImportedCandidates>>[number]) {
  const warnings: string[] = [];

  if (!candidate.officeTitle) warnings.push("Office needs review");
  if (!candidate.districtName) warnings.push("District not listed");
  if (!candidate.partyText) warnings.push("Party not listed");
  if (!candidate.source && !candidate.sourceUrl) warnings.push("Source link missing");
  if (!candidate.campaignStatement && !candidate.websiteEnrichment?.shortBio) warnings.push("Profile enrichment pending");

  return warnings;
}

function mapImportedCandidateToProfile(candidate: Awaited<ReturnType<typeof getPublicImportedCandidates>>[number]): PublicProfileSummary {
  const displayName = candidate.ballotName ?? candidate.fullName;
  const jurisdictionName = getDisplayJurisdictionName(candidate.jurisdictionSlug, candidate.jurisdictionName);
  const sourceUrl = candidate.sourceUrl ?? candidate.source?.url ?? null;
  const enrichedWebsiteUrl = candidate.websiteEnrichment?.campaignWebsiteUrl ?? candidate.websiteEnrichment?.officialWebsiteUrl ?? null;
  const enrichedBio = candidate.websiteEnrichment?.shortBio ?? null;
  const enrichedHeadshotUrl = candidate.websiteEnrichment?.headshotUrl ?? null;
  const warnings = getCandidateDataWarnings(candidate);

  return {
    id: candidate.id,
    claimedByUserId: null,
    slug: `imported-${slugifyCandidateName(displayName)}-${candidate.id}`,
    name: displayName,
    profileType: "candidate",
    jurisdictionName,
    partyText: candidate.partyText,
    bio:
      enrichedBio ??
      candidate.campaignStatement ??
      `${displayName} is an imported Nevada candidate record for ${candidate.officeTitle ?? "Office needs review"} in ${candidate.electionTitle}. Profile enrichment pending.`,
    profileImageUrl: enrichedHeadshotUrl ?? candidate.photoUrl,
    donationUrl: null,
    websiteUrl: enrichedWebsiteUrl ?? candidate.websiteUrl,
    isClaimed: false,
    source: "admin",
    claimStatus: "UNCLAIMED",
    followerCount: undefined,
    viewerIsFollowing: false,
    viewerCanFollow: false,
    isImported: true,
    sourceLabel: candidate.source?.name ?? "Imported Nevada beta data",
    sourceUrl,
    importedCandidate: {
      electionId: candidate.electionId,
      electionSlug: candidate.electionSlug,
      electionTitle: candidate.electionTitle,
      electionDate: candidate.electionDate.toISOString(),
      officeTitle: candidate.officeTitle,
      districtName: candidate.districtName,
      candidateStatus: candidate.status,
      filingStatus: candidate.filingStatus,
      filingDate: candidate.filingDate?.toISOString() ?? null,
      sourceLabel: candidate.source?.name ?? "Imported Nevada beta data",
      sourceUrl,
      websiteEnrichment: candidate.websiteEnrichment
        ? {
            campaignWebsiteUrl: candidate.websiteEnrichment.campaignWebsiteUrl,
            officialWebsiteUrl: candidate.websiteEnrichment.officialWebsiteUrl,
            headshotUrl: candidate.websiteEnrichment.headshotUrl,
            shortBio: candidate.websiteEnrichment.shortBio,
            longBioSourceUrl: candidate.websiteEnrichment.longBioSourceUrl,
            socialLinks: candidate.websiteEnrichment.socialLinks,
            publicContactEmail: candidate.websiteEnrichment.publicContactEmail,
            publicContactPhone: candidate.websiteEnrichment.publicContactPhone,
            sourceName: candidate.websiteEnrichment.sourceName,
            sourceUrl: candidate.websiteEnrichment.sourceUrl,
            lastEnrichedAt: candidate.websiteEnrichment.lastEnrichedAt?.toISOString() ?? null,
            enrichmentStatus: candidate.websiteEnrichment.enrichmentStatus,
            reviewStatus: candidate.websiteEnrichment.reviewStatus,
          }
        : null,
      knowledgeEnrichments: candidate.knowledgeEnrichments.map((entry) => ({
        id: entry.id,
        sourceUrl: entry.sourceUrl,
        sourceName: entry.sourceName,
        sourceType: entry.sourceType,
        sourcePriority: entry.sourcePriority,
        title: entry.title,
        aboutSummary: entry.aboutSummary,
        ownWordsSummary: entry.ownWordsSummary,
        issues: entry.issues,
        experienceSummary: entry.experienceSummary,
        financeContext: entry.financeContext,
        newsItems: entry.newsItems,
        socialLinks: entry.socialLinks,
        confidenceScore: entry.confidenceScore,
        reviewStatus: entry.reviewStatus,
        lastUpdatedAt: entry.lastUpdatedAt.toISOString(),
      })),
      dataWarnings: warnings,
    },
  };
}

function mapImportedCandidateToCampaign(candidate: Awaited<ReturnType<typeof getPublicImportedCandidates>>[number]): CandidateCampaignSummary {
  const jurisdictionName = getDisplayJurisdictionName(candidate.jurisdictionSlug, candidate.jurisdictionName);

  return {
    id: `campaign_${candidate.id}`,
    publicProfileId: candidate.id,
    electionId: candidate.electionId,
    electionTitle: candidate.electionTitle,
    officeSought: candidate.officeTitle ?? "Office needs review",
    jurisdictionName,
    partyText: candidate.partyText,
    campaignStatus: "ANNOUNCED",
    donationUrl: null,
    websiteUrl: candidate.websiteEnrichment?.campaignWebsiteUrl ?? candidate.websiteEnrichment?.officialWebsiteUrl ?? candidate.websiteUrl,
    isIncumbent: false,
    totalRaised: null,
    topDonorCategories: [],
    pollingSummary: null,
    fundingBreakdown: [],
    industryFundingBreakdown: [],
    pollingComparisons: [],
    endorsementCount: 0,
    visibleEndorsers: [],
    viewerEndorsement: null,
    viewerElectionEndorsementCampaignId: null,
    isImported: true,
    sourceLabel: candidate.source?.name ?? "Imported Nevada beta data",
    sourceUrl: candidate.sourceUrl ?? candidate.source?.url ?? null,
    filingStatus: candidate.filingStatus,
    filingDate: candidate.filingDate?.toISOString() ?? null,
    districtName: candidate.districtName,
  };
}

function getElectionStatus(status: string): ElectionSummary["electionStatus"] {
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "COMPLETED") return "COMPLETED";
  return "UPCOMING";
}

function getElectionType(type: string): ElectionSummary["electionType"] {
  if (type === "PRIMARY") return "PRIMARY";
  if (type === "SPECIAL") return "SPECIAL";
  if (type === "RUNOFF") return "RUNOFF";
  if (type === "LOCAL") return "LOCAL";
  return "GENERAL";
}

function getSourceLinks(election: Awaited<ReturnType<typeof getPublicImportedElections>>[number]) {
  const links = [
    election.source?.url ? { label: election.source.name, url: election.source.url } : null,
  ];
  const title = election.title.toLowerCase();
  const jurisdictionSlug = election.jurisdiction.slug;

  if (title.includes("2026")) {
    links.push({ label: "Nevada SOS 2026 Election Information", url: "https://www.nvsos.gov/sos/elections/election-information/2026-election-information" });
  }

  if (jurisdictionSlug === "washoe-county" || jurisdictionSlug === "reno" || title.includes("2026 nevada primary")) {
    links.push({ label: "Washoe County 2026 Primary Election", url: "https://www.washoecounty.gov/voters/information/index.php" });
    links.push({ label: "Washoe County 2026 Election Data", url: "https://www.washoecounty.gov/voters/data/elections/2026.php" });
  }

  if (jurisdictionSlug === "carson-city") {
    links.push({ label: "Carson City Clerk-Recorder Elections", url: "https://www.carson.org/government/departments-a-f/clerk-recorder/elections" });
  }

  return links.filter((link): link is { label: string; url: string } => Boolean(link));
}

function getDeadlineNotes(election: Awaited<ReturnType<typeof getPublicImportedElections>>[number]) {
  const title = election.title.toLowerCase();

  if (title.includes("2026") && title.includes("primary")) {
    return [
      "Primary Election Day: Tuesday, June 9, 2026.",
      "Washoe County lists early voting for the 2026 primary from May 23, 2026 through June 5, 2026.",
      "Use the official Secretary of State and county links for registration, sample ballot, and vote center details.",
    ];
  }

  if (title.includes("2026") && title.includes("general")) {
    return [
      "General Election Day: Tuesday, November 3, 2026.",
      "Local county election offices publish vote centers, sample ballots, and county-specific deadlines as the election approaches.",
    ];
  }

  if (title.includes("2024")) {
    return ["Historical imported election record. Results and ballot question outcomes should be checked against official result sources."];
  }

  return ["Official deadlines are not fully normalized yet. Use source links for the authoritative election calendar."];
}

export async function getImportedElectionSummaries(): Promise<ElectionSummary[]> {
  const [elections, candidates, ballotMeasures] = await Promise.all([
    getPublicImportedElections(),
    getPublicImportedCandidates(),
    getPublicBallotMeasures(),
  ]);

  return elections
    .map((election) => {
      const jurisdictionName = getDisplayJurisdictionName(election.jurisdiction.slug, election.jurisdiction.name);
      const electionCandidates = candidates.filter((candidate) => candidate.electionTitle === election.title);
      const electionMeasures = ballotMeasures.filter((measure) => measure.electionTitle === election.title);

      return {
        id: election.id,
        slug: election.slug,
        title: election.title,
        officeTitle: election.officeTitle,
        jurisdictionName,
        communityId: getCommunityIdForJurisdiction(election.jurisdiction.slug),
        ballotSummary: `${election.title} imported from ${election.source?.name ?? "Nevada beta data"}.`,
        electionDate: election.electionDate.toISOString(),
        registrationDeadline: null,
        mailBallotDeadline: null,
        earlyVotingStartsAt: null,
        earlyVotingEndsAt: null,
        pollsCloseAt: null,
        electionType: getElectionType(election.electionType),
        electionStatus: getElectionStatus(election.status),
        authorityLabel: election.source?.name ?? "Imported Nevada beta data",
        sourceLabel: election.source?.name ?? "Imported Nevada beta data",
        sourceUrl: election.source?.url ?? null,
        sourceLinks: getSourceLinks(election),
        deadlineNotes: getDeadlineNotes(election),
        isImported: true,
        importedCandidates: electionCandidates.map((candidate) => ({
          id: candidate.id,
          fullName: candidate.fullName,
          ballotName: candidate.ballotName,
          partyText: candidate.partyText,
          officeTitle: candidate.officeTitle,
          districtName: candidate.districtName,
          jurisdictionName: candidate.jurisdictionName,
          status: candidate.status,
          websiteUrl: candidate.websiteUrl,
          email: candidate.email,
          phone: candidate.phone,
          photoUrl: candidate.photoUrl,
          campaignStatement: candidate.campaignStatement,
          sourceUrl: candidate.sourceUrl ?? candidate.source?.url ?? null,
          filingStatus: candidate.filingStatus,
          filingDate: candidate.filingDate?.toISOString() ?? null,
          sourceLabel: candidate.source?.name ?? "Imported Nevada beta data",
        })),
        importedRecordsNeedingReview: [
          ...electionCandidates
            .filter((candidate) => !candidate.officeTitle || !candidate.jurisdictionName || !candidate.source)
            .map((candidate) => ({
              id: candidate.id,
              recordType: "candidate" as const,
              title: candidate.fullName,
              reason: !candidate.officeTitle ? "Missing office link" : !candidate.jurisdictionName ? "Missing jurisdiction" : "Missing source",
              sourceLabel: candidate.source?.name ?? null,
            })),
          ...electionMeasures
            .filter((measure) => !measure.jurisdictionName || !measure.source)
            .map((measure) => ({
              id: measure.id,
              recordType: "ballotQuestion" as const,
              title: measure.title,
              reason: !measure.jurisdictionName ? "Missing jurisdiction" : "Missing source",
              sourceLabel: measure.source?.name ?? null,
            })),
        ],
        candidates: [],
        ballotInitiatives: electionMeasures.map((measure) => ({
          id: measure.id,
          slug: measure.slug,
          title: measure.questionNumber ? `${measure.questionNumber}: ${measure.title}` : measure.title,
          summary: measure.summary ?? "Imported Nevada ballot question record.",
          jurisdictionName: measure.jurisdictionName,
          scope: measure.jurisdictionName === "Nevada" ? "state" : "local",
          electionId: election.id,
          officialLanguage: null,
          communitySentiment: {
            support: measure.passed === true ? 1 : 0,
            oppose: measure.passed === false ? 1 : 0,
            unclear: measure.passed === null ? 1 : 0,
          },
          relatedIssues: [],
          relatedDiscussionPostIds: [],
          createdAt: election.electionDate.toISOString(),
        })),
      } satisfies ElectionSummary;
    })
    .sort((left, right) => Date.parse(left.electionDate) - Date.parse(right.electionDate));
}

export async function getImportedElectionById(id: string): Promise<ElectionSummary | null> {
  return (await getImportedElectionSummaries()).find((election) => election.id === id || election.slug === id) ?? null;
}

export async function getImportedCandidateProfiles(): Promise<PublicProfileSummary[]> {
  return (await getPublicImportedCandidates()).map((candidate) => mapImportedCandidateToProfile(candidate));
}

export async function getImportedCandidateProfileById(id: string): Promise<CandidateProfileDetail | null> {
  const candidate = (await getPublicImportedCandidates()).find((entry) => entry.id === id);

  if (!candidate) {
    return null;
  }

  return {
    ...mapImportedCandidateToProfile(candidate),
    campaigns: [mapImportedCandidateToCampaign(candidate)],
    officialPositions: [],
    recentPosts: [],
    campaignPromises: [],
    followerCount: 0,
    followingCount: 0,
    viewerIsFollowing: false,
    viewerCanFollow: false,
  };
}
