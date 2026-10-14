import type { DebateFallacyType } from "@/types/domain";

export const DEBATE_FALLACY_TYPES: DebateFallacyType[] = [
  "Ad Hominem",
  "Straw Man",
  "Red Herring",
  "False Dichotomy",
  "Slippery Slope",
  "Appeal to Emotion",
  "Hasty Generalization",
  "Circular Reasoning",
  "Whataboutism",
];

export const DEBATE_FALLACY_DEFINITIONS: Record<DebateFallacyType, string> = {
  "Ad Hominem": "Attacks the person instead of answering the argument itself.",
  "Straw Man": "Misstates the other side's point so it is easier to attack.",
  "Red Herring": "Pulls attention toward a side topic instead of the core question.",
  "False Dichotomy": "Presents only two choices when more realistic options exist.",
  "Slippery Slope": "Claims one step will inevitably trigger a chain of extreme outcomes.",
  "Appeal to Emotion": "Leans on fear, anger, or sympathy instead of evidence and reasoning.",
  "Hasty Generalization": "Draws a broad conclusion from too little evidence.",
  "Circular Reasoning": "Uses the conclusion as part of its own proof.",
  Whataboutism: "Deflects criticism by pointing to another issue instead of addressing the claim directly.",
};
