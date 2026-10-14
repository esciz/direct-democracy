export type PublicDecisionTrustState = "approved" | "ready" | "needs_review";

export type PublicDecisionTrustInput = {
  reviewStatus?: string | null;
  confidence?: number | null;
  sourceReferences?: unknown[] | null;
};

export type PublicDecisionTrustView = {
  state: PublicDecisionTrustState;
  label: string;
  shortLabel: string;
  description: string;
  tone: "green" | "cyan" | "amber";
  priority: number;
  isPublicSpotlightReady: boolean;
};

const TRUST_VIEWS: Record<PublicDecisionTrustState, PublicDecisionTrustView> = {
  approved: {
    state: "approved",
    label: "Reviewed source-backed",
    shortLabel: "reviewed",
    description: "This decision has reviewed source evidence and is ready for normal public display.",
    tone: "green",
    priority: 1,
    isPublicSpotlightReady: true,
  },
  ready: {
    state: "ready",
    label: "Source-backed preview",
    shortLabel: "preview",
    description: "Official source evidence exists, but outcome, roll-call, or impact details may still be incomplete.",
    tone: "cyan",
    priority: 2,
    isPublicSpotlightReady: true,
  },
  needs_review: {
    state: "needs_review",
    label: "Needs review",
    shortLabel: "limited",
    description: "This item is held in a limited-data state until source review or extraction gaps are resolved.",
    tone: "amber",
    priority: 3,
    isPublicSpotlightReady: false,
  },
};

export function normalizeDecisionTrustState(input: PublicDecisionTrustInput): PublicDecisionTrustState {
  const reviewStatus = input.reviewStatus?.toLowerCase().trim() ?? "";
  if (reviewStatus === "approved" || reviewStatus === "reviewed" || reviewStatus === "verified") return "approved";
  if (reviewStatus === "ready" || reviewStatus === "source_backed" || reviewStatus === "source-backed") return "ready";
  if (reviewStatus.includes("review") || reviewStatus.includes("limited")) return "needs_review";
  if ((input.sourceReferences?.length ?? 0) > 0 && (input.confidence ?? 0) >= 0.9) return "ready";
  return "needs_review";
}

export function getDecisionTrustView(input: PublicDecisionTrustInput): PublicDecisionTrustView {
  return TRUST_VIEWS[normalizeDecisionTrustState(input)];
}

export function compareDecisionTrustThenDate<T extends PublicDecisionTrustInput & { meeting?: { date?: string | null } }>(left: T, right: T) {
  const trustDiff = getDecisionTrustView(left).priority - getDecisionTrustView(right).priority;
  if (trustDiff !== 0) return trustDiff;
  return (Date.parse(right.meeting?.date ?? "") || 0) - (Date.parse(left.meeting?.date ?? "") || 0);
}

