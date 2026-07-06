import type { PublicIssueHubSummary, VoteQuestionScope } from "@/types/domain";

import { getIssueTopicSummary, slugifyIssueText } from "@/lib/issues/utils";

export type IssueFrame = {
  supportLabel: string;
  opposeLabel: string;
  supportActionLabel: string;
  opposeActionLabel: string;
  neutralPrompt: string;
};

export type PublicDiscussionIssue = {
  issueText: string;
  scope: VoteQuestionScope;
  jurisdictionName: string;
  category: string;
  whyThisMatters: string;
};

const DEFAULT_FRAME: IssueFrame = {
  supportLabel: "Build support or expand action",
  opposeLabel: "Slow, limit, or challenge action",
  supportActionLabel: "Support this direction",
  opposeActionLabel: "Challenge this direction",
  neutralPrompt: "Explain the tradeoff",
};

const ISSUE_FRAMES: Array<{ match: string[]; frame: IssueFrame }> = [
  {
    match: ["tax", "spending", "budget", "revenue", "deficit"],
    frame: {
      supportLabel: "Expand public spending or revenue",
      opposeLabel: "Curtail taxes, spending, or debt",
      supportActionLabel: "Support expanding investment",
      opposeActionLabel: "Support fiscal restraint",
      neutralPrompt: "Explain the fiscal tradeoff",
    },
  },
  {
    match: ["housing", "zoning", "land use", "growth"],
    frame: {
      supportLabel: "Expand supply, development, or access",
      opposeLabel: "Limit pace, impact, or displacement",
      supportActionLabel: "Support expanding access",
      opposeActionLabel: "Support tighter limits",
      neutralPrompt: "Explain the housing tradeoff",
    },
  },
  {
    match: ["abortion", "birth control", "reproductive"],
    frame: {
      supportLabel: "Protect reproductive access",
      opposeLabel: "Restrict or regulate access",
      supportActionLabel: "Support access protections",
      opposeActionLabel: "Support restrictions",
      neutralPrompt: "Explain the rights and regulation tradeoff",
    },
  },
  {
    match: ["birthright citizenship", "immigration", "citizenship", "border"],
    frame: {
      supportLabel: "Protect current citizenship or immigration access",
      opposeLabel: "Restrict eligibility or enforcement scope",
      supportActionLabel: "Support broader eligibility",
      opposeActionLabel: "Support tighter limits",
      neutralPrompt: "Explain the citizenship tradeoff",
    },
  },
  {
    match: ["foreign", "war", "military", "entanglement", "aid", "defense"],
    frame: {
      supportLabel: "Sustain engagement or security commitments",
      opposeLabel: "Reduce foreign commitments or military exposure",
      supportActionLabel: "Support engagement",
      opposeActionLabel: "Support restraint",
      neutralPrompt: "Explain the foreign-policy tradeoff",
    },
  },
  {
    match: ["gun", "firearm", "second amendment"],
    frame: {
      supportLabel: "Expand gun regulation or safety requirements",
      opposeLabel: "Protect firearm access or limit regulation",
      supportActionLabel: "Support more regulation",
      opposeActionLabel: "Support fewer restrictions",
      neutralPrompt: "Explain the safety and rights tradeoff",
    },
  },
  {
    match: ["healthcare", "insurance", "medicine"],
    frame: {
      supportLabel: "Expand coverage, subsidies, or access",
      opposeLabel: "Limit costs, mandates, or government role",
      supportActionLabel: "Support expanded access",
      opposeActionLabel: "Support limiting government role",
      neutralPrompt: "Explain the healthcare tradeoff",
    },
  },
  {
    match: ["school", "education", "teacher"],
    frame: {
      supportLabel: "Expand school funding, staffing, or services",
      opposeLabel: "Limit mandates, costs, or governance reach",
      supportActionLabel: "Support expanded school investment",
      opposeActionLabel: "Support limits or alternatives",
      neutralPrompt: "Explain the education tradeoff",
    },
  },
  {
    match: ["energy", "environment", "climate", "water"],
    frame: {
      supportLabel: "Expand conservation, resilience, or regulation",
      opposeLabel: "Limit costs, mandates, or restrictions",
      supportActionLabel: "Support environmental action",
      opposeActionLabel: "Support cost or mandate limits",
      neutralPrompt: "Explain the resource tradeoff",
    },
  },
];

export const PUBLIC_DISCUSSION_ISSUES: PublicDiscussionIssue[] = [
  {
    issueText: "Reproductive rights, abortion, and birth control access",
    scope: "national",
    jurisdictionName: "United States",
    category: "Civil Rights",
    whyThisMatters: "Residents debate access to abortion, contraception, privacy, medical decision-making, state authority, and religious or moral objections.",
  },
  {
    issueText: "Birthright citizenship and immigration eligibility",
    scope: "national",
    jurisdictionName: "United States",
    category: "Immigration",
    whyThisMatters: "This issue covers citizenship rules, constitutional interpretation, immigration enforcement, family stability, public benefits, and national identity.",
  },
  {
    issueText: "Foreign entanglements, military aid, and war powers",
    scope: "national",
    jurisdictionName: "United States",
    category: "Foreign Policy",
    whyThisMatters: "People disagree about when the United States should fund allies, use military force, avoid overseas conflicts, or prioritize domestic needs.",
  },
  {
    issueText: "Gun rights and firearm regulation",
    scope: "national",
    jurisdictionName: "United States",
    category: "Public Safety",
    whyThisMatters: "This issue weighs public safety, constitutional rights, background checks, ownership rules, enforcement, and community violence prevention.",
  },
  {
    issueText: "Taxes, spending, debt, and household take-home pay",
    scope: "national",
    jurisdictionName: "United States",
    category: "Budget",
    whyThisMatters: "Residents debate public services, taxes, deficits, debt, affordability, and who should pay for government priorities.",
  },
  {
    issueText: "Free speech, online moderation, and platform power",
    scope: "national",
    jurisdictionName: "United States",
    category: "Civil Liberties",
    whyThisMatters: "This issue covers speech protections, misinformation, platform moderation, government pressure, and private-company influence over public debate.",
  },
  {
    issueText: "Policing, prosecution, sentencing, and public safety reform",
    scope: "national",
    jurisdictionName: "United States",
    category: "Criminal Justice",
    whyThisMatters: "People debate safety, accountability, sentencing, jail and prison policy, prosecution priorities, policing standards, and rights of the accused.",
  },
  {
    issueText: "School curriculum, parent rights, and student services",
    scope: "national",
    jurisdictionName: "United States",
    category: "Education",
    whyThisMatters: "This issue includes curriculum, parental authority, student support, school boards, book challenges, classroom speech, and public education trust.",
  },
];

export function getIssueFrame(issueText: string): IssueFrame {
  const normalized = issueText.toLowerCase();
  return ISSUE_FRAMES.find((entry) => entry.match.some((term) => normalized.includes(term)))?.frame ?? DEFAULT_FRAME;
}

export function publicDiscussionIssueToSummary(issue: PublicDiscussionIssue): PublicIssueHubSummary {
  return {
    id: `issue_topic_${slugifyIssueText(issue.issueText)}`,
    issueText: issue.issueText,
    plainTitle: issue.issueText,
    scope: issue.scope,
    jurisdictionName: issue.jurisdictionName,
    source: "curated",
    createdAt: "2026-07-05T00:00:00.000Z",
    createdByUserId: null,
    createdByName: "Direct Democracy issue catalog",
    upvoteCount: 0,
    viewerHasUpvoted: false,
    category: issue.category,
    sourceBacked: false,
    sourceCount: 0,
    linkedMeetingsCount: 0,
    linkedVotesCount: 0,
    linkedCourtRecordsCount: 0,
    linkedAgendaItemsCount: 0,
    linkedCommunitySubmissionCount: 0,
    sourceDocumentCount: 0,
    lastUpdatedAt: null,
    whyThisMatters: issue.whyThisMatters || getIssueTopicSummary(issue.issueText),
  };
}
