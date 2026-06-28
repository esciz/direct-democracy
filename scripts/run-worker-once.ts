import { processClaimedIdentityJob } from "@/lib/identity/worker-handlers";
import { claimNextJob } from "@/lib/identity/worker-queue";

function workerId() {
  const flag = process.argv.find((arg) => arg.startsWith("--worker-id="));
  return flag?.split("=")[1] || `local_worker_${process.pid}`;
}

async function main() {
  const id = workerId();
  const claimed = await claimNextJob(id);
  if (!claimed.ok || !claimed.job) {
    console.log(JSON.stringify({ status: claimed.status, claimed: false }, null, 2));
    return;
  }

  const result = await processClaimedIdentityJob(claimed.job, id);
  console.log(JSON.stringify({
    status: result.job?.status ?? (result.ok ? "processed" : "failed"),
    jobId: result.job?.id ?? claimed.job.id,
    jobType: claimed.job.jobType,
    handled: result.ok,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
