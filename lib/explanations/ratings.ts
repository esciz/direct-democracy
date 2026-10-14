import type { MediaBiasSummary, PostSummary, TruthMeterSummary } from "@/types/domain";

export function getTruthAiSummary(post: PostSummary, meter: TruthMeterSummary) {
  const title = post.title ? `${post.title}. ` : "";
  const summary = `${title}This claim is being read as a factual statement about public events, policy, or conditions. The community truth distribution shows where readers think the post is well-supported and where they think context is still missing.`;
  const supportCue =
    post.content.length > 180
      ? `Key supporting context in the post focuses on ${post.content.slice(0, 160).trim()}...`
      : `Key supporting context in the post focuses on ${post.content.trim()}`;
  const disputedCue =
    meter.totalRatings > 1
      ? "Missing or disputed context may include omitted tradeoffs, unclear sourcing, or differences between a narrow claim and a broader interpretation."
      : "There is still limited community review, so some disagreement may simply reflect missing context rather than a settled dispute.";
  const disagreementCue =
    "Raters may disagree because some readers focus on the core factual claim while others weigh framing, omitted details, or uncertainty around the evidence.";

  return {
    summary,
    bullets: [supportCue, disputedCue, disagreementCue],
  };
}

export function getBiasAiSummary(outletName: string, biasSummary: MediaBiasSummary) {
  const label = biasSummary.label ?? "mixed";
  return {
    summary: `${outletName} is being read by users as having a ${label.toLowerCase()} framing pattern. This does not determine whether the reporting is true or false; it describes how readers perceive tone, emphasis, and viewpoint.`,
    bullets: [
      "Tone and framing style can feel more values-driven, more institutional, or more oppositional depending on the language choices in coverage.",
      "Readers often infer bias from what gets emphasized first: costs, institutions, individual impact, accountability, or ideological framing.",
      "Different audiences can read the same story differently, so the user-rated aggregate remains primary and this summary is only context.",
    ],
  };
}
