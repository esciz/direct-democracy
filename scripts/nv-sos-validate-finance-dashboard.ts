import { buildCampaignFinanceDashboard } from "@/lib/nv-sos/finance-dashboard";
import { NV_SOS_PATHS, readJsonFile, writeJsonFile, type NvSosCampaignFinanceRecord } from "@/lib/nv-sos/pipeline";

type FinanceDashboardValidationRecord = {
  candidate_name: string;
  report_count: number;
  total_contributions_parsed: number | null;
  total_contributions_categorized: number;
  excluded_refund_adjustment_rows: number;
  excluded_refund_adjustment_amount: number;
  valid_contribution_rows_for_tables: number;
  valid_expenditure_rows_for_tables: number;
  needs_review_rows: number;
  top_categories_by_amount: Array<{ name: string; amount: number; count: number }>;
  top_industries_by_amount: Array<{ name: string; amount: number; count: number }>;
  top_donor_types_by_amount: Array<{ name: string; amount: number; count: number }>;
  top_organizations_by_amount: Array<{ name: string; amount: number; count: number; industry: string; entity_type: string; confidence_score: number }>;
  donor_classification_count: number;
  high_confidence_classification_count: number;
  medium_confidence_classification_count: number;
  low_confidence_classification_count: number;
  incoming_funding_rows_used_for_charts: number;
  raw_contributor_rows_preserved: number;
  raw_payee_rows_preserved: number;
  data_status: {
    has_clean_itemized_contributions: boolean;
    has_refund_heavy_data: boolean;
    has_aggregate_totals: boolean;
    contribution_rows_count: number;
    excluded_refund_adjustment_rows_count: number;
    raw_rows_count: number;
    confidence_level: "high" | "medium" | "low";
    voter_facing_mode: "full_breakdown" | "limited_breakdown" | "aggregate_only" | "source_documents_only";
  };
  accounting_breakdown: Array<{ name: string; amount: number; count: number; percentage: number }>;
  fixture_checks: {
    refund_rows_excluded_from_largest_contribution_records: boolean;
    refund_rows_excluded_from_largest_payee_records: boolean;
    donor_chart_rows_are_clean_incoming_contributions: boolean;
    review_queue_includes_excluded_adjustments: boolean;
  };
};

async function main() {
  const records = await readJsonFile<NvSosCampaignFinanceRecord[]>(NV_SOS_PATHS.campaignFinanceRecords, []);
  const byCandidate = new Map<string, NvSosCampaignFinanceRecord[]>();
  for (const record of records) {
    const candidateName = record.candidate_name ?? "Unknown candidate";
    byCandidate.set(candidateName, [...(byCandidate.get(candidateName) ?? []), record]);
  }

  const validation: FinanceDashboardValidationRecord[] = [...byCandidate.entries()]
    .map(([candidateName, candidateRecords]) => {
      const dashboard = buildCampaignFinanceDashboard(candidateRecords);
      const refundRowsExcludedFromContributionRecords = dashboard.topContributors.every((row) => !row.isAdjustment && row.amount > 0);
      const refundRowsExcludedFromPayeeRecords = dashboard.topPayees.every((row) => !row.isAdjustment && row.amount > 0);
      const donorChartRowsAreClean =
        dashboard.validation.incomingFundingRowsUsedForCharts === dashboard.rawContributorRows.filter((row) => !row.isBoilerplate && !row.isAdjustment && row.amount > 0).length;
      const reviewQueueIncludesAdjustments = dashboard.rawAdjustmentRows.length === dashboard.reviewQueues.excludedAdjustmentRows.length;

      if (!refundRowsExcludedFromContributionRecords || !refundRowsExcludedFromPayeeRecords || !donorChartRowsAreClean || !reviewQueueIncludesAdjustments) {
        throw new Error(`Finance dashboard row-exclusion validation failed for ${candidateName}.`);
      }

      return {
        candidate_name: candidateName,
        report_count: dashboard.summary.reportCount,
        total_contributions_parsed: dashboard.validation.officialTotalContributionsParsed,
        total_contributions_categorized: dashboard.validation.itemizedContributionAmountCategorized,
        excluded_refund_adjustment_rows: dashboard.validation.excludedRefundOrAdjustmentRows,
        excluded_refund_adjustment_amount: dashboard.validation.excludedRefundOrAdjustmentAmount,
        valid_contribution_rows_for_tables: dashboard.topContributors.length,
        valid_expenditure_rows_for_tables: dashboard.topPayees.length,
        needs_review_rows: dashboard.validation.needsReviewRowCount,
        top_categories_by_amount: dashboard.validation.topContributionCategories,
        top_industries_by_amount: dashboard.industrySectorBreakdown.slice(0, 5).map((row) => ({ name: row.name, amount: row.amount, count: row.count })),
        top_donor_types_by_amount: dashboard.donorTypeBreakdown.slice(0, 5).map((row) => ({ name: row.name, amount: row.amount, count: row.count })),
        top_organizations_by_amount: dashboard.topOrganizations.slice(0, 5).map((row) => ({ name: row.name, amount: row.amount, count: row.count, industry: row.industry, entity_type: row.entityType, confidence_score: row.confidenceScore })),
        donor_classification_count: dashboard.validation.donorClassificationCount,
        high_confidence_classification_count: dashboard.validation.highConfidenceClassificationCount,
        medium_confidence_classification_count: dashboard.validation.mediumConfidenceClassificationCount,
        low_confidence_classification_count: dashboard.validation.lowConfidenceClassificationCount,
        incoming_funding_rows_used_for_charts: dashboard.validation.incomingFundingRowsUsedForCharts,
        raw_contributor_rows_preserved: dashboard.validation.rawContributorRowCountPreserved,
        raw_payee_rows_preserved: dashboard.validation.rawPayeeRowCountPreserved,
        data_status: {
          has_clean_itemized_contributions: dashboard.dataStatus.hasCleanItemizedContributions,
          has_refund_heavy_data: dashboard.dataStatus.hasRefundHeavyData,
          has_aggregate_totals: dashboard.dataStatus.hasAggregateTotals,
          contribution_rows_count: dashboard.dataStatus.contributionRowsCount,
          excluded_refund_adjustment_rows_count: dashboard.dataStatus.excludedRefundAdjustmentRowsCount,
          raw_rows_count: dashboard.dataStatus.rawRowsCount,
          confidence_level: dashboard.dataStatus.confidenceLevel,
          voter_facing_mode: dashboard.dataStatus.voterFacingMode,
        },
        accounting_breakdown: dashboard.accountingBreakdown.map((row) => ({
          name: row.name,
          amount: row.amount,
          count: row.count,
          percentage: row.percentage,
        })),
        fixture_checks: {
          refund_rows_excluded_from_largest_contribution_records: refundRowsExcludedFromContributionRecords,
          refund_rows_excluded_from_largest_payee_records: refundRowsExcludedFromPayeeRecords,
          donor_chart_rows_are_clean_incoming_contributions: donorChartRowsAreClean,
          review_queue_includes_excluded_adjustments: reviewQueueIncludesAdjustments,
        },
      };
    })
    .sort((left, right) => (right.total_contributions_parsed ?? 0) - (left.total_contributions_parsed ?? 0));

  const outputPath = "data/generated/nv-sos-finance-dashboard-validation.json";
  await writeJsonFile(outputPath, {
    generated_at: new Date().toISOString(),
    record_count: validation.length,
    records: validation,
  });

  console.log(`Wrote Nevada SoS finance dashboard validation: ${validation.length} candidate groups.`);
  for (const record of validation.slice(0, 5)) {
    console.log(
      `${record.candidate_name}: contributions parsed=${record.total_contributions_parsed ?? "pending"}, categorized=${record.total_contributions_categorized}, excluded adjustments=${record.excluded_refund_adjustment_rows}, raw rows=${record.raw_contributor_rows_preserved + record.raw_payee_rows_preserved}`,
    );
    console.log(`  mode=${record.data_status.voter_facing_mode}, confidence=${record.data_status.confidence_level}, clean rows=${record.data_status.contribution_rows_count}, review rows=${record.needs_review_rows}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
