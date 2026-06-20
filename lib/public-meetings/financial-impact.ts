import type {
  MeetingVotingCardFinancialImpactContext,
  MeetingVotingCardFinancialImpactType,
  MeetingVotingCardTaxImpactStatus,
} from "@/lib/public-meetings/types";

type FinancialImpactInput = {
  financialImpact?: string | null;
  fiscalImpactSummary?: string | null;
  sourceText?: string | null;
  sourceSnippet?: string | null;
};

const TAX_COST_CONTEXT_PREFIX = "Tax / cost impact:";
const UNKNOWN_TAX_COST_SUMMARY = "The source lists a financial impact, but does not state whether this directly changes voter taxes or fees.";
const NEEDS_REVIEW_TAX_COST_SUMMARY = "This may involve tax, fee, bond, debt, or long-term cost impacts. Source review needed.";

function normalizeWhitespace(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function summarizeText(value: string | null | undefined, maxLength = 700) {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function extractAmounts(text: string) {
  return unique(text.match(/\$[\d,]+(?:\.\d+)?(?:\s+(?:million|billion|thousand)|\s*[mbk]\b)?/gi) ?? []);
}

function extractFiscalYear(text: string) {
  return text.match(/\b(?:fiscal\s+year|fy)\s*(20\d{2})(?:[-/](\d{2,4}))?\b/i)?.[0] ?? null;
}

function extractFundSource(text: string) {
  const fund = text.match(/\b([A-Z][A-Za-z0-9&'.,/ -]{2,80}?\s+Fund)\b/);
  if (fund?.[1]) {
    return normalizeWhitespace(fund[1])
      .replace(/^(?:augment|increase|decrease|transfer|authorize|approve|accept|amend)\s+(?:the\s+)?/i, "")
      .replace(/[.;:,]+$/, "");
  }
  const grant = text.match(/\b([A-Z][A-Za-z0-9&'.,/ -]{2,80}?\s+Grant)\b/);
  if (grant?.[1]) {
    return normalizeWhitespace(grant[1])
      .replace(/^(?:augment|increase|decrease|transfer|authorize|approve|accept|amend)\s+(?:the\s+)?/i, "")
      .replace(/[.;:,]+$/, "");
  }
  return null;
}

function has(pattern: RegExp, text: string) {
  return pattern.test(text);
}

function detectImpactTypes(text: string): MeetingVotingCardFinancialImpactType[] {
  const types: MeetingVotingCardFinancialImpactType[] = [];
  if (has(/\b(revenue|income|receipts?)\b/i, text)) types.push("revenue");
  if (has(/\b(expense|expenditure|spending|cost|appropriat(?:e|ion)|contract|purchase|award)\b/i, text)) types.push("expense");
  if (has(/\b(transfer|interfund|move funds?)\b/i, text)) types.push("transfer");
  if (has(/\b(bonds?|debt|loan|lease revenue bonds?|general obligation|go bonds?|financ(?:e|ing))\b/i, text)) types.push("bond_debt");
  if (has(/\b(fee|fees|rate|rates|charge|charges|surcharge|assessment)\b/i, text)) types.push("fee");
  if (has(/\b(grant|federal funds?|state grant|reimbursement)\b/i, text)) types.push("grant");
  if (has(/\b(enterprise fund|utility fund|water fund|sewer fund|building and safety fund)\b/i, text)) types.push("enterprise_fund");
  if (has(/\b(tax|taxes|property tax|sales tax|ad valorem)\b/i, text)) types.push("tax");
  if (has(/\b(existing funds?|available funds?|fund balance|budgeted funds?|approved budget)\b/i, text)) types.push("existing_fund");
  if (has(/\b(authority|budget authority|revenue and expense authority|augment|augmentation|increase fiscal year)\b/i, text)) types.push("budget_authority");
  return unique(types.length ? types : ["unknown"]);
}

function directTaxImpactStatus(text: string, types: MeetingVotingCardFinancialImpactType[]): MeetingVotingCardTaxImpactStatus {
  if (has(/\b(increase|raise|impose|levy|new|additional|higher)\b[^.]{0,80}\b(tax|property tax|sales tax|fee|fees|rate|rates|assessment|surcharge)\b/i, text)) return "stated";
  if (has(/\b(tax|property tax|sales tax)\b/i, text) && has(/\b(bond|debt|levy|rate|increase|raise|impose)\b/i, text)) return "needs_review";
  if (types.includes("bond_debt")) return "needs_review";
  if (types.includes("grant") || types.includes("existing_fund") || types.includes("enterprise_fund") || types.includes("budget_authority")) return "unlikely";
  if (types.includes("fee") || types.includes("revenue")) return "unknown";
  return "unknown";
}

function buildTaxCostSummary(input: {
  amount: string | null;
  fundSource: string | null;
  fiscalYear: string | null;
  types: MeetingVotingCardFinancialImpactType[];
  directTaxImpact: MeetingVotingCardTaxImpactStatus;
  text: string;
}) {
  const { amount, fundSource, fiscalYear, types, directTaxImpact, text } = input;
  const amountText = amount ? `${amount} ` : "";
  const fundText = fundSource ? `${fundSource} ` : "";
  const yearText = fiscalYear ? `${fiscalYear} ` : "";

  if (directTaxImpact === "stated") {
    if (types.includes("tax")) return `Source states a direct tax impact: ${summarizeText(text, 220)}`;
    return `Source states a direct fee impact: ${summarizeText(text, 220)}`;
  }

  if (types.includes("bond_debt") || directTaxImpact === "needs_review") {
    return NEEDS_REVIEW_TAX_COST_SUMMARY;
  }

  if (types.includes("budget_authority") && types.includes("revenue") && types.includes("expense")) {
    const subject = normalizeWhitespace(`${amountText}${fundText}revenue/expense authority increase`).trim();
    const yearClause = yearText ? ` for ${yearText.trim()}` : "";
    return `The source identifies a ${subject}${yearClause}. It does not state a direct property-tax or sales-tax increase for voters.`;
  }

  if (types.includes("grant")) {
    return `This appears to use grant funding${amount ? ` (${amount})` : ""}; direct voter tax impact not stated.`;
  }

  if (types.includes("existing_fund") || types.includes("enterprise_fund")) {
    return "This appears to use existing funds; direct voter tax impact not stated.";
  }

  if (types.includes("fee") || types.includes("revenue")) {
    return UNKNOWN_TAX_COST_SUMMARY;
  }

  return UNKNOWN_TAX_COST_SUMMARY;
}

function buildBadges(types: MeetingVotingCardFinancialImpactType[], directTaxImpact: MeetingVotingCardTaxImpactStatus) {
  const badges = ["Financial impact found"];
  if (directTaxImpact === "unknown") badges.push("Direct tax impact unknown");
  if (directTaxImpact === "needs_review") badges.push("Needs tax/debt review");
  if (directTaxImpact === "stated") badges.push("Direct tax/fee stated");
  if (types.includes("fee") || types.includes("revenue")) badges.push("Fee/revenue authority");
  if (directTaxImpact === "unlikely" || types.includes("existing_fund") || types.includes("enterprise_fund") || types.includes("budget_authority")) {
    badges.push("Existing fund / unlikely direct tax impact");
  }
  if (types.includes("grant")) badges.push("Grant funding");
  if (types.includes("bond_debt")) badges.push("Bond/debt review");
  return unique(badges);
}

export function parseMeetingVotingCardFinancialImpact(input: FinancialImpactInput): MeetingVotingCardFinancialImpactContext | null {
  const conciseText = normalizeWhitespace([input.fiscalImpactSummary, input.financialImpact].filter(Boolean).join(" "));
  const sourceText = normalizeWhitespace([conciseText, input.sourceSnippet, input.sourceText].filter(Boolean).join(" "));
  const sourceHasAmount = /\$[\d,]+(?:\.\d+)?/i.test(sourceText);
  const sourceHasFiscalContext = /\b(fiscal impact|financial impact|budget|grant|fee|fees|tax|taxes|bond|bonds|debt|revenue|expense|appropriation|contract|purchase|award|funding|funded|expenditure|cost)\b/i.test(sourceText);
  const hasFinancialSignal = Boolean(conciseText) || (sourceHasAmount && sourceHasFiscalContext);
  if (!hasFinancialSignal) return null;

  const amounts = extractAmounts(sourceText);
  const types = detectImpactTypes(sourceText);
  const directTaxImpact = directTaxImpactStatus(sourceText, types);
  const fundSource = extractFundSource(sourceText);
  const fiscalYear = extractFiscalYear(sourceText);
  const sourceSnippet = summarizeText(input.sourceSnippet || conciseText || sourceText, 420);
  const taxCostSummary = buildTaxCostSummary({
    amount: amounts[0] ?? null,
    fundSource,
    fiscalYear,
    types,
    directTaxImpact,
    text: sourceSnippet,
  });

  return {
    amount: amounts[0] ?? null,
    amounts,
    fund_source: fundSource,
    fiscal_year: fiscalYear,
    impact_types: types,
    direct_tax_impact: directTaxImpact,
    tax_cost_summary: taxCostSummary,
    plain_english_summary: taxCostSummary,
    source_snippet: sourceSnippet || null,
    badges: buildBadges(types, directTaxImpact),
    confidence: directTaxImpact === "stated" || directTaxImpact === "needs_review" ? 0.76 : 0.82,
    needs_review: directTaxImpact === "needs_review",
  };
}

export function appendTaxCostContext(summary: string, context: MeetingVotingCardFinancialImpactContext | null | undefined) {
  if (!context?.tax_cost_summary) return summary;
  if (summary.includes(TAX_COST_CONTEXT_PREFIX)) return summary;
  return `${summary}\n\n${TAX_COST_CONTEXT_PREFIX} ${context.tax_cost_summary}`;
}

export function extractTaxCostContext(summary: string | null | undefined) {
  if (!summary) return null;
  const match = summary.match(/Tax \/ cost impact:\s*([\s\S]+)$/i);
  return match?.[1]?.trim() || null;
}

export function taxCostImpactBadge(summary: string | null | undefined) {
  const text = normalizeWhitespace(summary).toLowerCase();
  if (!text) return null;
  if (text.includes("source states a direct tax impact") || text.includes("source states a direct fee impact")) {
    return { label: "Direct tax/fee stated", tone: "stated" as const };
  }
  if (text.includes("source review needed") || text.includes("bond") || text.includes("debt")) {
    return { label: "Needs tax/debt review", tone: "review" as const };
  }
  if (text.includes("does not state a direct property-tax or sales-tax increase") || text.includes("existing funds") || text.includes("grant funding")) {
    return { label: "Existing fund / unlikely direct tax impact", tone: "unlikely" as const };
  }
  return { label: "Direct tax impact unknown", tone: "unknown" as const };
}

export function stripTaxCostContext(summary: string | null | undefined) {
  if (!summary) return summary;
  return summary.replace(/\n\nTax \/ cost impact:\s*[\s\S]+$/i, "").trim();
}
