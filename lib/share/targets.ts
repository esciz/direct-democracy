export type ShareEntityType =
  | "post"
  | "newsStory"
  | "petition"
  | "event"
  | "debate"
  | "case"
  | "issue"
  | "candidateProfile"
  | "officialProfile"
  | "organization"
  | "election";

export type ShareTargetSummary = {
  entityType: ShareEntityType;
  entityId: string;
  title: string;
  href: string;
  summary?: string | null;
  issueTag?: string | null;
};

export function buildSharePostHref(target: ShareTargetSummary) {
  const params = new URLSearchParams({
    shareEntityType: target.entityType,
    shareEntityId: target.entityId,
    shareTitle: target.title,
    shareHref: target.href,
  });

  if (target.summary?.trim()) {
    params.set("shareSummary", target.summary.trim());
  }

  if (target.issueTag?.trim()) {
    params.set("shareIssueTag", target.issueTag.trim());
  }

  return `/posts/create?${params.toString()}`;
}

export function getShareEntityLabel(entityType: ShareEntityType) {
  switch (entityType) {
    case "post":
      return "Perspective";
    case "newsStory":
      return "News Story";
    case "petition":
      return "Petition";
    case "event":
      return "Event";
    case "debate":
      return "Debate";
    case "case":
      return "Case";
    case "issue":
      return "Issue";
    case "candidateProfile":
      return "Candidate Profile";
    case "officialProfile":
      return "Official Profile";
    case "organization":
      return "Organization";
    case "election":
      return "Election";
  }
}
