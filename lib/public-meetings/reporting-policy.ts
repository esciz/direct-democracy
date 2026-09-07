/** Source records are retained. This policy controls voter-facing reporting only. */
export const REPORTING_POLICY_VERSION = "2026-09-07.2";
export type ReportingSubject = {
  reporting_policy?: "retain_for_source_review";
  title?: string | null; source_title?: string | null; source_text?: string | null;
  sourceSnippet?: string | null; source_snippet?: string | null;
  source_snippets?: string[]; description?: string | null;
  sourceReferences?: Array<{ snippet?: string | null }>;
};

export function routineReportingExclusion(item: ReportingSubject): string | null {
  if (item.reporting_policy === "retain_for_source_review") return null;
  const title = (item.source_title || item.title || "").replace(/\s+/g, " ").trim();
  const evidence = [title, item.source_text, item.sourceSnippet, item.source_snippet,
    item.description, ...(item.source_snippets ?? []), ...(item.sourceReferences ?? []).map(ref => ref.snippet)].filter(Boolean).join(" ");
  // Mixed items and substantive consent agendas must survive. A mention of old
  // minutes in a policy decision is not itself a reason to exclude that decision.
  if (/\$\s*\d|\b(?:budget|contracts?|agreements?|ordinances?|zoning|rezone|permits?|tax(?:es)?|fees?|appropriat\w*|purchase|grant|lease|litigation|settlement|land\s+use|appointments?|election|public\s+hearing|consent\s+(?:agenda|calendar)|resolutions?|procurement|salary|benefits|policy\s+(?:change|amendment))\b/i.test(evidence)) return null;
  const heading = title.slice(0, 260);
  if (/\b(?:approv(?:al|e|ing|ed)|adopt(?:ion|ed)?|accept(?:ance|ed)?)\b[^.!?;]{0,100}\bminutes\b/i.test(heading)
    || /^(?:\d+[.)]\s*)?(?:approval\s+of\s+)?(?:regular\s+|special\s+|meeting\s+)?minutes\b/i.test(heading)) return "routine_minutes_approval";
  if (/\b(?:approv(?:al|e|ing|ed)|adopt(?:ion|ed)?)\b[^.!?;]{0,65}\bagenda\b/i.test(heading)) return "routine_agenda_approval";
  if (/^(?:(?:needs review:|\d+[.)])\s*)*(?:adjournment|adjourn(?:\s+the)?\s+meeting)[\s.:;-]*$/i.test(title)) return "routine_adjournment";
  return null;
}

/** Reject only clear parser fragments; unfamiliar names still require a roster. */
export function nonPersonExtractionReason(name: string): string | null {
  const normalized = name.replace(/\s+/g, " ").trim();
  if (/\b(?:motioned|moved\s+to|seconded|for\s+possible|items?\s+for|modification\s+of|citizens?\s+participation|public\s+comment|call\s+to\s+order|report\s+by\s+the|regarding\s+a|opened\s+the|motion\s+carried|recommending\s+committee\s+report)\b/i.test(normalized)) return "narrative_fragment_not_person";
  if (/^(?:consent|deputy|boards?|city|council|city council|business|reports?|llc|legal counsel(?: s)?|administrative assistant legal|superintendent of schools|abstain|commission|arts commission|coordinator|finance\s*-\s*purchasing|resolutions\s*-\s*consent|director's business|unlv|aicp|cfm)$/i.test(normalized)) return "heading_or_role_not_person";
  return null;
}
