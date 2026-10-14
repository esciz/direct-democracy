#!/usr/bin/env node

import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const mode = process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1] ?? process.argv[2] ?? "help";
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function reviewCounts(label, where = {}) {
  const [pendingReview, approved, verified, rejected] = await Promise.all([
    prisma.reviewQueueItem.count({ where: { ...where, reviewStatus: "pending_review" } }),
    prisma.reviewQueueItem.count({ where: { ...where, reviewStatus: "approved" } }),
    prisma.reviewQueueItem.count({ where: { ...where, reviewStatus: "verified" } }),
    prisma.reviewQueueItem.count({ where: { ...where, reviewStatus: "rejected" } }),
  ]);

  console.log(`\n${label}`);
  console.log(`pending_review: ${pendingReview}`);
  console.log(`approved: ${approved}`);
  console.log(`verified: ${verified}`);
  console.log(`rejected: ${rejected}`);
  console.log("Open /admin/data-factory to approve, reject, merge, attach sources, or flag issues.");
}

async function main() {
  switch (mode) {
    case "import-candidate-knowledge":
      console.log("Importing candidate knowledge from stored/manual sources and approved provider jobs.");
      await run("node", ["scripts/import-nvsos-candidate-media.mjs"]);
      await run("node", ["scripts/run-candidate-knowledge-enrichment.mjs"]);
      await run("node", ["scripts/import-news-mentions.mjs"]);
      break;
    case "review-candidate-knowledge":
      await reviewCounts("Candidate Knowledge review queue", { entityType: "CANDIDATE" });
      break;
    case "import-campaign-finance":
      console.log("Importing campaign finance source-link fallbacks.");
      await run("node", ["scripts/practical-civic-imports.mjs", "--mode=import-campaign-finance-sources", ...(limitArg ? [limitArg] : [])]);
      console.log("Importing campaign finance documents from data/imports/campaign-finance.");
      await run("node", ["scripts/import-civic-documents.mjs", "--dir=data/imports/campaign-finance"]);
      console.log("Finance source links are visible immediately; detailed filings are staged until a source-specific parser is approved.");
      break;
    case "review-campaign-finance":
      await reviewCounts("Campaign Finance review queue", { entityType: "CAMPAIGN_FINANCE" });
      break;
    case "extract-issue-positions":
      console.log("Extracting issue-position work queue from approved candidate knowledge and existing issue-position records.");
      await run("node", ["scripts/generate-issue-position-vote-questions.mjs"]);
      console.log("Issue position extraction is source-backed only; missing evidence remains pending review.");
      break;
    case "review-issue-positions":
      await reviewCounts("Issue Position review queue", { entityType: "ISSUE_POSITION" });
      break;
    case "import-meetings":
      console.log("Importing meeting documents from data/imports/meeting-documents.");
      await run("node", ["scripts/import-civic-documents.mjs", "--dir=data/imports/meeting-documents"]);
      console.log("Meeting agenda/minute documents are staged for review until source-specific adapters are enabled.");
      break;
    case "review-meetings":
      await reviewCounts("Meeting / Agenda review queue", { entityType: "MEETING" });
      break;
    default:
      console.log(`Unknown or missing mode: ${mode}`);
      console.log("Available modes:");
      console.log("  import-candidate-knowledge");
      console.log("  review-candidate-knowledge");
      console.log("  import-campaign-finance");
      console.log("  review-campaign-finance");
      console.log("  extract-issue-positions");
      console.log("  review-issue-positions");
      console.log("  import-meetings");
      console.log("  review-meetings");
      process.exitCode = mode === "help" ? 0 : 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
