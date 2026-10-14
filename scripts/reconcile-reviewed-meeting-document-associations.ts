import { repairReviewedMeetingDocumentAssociations } from "@/lib/public-meetings/reviewed-document-association-store";

const report = repairReviewedMeetingDocumentAssociations({ dryRun: process.argv.includes("--dry-run") });
console.log(JSON.stringify({ totals: report.totals, associations: report.associations, pendingReview: report.pendingReview, changedFiles: report.changedFiles, dryRun: report.dryRun }, null, 2));
