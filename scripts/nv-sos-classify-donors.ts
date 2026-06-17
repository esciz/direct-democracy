import { buildCampaignFinanceDashboard } from "@/lib/nv-sos/finance-dashboard";
import { NV_SOS_PATHS, readJsonFile, writeJsonFile, type NvSosCampaignFinanceRecord } from "@/lib/nv-sos/pipeline";

async function main() {
  const records = await readJsonFile<NvSosCampaignFinanceRecord[]>(NV_SOS_PATHS.campaignFinanceRecords, []);
  const byCandidate = new Map<string, NvSosCampaignFinanceRecord[]>();
  for (const record of records) {
    const candidateName = record.candidate_name ?? "Unknown candidate";
    byCandidate.set(candidateName, [...(byCandidate.get(candidateName) ?? []), record]);
  }

  const candidateGroups = [...byCandidate.entries()]
    .map(([candidateName, candidateRecords]) => {
      const dashboard = buildCampaignFinanceDashboard(candidateRecords);
      return {
        candidate_name: candidateName,
        donor_classification_count: dashboard.donorClassifications.length,
        data_status: dashboard.dataStatus,
        accounting_breakdown: dashboard.accountingBreakdown,
        incoming_rows_used_for_charts: dashboard.validation.incomingFundingRowsUsedForCharts,
        excluded_refund_adjustment_rows: dashboard.validation.excludedRefundOrAdjustmentRows,
        individual_vs_organizational: dashboard.individualVsOrganizational,
        top_industries: dashboard.industrySectorBreakdown,
        top_donor_types: dashboard.donorTypeBreakdown,
        top_organizations: dashboard.topOrganizations,
        records: dashboard.donorClassifications,
      };
    })
    .sort((left, right) => right.donor_classification_count - left.donor_classification_count);

  await writeJsonFile("data/generated/nv-sos-donor-classifications.json", {
    generated_at: new Date().toISOString(),
    candidate_group_count: candidateGroups.length,
    donor_classification_count: candidateGroups.reduce((sum, group) => sum + group.donor_classification_count, 0),
    manual_override_file: "data/source-seeds/nv-sos-donor-classification-overrides.json",
    classification_methods: {
      manual_admin_override: "Active. Overrides file entries take precedence over every other method.",
      known_entity_match: "Active. Local known-donor seed database covers high-signal Nevada examples and common entities.",
      historical_classification_inheritance: "Active within each dashboard build. Repeated normalized donor names inherit the strongest prior classification.",
      keyword_matching: "Active. Deterministic entity-type and industry keywords are used when confidence is reasonable.",
      website_lookup: "Field supported, but live lookup is not run during cache-first profile rendering.",
      secretary_of_state_business_records: "Field supported, but live business-record lookup is not run during cache-first profile rendering.",
    },
    candidate_groups: candidateGroups,
  });

  console.log(`Wrote Nevada SoS donor classifications: ${candidateGroups.reduce((sum, group) => sum + group.donor_classification_count, 0)} normalized donors across ${candidateGroups.length} candidate groups.`);
  for (const group of candidateGroups.slice(0, 5)) {
    console.log(`${group.candidate_name}: donors=${group.donor_classification_count}, incoming rows=${group.incoming_rows_used_for_charts}, excluded adjustments=${group.excluded_refund_adjustment_rows}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
