type CanonicalIssueTopic = {
  title: string;
  summary: string;
  aliases: string[];
};

const CANONICAL_ISSUE_TOPICS: CanonicalIssueTopic[] = [
  {
    title: "Teacher Pay",
    summary: "Teacher compensation, retention, staffing stability, and the classroom support needed to keep schools staffed well.",
    aliases: [
      "teacher retention",
      "teacher staffing",
      "teacher support",
      "teacher vacancy",
      "classroom support",
      "school staffing",
      "education funding",
    ],
  },
  {
    title: "Education",
    summary: "School district decisions, classroom resources, school board governance, student services, and public education outcomes.",
    aliases: ["school district", "school board", "public education", "students", "teachers", "classroom", "curriculum"],
  },
  {
    title: "School Safety",
    summary: "School emergency readiness, mental health support, and safer learning environments.",
    aliases: ["school safety", "mental health staff", "school facilities", "safer schools"],
  },
  {
    title: "Affordable Housing",
    summary: "Housing costs, housing supply, approvals, renter pressure, and the affordability of staying in a community.",
    aliases: [
      "housing affordability",
      "housing costs",
      "housing supply",
      "housing approvals",
      "downtown growth",
      "zoning / permits",
      "cost of living",
    ],
  },
  {
    title: "Water Access",
    summary: "Water planning, drought readiness, conservation, utilities reliability, and long-term community water resilience.",
    aliases: [
      "water planning",
      "water resilience",
      "water policy",
      "drought readiness",
      "utilities water",
      "conservation",
      "water management",
    ],
  },
  {
    title: "Public Safety",
    summary: "Emergency readiness, staffing, neighborhood safety, road safety, and how public institutions respond to local safety concerns.",
    aliases: ["emergency readiness", "road safety", "public safety staffing", "wildfire readiness", "neighborhood traffic", "police", "fire", "sheriff"],
  },
  {
    title: "Criminal Justice",
    summary: "Courts, policing, prosecution, sentencing, detention, wrongful conviction claims, and public accountability in the justice system.",
    aliases: ["criminal justice", "wrongful conviction", "sentencing", "prosecution", "public defender", "jail", "detention", "courts"],
  },
  {
    title: "Healthcare Access",
    summary: "Healthcare affordability, insurance costs, access to care, and the day-to-day burden of staying healthy.",
    aliases: ["healthcare affordability", "healthcare costs", "insurance costs", "access to care"],
  },
  {
    title: "Campaign Finance Transparency",
    summary: "Money in politics, disclosure, campaign finance reporting, and clearer public visibility into who is funding civic power.",
    aliases: [
      "campaign finance transparency",
      "campaign money",
      "money in politics",
      "campaign disclosure",
      "government transparency",
      "open records",
      "public accountability",
    ],
  },
  {
    title: "Government Accountability",
    summary: "Transparency, ethics, public records, open meetings, conflicts of interest, and whether government decisions can be understood and reviewed.",
    aliases: ["government accountability", "government transparency", "public records", "open records", "ethics", "conflicts of interest", "audit"],
  },
  {
    title: "Growth and Infrastructure",
    summary: "Growth planning, roads, traffic, infrastructure sequencing, and how communities phase development responsibly.",
    aliases: ["growth planning", "infrastructure sequencing", "road capacity", "roads", "traffic", "economic development", "infrastructure"],
  },
  {
    title: "Transportation",
    summary: "Roads, transit, traffic safety, mobility access, capital projects, and how people move through their community.",
    aliases: ["transportation", "transit", "traffic", "road improvements", "road projects", "mobility", "bus", "sidewalk"],
  },
  {
    title: "Land Use and Zoning",
    summary: "Development approvals, zoning, planning, permits, short-term rentals, and neighborhood land-use decisions.",
    aliases: ["zoning", "land use", "planning commission", "development", "short-term rentals", "building permit", "permit operations", "subdivision"],
  },
  {
    title: "Taxes and Spending",
    summary: "Budgets, public spending, taxes, fees, debt, grants, contracts, revenue authority, and fiscal choices by public bodies.",
    aliases: ["taxes", "spending", "budget", "fiscal impact", "financial impact", "revenue", "expense", "bond", "grant", "contract", "fees"],
  },
  {
    title: "Elections",
    summary: "Election administration, voting access, ballot initiatives, election challenges, campaign rules, and voter trust.",
    aliases: ["election", "elections", "voting access", "ballot question", "ballot initiative", "election administration", "campaign rules"],
  },
  {
    title: "Environment",
    summary: "Environmental protection, natural resources, conservation, wildfire risk, climate resilience, and public land stewardship.",
    aliases: ["environment", "conservation", "wildfire", "climate", "natural resources", "air quality", "public lands"],
  },
  {
    title: "Public Meeting Access",
    summary: "Meeting access, livestreams, summaries, case materials, and the clarity residents need to participate meaningfully.",
    aliases: [
      "public meeting access",
      "meeting access",
      "meeting summaries",
      "budget clarity",
      "plain-language budgets",
      "public accountability",
      "government transparency",
    ],
  },
  {
    title: "Government Ethics",
    summary: "Ethics rules, stock trading restrictions, conflicts of interest, and the standards people expect from public power.",
    aliases: ["stock trading by members of congress", "congressional stock trading", "ethics reform", "government ethics"],
  },
  {
    title: "Energy Reliability",
    summary: "Power reliability, production, grid planning, and the costs households absorb when energy systems are unstable.",
    aliases: ["energy reliability", "power costs", "energy production", "utility rates"],
  },
  {
    title: "Courts and Legal Rights",
    summary: "Public court records, appeals, administrative proceedings, legal rights, and official legal decisions that affect civic life.",
    aliases: [
      "court records",
      "appeals",
      "judicial opinion",
      "civil appeal",
      "criminal appeal",
      "original proceeding",
      "administrative hearing",
      "legal rights",
      "regulatory proceeding",
    ],
  },
];

export function getCanonicalIssueTopics() {
  return CANONICAL_ISSUE_TOPICS;
}

export function getCanonicalIssueTitles() {
  return CANONICAL_ISSUE_TOPICS.map((topic) => topic.title);
}

export function normalizeIssueText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function slugifyIssueText(value: string) {
  return normalizeIssueText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function tokenizeIssueText(value: string) {
  return normalizeIssueText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function buildTopicVariants(topic: CanonicalIssueTopic) {
  return [topic.title, ...topic.aliases];
}

function getIssueTopicMatchScore(issueText: string, topic: CanonicalIssueTopic) {
  const normalizedIssue = normalizeIssueText(issueText);
  const issueTokens = new Set(tokenizeIssueText(issueText));

  let score = 0;

  for (const variant of buildTopicVariants(topic)) {
    const normalizedVariant = normalizeIssueText(variant);

    if (normalizedIssue === normalizedVariant) {
      score = Math.max(score, 10);
      continue;
    }

    if (normalizedIssue.includes(normalizedVariant) || normalizedVariant.includes(normalizedIssue)) {
      score = Math.max(score, 8);
      continue;
    }

    const variantTokens = tokenizeIssueText(variant);
    const overlap = variantTokens.filter((token) => issueTokens.has(token)).length;

    if (overlap >= 2) {
      score = Math.max(score, 6 + overlap);
    } else if (overlap === 1) {
      score = Math.max(score, 3);
    }
  }

  return score;
}

export function getCanonicalIssueTopic(issueText: string) {
  const ranked = CANONICAL_ISSUE_TOPICS
    .map((topic) => ({
      topic,
      score: getIssueTopicMatchScore(issueText, topic),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score >= 6 ? ranked[0].topic : null;
}

export function getCanonicalIssueText(issueText: string) {
  return getCanonicalIssueTopic(issueText)?.title ?? issueText.trim();
}

export function getCanonicalIssueTextOrNull(issueText: string) {
  return getCanonicalIssueTopic(issueText)?.title ?? null;
}

export function canonicalizeIssueTags(issueTags: Array<string | null | undefined>, limit = 6) {
  const deduped = new Set<string>();

  for (const issueTag of issueTags) {
    if (!issueTag?.trim()) {
      continue;
    }

    const canonical = getCanonicalIssueTextOrNull(issueTag);

    if (canonical) {
      deduped.add(canonical);
    }
  }

  return [...deduped].slice(0, limit);
}

export function getIssueTopicSummary(issueText: string) {
  return (
    getCanonicalIssueTopic(issueText)?.summary ??
    "A public-interest topic hub that groups together related civic activity, people, and actions across the platform."
  );
}

export function getIssueTopicAliases(issueText: string) {
  const topic = getCanonicalIssueTopic(issueText);
  return topic ? [topic.title, ...topic.aliases] : [issueText];
}

export function issueTextMatchesQuery(issueText: string, query: string) {
  if (!query.trim()) {
    return true;
  }

  const normalizedQuery = normalizeIssueText(query);
  return getIssueTopicAliases(issueText).some((variant) => {
    const normalizedIssue = normalizeIssueText(variant);

    if (normalizedIssue.includes(normalizedQuery)) {
      return true;
    }

    const issueTokens = new Set(tokenizeIssueText(variant));
    return tokenizeIssueText(query).some((token) => issueTokens.has(token));
  });
}

export function valuesMatchIssueText(issueText: string, ...values: Array<string | null | undefined>) {
  const issueVariants = getIssueTopicAliases(issueText);

  return values.some((value) => {
    if (!value) {
      return false;
    }

    return issueVariants.some((variant) => {
      const normalizedIssue = normalizeIssueText(variant);
      const normalizedValue = normalizeIssueText(value);

      if (normalizedValue.includes(normalizedIssue) || normalizedIssue.includes(normalizedValue)) {
        return true;
      }

      const haystack = new Set(tokenizeIssueText(value));
      return tokenizeIssueText(variant).some((token) => haystack.has(token));
    });
  });
}
