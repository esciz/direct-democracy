import { promoteAudit } from "@/lib/audit/provenance";

function getArg(name: string) {
  const flag = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return flag?.split("=").slice(1).join("=");
}

async function main() {
  const runId = getArg("--run-id");
  const artifactName = getArg("--artifact") ?? "production-trust-readiness";
  if (!runId) throw new Error("audit_promotion_requires_--run-id=<run-id>");
  const result = promoteAudit({
    runId,
    artifactName,
    requireNetwork: !process.argv.includes("--allow-offline"),
  });
  const promotedStatus = result.promoted.provenance.canonicalStatus;
  console.log("Audit promoted.");
  console.log(JSON.stringify({
    artifactName,
    runId,
    canonicalPath: result.canonicalPath,
    status: promotedStatus,
    environment: result.promoted.provenance?.executionEnvironment,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
