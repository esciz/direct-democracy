import { runPublicMeetingImport } from "@/lib/public-meetings/importer";

async function main() {
  const report = await runPublicMeetingImport();

  console.log("Public meeting import complete");
  console.log(`Seed sources: ${report.seed_sources}`);
  console.log(`Public bodies: ${report.public_bodies}`);
  console.log(`Manual documents found: ${report.manual_documents_found}`);
  console.log(`Manual documents parsed: ${report.manual_documents_parsed}`);
  console.log(`Meetings: ${report.meetings}`);
  console.log(`Meeting items: ${report.meeting_items}`);
  console.log(`Vote records: ${report.vote_records}`);
  console.log(`Citizen vote questions: ${report.citizen_vote_questions}`);
  console.log(`Low-confidence items: ${report.low_confidence_items}`);
  console.log(`OCR needed documents: ${report.ocr_needed_documents}`);
  if (report.errors.length) {
    console.log(`Errors: ${report.errors.length}`);
    for (const error of report.errors.slice(0, 5)) {
      console.log(`- ${error.document_id ?? "unknown"}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
