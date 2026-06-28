import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getDurableOperationStorageStatus } from "@/lib/identity/durable-storage";
import { prisma } from "@/lib/prisma";

const OPERATIONS_PATH = path.join(process.cwd(), "data", "generated", "admin-operations", "operations.json");

async function main() {
  const status = await getDurableOperationStorageStatus();
  let durableStaleMarked: number | null = null;
  if (status.ready) {
    durableStaleMarked = await prisma.$executeRawUnsafe(`update "AdminOperation" set "status"='failed', "failureClassification"='stale_operation_recovered', "completedAt"=now() where "status" in ('queued','starting','running') and coalesce("heartbeatAt","queuedAt") < now() - interval '30 minutes'`);
  }
  let localStaleMarked = 0;
  if (existsSync(OPERATIONS_PATH)) {
    const records = JSON.parse(readFileSync(OPERATIONS_PATH, "utf8")) as Array<Record<string, unknown>>;
    const cutoff = Date.now() - 30 * 60 * 1000;
    const next = records.map((record) => {
      const statusValue = String(record.status ?? "");
      const heartbeat = typeof record.heartbeatAt === "string" ? record.heartbeatAt : typeof record.queuedAt === "string" ? record.queuedAt : null;
      if (["queued", "starting", "running"].includes(statusValue) && heartbeat && new Date(heartbeat).getTime() < cutoff) {
        localStaleMarked += 1;
        return { ...record, status: "failed", failureClassification: "stale_operation_recovered", completedAt: new Date().toISOString() };
      }
      return record;
    });
    if (localStaleMarked) writeFileSync(OPERATIONS_PATH, `${JSON.stringify(next, null, 2)}\n`);
  }
  console.log(JSON.stringify({ status: "complete", durableStatus: status.status, durableStaleMarked, localStaleMarked }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
