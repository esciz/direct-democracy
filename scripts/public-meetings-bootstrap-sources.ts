import { bootstrapManualPublicMeetingSources } from "@/lib/public-meetings/manual-sources";

async function main() {
  const providers = await bootstrapManualPublicMeetingSources();
  console.log("Manual public meeting source folders ready");
  for (const provider of providers) {
    console.log(`- data/manual-sources/public-meetings/${provider}`);
  }
  console.log("- data/manual-sources/public-meetings/_fixtures");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
