export type Perspective = {
  label: string;
  headline: string;
  summary: string;
  question: string;
};

export type ChallengeTopic = {
  id: string;
  category: string;
  statement: string;
  context: string;
  caseFor: Perspective;
  caseAgainst: Perspective;
  shared: string[];
  evidence: string[];
  people: string[];
  options: string[];
  communityAdded?: boolean;
};
