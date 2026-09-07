import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { routineReportingExclusion, REPORTING_POLICY_VERSION, nonPersonExtractionReason } from "@/lib/public-meetings/reporting-policy";
import { buildAccountabilityGraph } from "@/lib/community/accountability-graph";
import { hasInstalledCivicRelease } from "@/lib/dataops/installed-release";

// Run after release restoration as well as on worker-generated data. Never
// modify source meeting items, documents, or source action-result evidence.
export function applyReportingPolicy(root = process.cwd()) {
  const dir = path.join(root, "data/generated");
  const read = (name: string, fallback: any = []) => existsSync(path.join(dir, name)) ? JSON.parse(readFileSync(path.join(dir, name), "utf8")) : fallback;
  const write = (name: string, value: unknown) => writeFileSync(path.join(dir, name), `${JSON.stringify(value)}\n`);
  const audit = read("public-meeting-vote-extraction-audit.json", {});
  const prior = read("public-meeting-reporting-policy-audit.json", { excludedItems: [] });
  const excluded = new Map<string, { id: string; title: string; reason: string }>();
  const reviewedPath = path.join(root, "data/seed/civic-reporting-exclusions.json");
  const reviewed = existsSync(reviewedPath) ? JSON.parse(readFileSync(reviewedPath, "utf8")) : { records: [], retainedItems: [] };
  for (const item of reviewed.records) excluded.set(item.id, item);
  const retained = new Set<string>((reviewed.retainedItems ?? []).map((item: { id: string }) => item.id));
  // Preserve previous exclusions when a compact release omits original items.
  for (const item of prior.excludedItems ?? []) excluded.set(item.id, item);
  const runtimeItems = read("public-meeting-items-runtime.json");
  for (const item of runtimeItems) if (retained.has(item.id)) item.reporting_policy = "retain_for_source_review";
  if (runtimeItems.some((item: any) => item.reporting_policy)) write("public-meeting-items-runtime.json", runtimeItems);
  const items = [...runtimeItems, ...(hasInstalledCivicRelease(root) ? [] : read("public-meeting-items.json"))];
  for (const item of items) {
    const reason = routineReportingExclusion(item);
    if (reason) excluded.set(item.id, { id: item.id, title: item.title, reason });
    else excluded.delete(item.id); // A later substantive correction wins.
  }
  const known = new Set(items.map(item => item.id));
  for (const item of [...(audit.ambiguousVoteActions ?? []), ...(audit.attendanceReviewActions ?? []), ...(audit.distributionReviewActions ?? [])]) {
    const reason = routineReportingExclusion({ ...item, sourceSnippet: item.sourceSnippet ?? item.outcome?.sourceSnippet });
    if (!known.has(item.meeting_item_id) && reason) excluded.set(item.meeting_item_id, { id: item.meeting_item_id, title: item.title, reason });
  }
  for (const id of retained) excluded.delete(id);
  const removed: Record<string, number> = {};
  const datasets = [
    ["public-meeting-votes.json", "meeting_item_id"], ["public-meeting-voting-cards.json", "topic_item_id"],
    ["voting-cards-runtime.json", "topic_item_id"], ["voting-cards.json", "agendaItemId"],
    ["public-meeting-official-actions.json", "topic_item_id"], ["officials-runtime.json", "topic_item_id"],
    ["citizen-vote-questions.json", "meeting_item_id"],
  ];
  for (const [name, key] of datasets) {
    if (!existsSync(path.join(dir, name))) continue;
    const data = read(name); const rows = Array.isArray(data) ? data : data.records ?? [];
    let annotated = false;
    for (const row of rows) if (retained.has(row[key])) { row.reporting_policy = "retain_for_source_review"; annotated = true; }
    const filtered = rows.filter((row: any) => !excluded.has(row[key]) && !(known.has(row[key]) ? false : routineReportingExclusion(row)));
    removed[name] = rows.length - filtered.length;
    if (removed[name] || annotated) {
      if (Array.isArray(data)) write(name, filtered);
      else {
        data.records = filtered;
        if (name === "voting-cards.json") data.totals = {
          ...data.totals, generatedCards: filtered.length, excludedFromReporting: rows.length - filtered.length,
          cardsWithFinancialImpact: filtered.filter((r: any) => r.financialImpact?.estimatedAmount || r.financialImpact?.raw).length,
          cardsWithParsedVotes: filtered.filter((r: any) => r.voteCount?.totalKnown > 0).length,
          approved: filtered.filter((r: any) => r.reviewStatus === "approved").length,
          ready: filtered.filter((r: any) => r.reviewStatus === "ready").length,
          needsReview: filtered.filter((r: any) => r.reviewStatus === "needs_review").length,
        };
        write(name, data);
      }
    }
  }
  for (const key of ["ambiguousVoteActions", "attendanceReviewActions", "distributionReviewActions", "aggregateOnlyOutcomes"]) {
    const rows = audit[key] ?? []; audit[key] = rows.filter((r: any) => !excluded.has(r.meeting_item_id));
    removed[key] = rows.length - audit[key].length;
  }
  if (audit.totals) {
    const votes = read("public-meeting-votes.json");
    const named = votes.filter((r: any) => r.review_status === "parsed_named_vote");
    const unanimous = votes.filter((r: any) => r.evidenceType === "unanimous_with_attendance_roster");
    const aggregate = votes.filter((r: any) => r.evidenceType === "aggregate_full_roster_match");
    Object.assign(audit.totals, {
      parsedNamedVotes: named.length,
      parsedNamedVoteActions: new Set(named.map((r: any) => r.meeting_item_id)).size,
      explicitNamedVotesParsed: votes.filter((r: any) => ["explicit_roll_call_group", "inline_named_vote"].includes(r.evidenceType)).length,
      individualVotesInferredFromUnanimousOutcomes: unanimous.length,
      individualVotesInferredFromAggregateCounts: aggregate.length,
      fullRosterMatches: new Set([...unanimous, ...aggregate].map((r: any) => r.meeting_item_id)).size,
      motionSecondParsed: votes.filter((r: any) => ["motion_mover", "motion_second"].includes(r.evidenceType)).length,
      ambiguousVoteActionsNeedingReview: audit.ambiguousVoteActions.length,
      actionsNeedingAttendanceReview: audit.attendanceReviewActions.length,
      actionsNeedingDistributionReview: audit.distributionReviewActions.length,
      aggregateOnlyOutcomes: audit.aggregateOnlyOutcomes.length,
      unnamedVoteActions: audit.aggregateOnlyOutcomes.length + audit.ambiguousVoteActions.length,
      needsReview: audit.ambiguousVoteActions.length + audit.attendanceReviewActions.length + audit.distributionReviewActions.length,
      remainingUnresolvedVoteActions: audit.ambiguousVoteActions.length + audit.attendanceReviewActions.length + audit.distributionReviewActions.length,
      excludedRoutineActions: excluded.size,
    });
    audit.voteChoiceCounts = votes.reduce((counts: Record<string, number>, r: any) => { counts[r.vote] = (counts[r.vote] ?? 0) + 1; return counts; }, {});
    audit.evidenceTypeCounts = votes.reduce((counts: Record<string, number>, r: any) => { counts[r.evidenceType] = (counts[r.evidenceType] ?? 0) + 1; return counts; }, {});
    audit.reportingPolicyVersion = REPORTING_POLICY_VERSION;
    write("public-meeting-vote-extraction-audit.json", audit);
  }
  const attendance = read("public-meeting-attendance.json", { records: [] });
  const cleanAttendance = (attendance.records ?? []).filter((r: any) => r.matchedOfficialId || !nonPersonExtractionReason(r.personName));
  // Rebuild reporting summaries from the filtered decisions, retaining the raw
  // attendance artifact for the review workbench and future parser correction.
  if (existsSync(path.join(dir, "accountability-graph-runtime.json"))) {
    const graph = buildAccountabilityGraph({ meetings: read("events-runtime.json"), votingCards: read("voting-cards.json", { records: [] }).records ?? [], projects: read("projects-runtime.json", { records: [] }).records ?? [], attendance: cleanAttendance });
    write("accountability-graph-runtime.json", { generatedAt: graph.generatedAt, sourceArtifacts: graph.sourceArtifacts, totals: graph.totals, communitySummaries: graph.communitySummaries });
  }
  const result = { version: REPORTING_POLICY_VERSION, excludedItems: [...excluded.values()], removedThisRun: removed, sourceItemsRetained: true };
  write("public-meeting-reporting-policy-audit.json", result);
  return { excludedItems: excluded.size, removed };
}

if (process.argv[1]?.endsWith("apply-reporting-policy.ts")) console.log(JSON.stringify(applyReportingPolicy()));
