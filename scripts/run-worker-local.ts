import { processClaimedIdentityJob } from "@/lib/identity/worker-handlers";
import { claimNextJob } from "@/lib/identity/worker-queue";

function readLimit() {
  const flag = process.argv.find((arg) => arg.startsWith("--limit="));
  const parsed = flag ? Number(flag.split("=")[1]) : 5;
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 5;
}

async function processOne(workerId: string) {
  const claimed = await claimNextJob(workerId);
  if (!claimed.ok || !claimed.job) return { claimed: false, status: claimed.status };
  const result = await processClaimedIdentityJob(claimed.job, workerId);
  return {
    claimed: true,
    status: result.job?.status ?? (result.ok ? "processed" : "failed"),
    jobId: claimed.job.id,
    jobType: claimed.job.jobType,
    handled: result.ok,
  };
}

async function main() {
  const limit = readLimit();
  const workerId = `local_worker_${process.pid}`;
  const results = [];
  for (let index = 0; index < limit; index += 1) {
    const result = await processOne(workerId);
    results.push(result);
    if (!result.claimed) break;
  }
  console.log(JSON.stringify({ workerId, limit, processed: results.filter((result) => result.claimed).length, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
