export type OperationBackend = "local_process" | "github_actions" | "production_worker";
export type OperationTriggerType = "admin_run_now" | "scheduled" | "guided" | "manual_import" | "retry" | "reprocess" | "system";
export type OperationStatus = "queued" | "starting" | "running" | "awaiting_admin" | "awaiting_session" | "paused" | "succeeded" | "partially_succeeded" | "failed" | "cancelled" | "skipped" | "blocked_by_environment";
export type OperationType =
  | "dataops_full"
  | "dataops_daily"
  | "dataops_offline"
  | "source_discovery"
  | "source_monitor"
  | "document_retrieval"
  | "cache_verification"
  | "native_extraction"
  | "ocr_execution"
  | "source_completeness"
  | "accountability_reprocess"
  | "jurisdiction_reprocess"
  | "source_retry"
  | "quarantine_review"
  | "rss_refresh"
  | "manual_url_import"
  | "manual_file_import"
  | "manifest_import"
  | "playwright_public_run"
  | "playwright_session_bootstrap"
  | "playwright_authenticated_run"
  | "runtime_artifact_rebuild"
  | "validation_suite"
  | "officials_refresh"
  | "officials_carson_city_refresh"
  | "officials_retrieve_sources"
  | "officials_reconcile_sources"
  | "officials_import_evidence"
  | "officials_promote_runtime"
  | "officials_refresh_jurisdiction"
  | "production_email_test"
  | "worker_smoke_test"
  | "run_worker_once"
  | "evidence_purge"
  | "evidence_smoke_test"
  | "browser_session_smoke_test"
  | "backup_request"
  | "restore_smoke_test"
  | "production_trust_audit"
  | "publish_runtime_artifacts";

export type OperationDefinition = {
  id: OperationType;
  label: string;
  description: string;
  backend: OperationBackend;
  defaultTrigger: OperationTriggerType;
  command: string[];
  allowedArgs: string[];
  permissions: string[];
  safeConcurrent: boolean;
  highImpact: boolean;
  requiresNetwork: boolean;
  requiresOcrTools: boolean;
  productionAvailability: "available" | "development_only" | "worker_unconfigured" | "manual_review_only";
};

export const OPERATION_DEFINITIONS: OperationDefinition[] = [
  {
    id: "dataops_full",
    label: "Full DataOps pipeline",
    description: "Runs the deterministic DataOps orchestrator across retrieval, verification, extraction, OCR, reprocessing, and audits.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "dataops:pipeline", "--"],
    allowedArgs: ["limit", "from", "to", "offline", "jurisdiction", "host", "document-type", "priority-only", "retry-only"],
    permissions: ["dataops.run"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: true,
    requiresOcrTools: false,
    productionAvailability: "development_only",
  },
  {
    id: "dataops_offline",
    label: "Offline reprocessing",
    description: "Runs the cache verification, OCR audit, parsing, reporting, and freshness pipeline without network retrieval.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "dataops:offline", "--"],
    allowedArgs: ["from", "to"],
    permissions: ["dataops.reprocess"],
    safeConcurrent: false,
    highImpact: false,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "development_only",
  },
  {
    id: "document_retrieval",
    label: "Document retrieval",
    description: "Attempts bounded retrieval for queued public source documents.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["node", "--import", "tsx", "scripts/retrieve-public-meeting-documents.ts"],
    allowedArgs: ["limit", "jurisdiction", "host", "document-type", "priority-only", "retry-only", "force-refresh"],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: true,
    requiresOcrTools: false,
    productionAvailability: "development_only",
  },
  {
    id: "cache_verification",
    label: "Verify cache",
    description: "Verifies cached files by hash, size, magic bytes, MIME, and quarantine signals.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "meetings:documents:cache-audit", "--"],
    allowedArgs: [],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "development_only",
  },
  {
    id: "ocr_execution",
    label: "OCR candidates",
    description: "Runs OCR capability detection and bounded OCR against verified candidates.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "dataops:ocr", "--"],
    allowedArgs: ["limit", "force"],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: false,
    requiresOcrTools: true,
    productionAvailability: "development_only",
  },
  {
    id: "validation_suite",
    label: "Validation suite",
    description: "Runs typecheck and core DataOps audits.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "typecheck"],
    allowedArgs: [],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "development_only",
  },
  {
    id: "officials_refresh",
    label: "Refresh officials",
    description: "Refreshes official-directory source registry, attempts retrieval where network is available, regenerates current-officeholder runtime, and runs officials coverage guard.",
    backend: "github_actions",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "officials:refresh", "--"],
    allowedArgs: ["jurisdiction", "source-id", "offline", "force-refresh"],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: true,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "officials_carson_city_refresh",
    label: "Refresh Carson City officials",
    description: "Queues Carson City source retrieval, reconciliation, and coverage validation for the network-enabled worker path.",
    backend: "github_actions",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "officials:carson-city", "--"],
    allowedArgs: ["offline", "force-refresh"],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: true,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "officials_retrieve_sources",
    label: "Retrieve official sources",
    description: "Retrieves, verifies, hashes, and caches official-directory HTML. Web requests enqueue this operation; retrieval runs in a worker/operator environment.",
    backend: "github_actions",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "officials:retrieve", "--"],
    allowedArgs: ["jurisdiction", "source-id", "force-refresh"],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: true,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "officials_reconcile_sources",
    label: "Reconcile official sources",
    description: "Parses cached official source evidence, compares it to the current runtime, and writes review-gated reconciliation artifacts.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "officials:reconcile", "--"],
    allowedArgs: ["jurisdiction", "run-id"],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "development_only",
  },
  {
    id: "officials_import_evidence",
    label: "Import officials evidence artifact",
    description: "Verifies a downloaded Carson City officials evidence artifact, recomputes hashes, and imports verified HTML into the approved public-source cache.",
    backend: "github_actions",
    defaultTrigger: "manual_import",
    command: ["npm", "run", "officials:import-evidence", "--"],
    allowedArgs: ["path"],
    permissions: ["review.approve"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "officials_refresh_jurisdiction",
    label: "Refresh one officials jurisdiction",
    description: "Runs the officials refresh path for one configured jurisdiction. Carson City is the only implemented source parser in this sprint.",
    backend: "github_actions",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "officials:refresh", "--"],
    allowedArgs: ["jurisdiction", "source-id", "force-refresh"],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: true,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "officials_promote_runtime",
    label: "Promote reviewed officials runtime",
    description: "Promotes verified official source evidence into canonical current-official runtime artifacts. Requires confirmation and review approval.",
    backend: "github_actions",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "officials:promote", "--"],
    allowedArgs: ["jurisdiction", "run-id", "confirm"],
    permissions: ["review.approve"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "playwright_public_run",
    label: "Playwright public adapter smoke",
    description: "Runs a local fixture-only Playwright adapter smoke test. Does not access public DNS or authenticated portals.",
    backend: "local_process",
    defaultTrigger: "guided",
    command: ["node", "--import", "tsx", "scripts/playwright-public-smoke.ts"],
    allowedArgs: [],
    permissions: ["dataops.bootstrap_session"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "development_only",
  },
  {
    id: "playwright_session_bootstrap",
    label: "Authenticated session bootstrap",
    description: "Creates a metadata-only guided bootstrap operation. Secret browser state storage is intentionally unconfigured.",
    backend: "production_worker",
    defaultTrigger: "guided",
    command: [],
    allowedArgs: ["sourceId", "provider"],
    permissions: ["dataops.bootstrap_session"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: true,
    requiresOcrTools: false,
    productionAvailability: "worker_unconfigured",
  },
  {
    id: "production_email_test",
    label: "Production email test",
    description: "Queues a confirmed provider email test through the durable worker. Requires an allowlisted recipient and production email secrets.",
    backend: "production_worker",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "email:production-test", "--"],
    allowedArgs: ["recipient", "confirm-production-send"],
    permissions: ["security.manage_admins"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: true,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "worker_smoke_test",
    label: "Worker smoke test",
    description: "Enqueues and claims harmless durable worker jobs, with optional email/evidence purge coverage when those services are configured.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "worker:smoke-test", "--"],
    allowedArgs: ["recipient"],
    permissions: ["dataops.run"],
    safeConcurrent: false,
    highImpact: false,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "run_worker_once",
    label: "Run worker once",
    description: "Claims and processes one queued durable job using the existing identity worker handler.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "worker:once", "--"],
    allowedArgs: ["worker-id"],
    permissions: ["dataops.run"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "evidence_purge",
    label: "Evidence purge",
    description: "Runs the verification-evidence purge boundary and writes a non-sensitive purge audit.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "evidence:purge"],
    allowedArgs: [],
    permissions: ["verification.review"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "evidence_smoke_test",
    label: "Evidence storage smoke",
    description: "Runs the encrypted evidence-storage smoke test with fixture data only.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "evidence:smoke-test", "--"],
    allowedArgs: ["allow-ephemeral-dev-key"],
    permissions: ["verification.review"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "browser_session_smoke_test",
    label: "Browser-session smoke",
    description: "Runs the encrypted Playwright session fixture smoke test, including revocation.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "browser-sessions:smoke-test", "--"],
    allowedArgs: ["allow-ephemeral-dev-key"],
    permissions: ["dataops.bootstrap_session"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "backup_request",
    label: "Backup request",
    description: "Runs the backup status/request command. It records a truthful provider-backed status artifact and never writes plaintext dumps.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "backup:create"],
    allowedArgs: [],
    permissions: ["security.manage_admins"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "restore_smoke_test",
    label: "Restore smoke test",
    description: "Prepares or runs the non-production restore smoke boundary. The primary database is never a restore target.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "restore:smoke-test", "--"],
    allowedArgs: ["confirm-restore-smoke-test"],
    permissions: ["security.manage_admins"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "production_trust_audit",
    label: "Production trust audit",
    description: "Regenerates the non-sensitive production trust services plan and readiness audit.",
    backend: "local_process",
    defaultTrigger: "admin_run_now",
    command: ["npm", "run", "production:trust-audit"],
    allowedArgs: [],
    permissions: ["security.manage_admins"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "available",
  },
  {
    id: "manual_url_import",
    label: "Manual URL import",
    description: "Records a guided manual public URL import request for review-gated ingestion.",
    backend: "production_worker",
    defaultTrigger: "manual_import",
    command: [],
    allowedArgs: ["url", "jurisdiction", "documentType", "sourceTitle"],
    permissions: ["dataops.import"],
    safeConcurrent: true,
    highImpact: false,
    requiresNetwork: true,
    requiresOcrTools: false,
    productionAvailability: "worker_unconfigured",
  },
  {
    id: "publish_runtime_artifacts",
    label: "Publish reviewed runtime artifacts",
    description: "Explicit publish/promote boundary for reviewed source-backed records. Not enabled until review workflow is durable.",
    backend: "production_worker",
    defaultTrigger: "admin_run_now",
    command: [],
    allowedArgs: ["scope"],
    permissions: ["review.approve"],
    safeConcurrent: false,
    highImpact: true,
    requiresNetwork: false,
    requiresOcrTools: false,
    productionAvailability: "manual_review_only",
  },
];

export function getOperationDefinition(id: string) {
  return OPERATION_DEFINITIONS.find((definition) => definition.id === id);
}

export function operationIds() {
  return OPERATION_DEFINITIONS.map((definition) => definition.id);
}
