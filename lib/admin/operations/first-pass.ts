import { nonPersonExtractionReason, routineReportingExclusion, type ReportingSubject } from "@/lib/public-meetings/reporting-policy";

export type IdentityCandidate = { personName: string; organizationId: string | null; attendanceStatus: string; matchConfidence: string; votingEligibility: string; sourceSnippet: string };
export function identityReviewBuckets(records: IdentityCandidate[]) {
  const buckets = new Map<string, { itemId: string; personName: string; organizationId: string; attendanceStatus: string; count: number; sample: string }>();
  for (const record of records) {
    if (record.matchConfidence !== "unmatched_name" || record.votingEligibility !== "eligible_voting_member") continue;
    const key = `${record.personName}|${record.organizationId ?? "unknown"}|${record.attendanceStatus}`;
    const current = buckets.get(key) ?? { itemId: `identity-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, personName: record.personName, organizationId: record.organizationId ?? "unknown", attendanceStatus: record.attendanceStatus, count: 0, sample: record.sourceSnippet };
    current.count++;
    buckets.set(key, current);
  }
  const unique = new Map<string, ReturnType<typeof buckets.get> & { variantNames: string[] }>();
  for (const item of buckets.values()) {
    const prior = unique.get(item.itemId);
    if (prior) { prior.count += item.count; prior.variantNames.push(item.personName); }
    else unique.set(item.itemId, { ...item, variantNames: [item.personName] });
  }
  return [...unique.values()].sort((a, b) => b.count - a.count || a.personName.localeCompare(b.personName));
}

export function firstPassVote(item: ReportingSubject & { reason?: string; source_url?: string | null }, reviewType: string) {
  const exclusion = routineReportingExclusion(item);
  if (exclusion) return { status: "reviewed_no_change", category: exclusion, notes: `Automated first pass: excluded from voter reporting by the standing routine-business policy (${exclusion}). Original source retained. No individual vote attribution approved.` };
  if (!item.source_url) return { status: "needs_source", category: "missing_source", notes: "Automated first pass: no source URL. Obtain the official minutes and isolate this action before approving an outcome or individual votes." };
  if (reviewType === "attendance_review") return { status: "needs_roster", category: "attendance_evidence_required", notes: `Automated first pass: retain for reporting consideration. Verify the voting membership and attendance for this specific meeting date against the official minutes; current membership alone is insufficient. Blocker: ${item.reason ?? "attendance unverified"}. No votes inferred.` };
  return { status: "needs_source", category: reviewType === "distribution_review" ? "vote_distribution_required" : "explicit_outcome_required", notes: `Automated first pass: retain for reporting consideration. ${reviewType === "distribution_review" ? "Reconcile the recorded tally with the meeting-date roster, absences, recusals and explicit named votes; do not assign an aggregate tally to individuals." : "Locate the exact motion and recorded result in the official minutes; a proposal, mover or seconder is not evidence of a yes vote."} Blocker: ${item.reason ?? "source evidence incomplete"}.` };
}

export function firstPassIdentity(name: string) {
  const reason = nonPersonExtractionReason(name);
  return reason
    ? { status: "reviewed_no_change", category: reason, notes: `Automated first pass: this extracted value is a heading/role or narrative fragment, not a usable person identity (${reason}). Suppressed from voter attribution; original source retained.` }
    : { status: "needs_roster", category: "historical_membership_required", notes: "Automated first pass: identity remains unverified. Match the source spelling to the governing body's roster on this meeting date, confirm voting eligibility, and check the person appears in the cited attendance section. Do not guess from a surname or current officeholder list." };
}
