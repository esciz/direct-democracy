import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getGovCases } from "@/lib/govcrm/cases";
import {
  getGovTenants,
  GOV_TENANT_TYPE_LABELS,
  UNIVERSAL_GOVCRM_MODULES,
  type GovTenantType,
} from "@/lib/govcrm/tenants";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const OUTPUT_PATH = path.join(GENERATED_DIR, "govcrm-tenant-model-audit.json");
const REQUIRED_TYPES: GovTenantType[] = [
  "CITY",
  "COUNTY",
  "SCHOOL_DISTRICT",
  "STATE_AGENCY",
  "LEGISLATURE",
  "COURT",
  "UNIVERSITY",
  "SPECIAL_DISTRICT",
];

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((entry) => {
    const fullPath = path.join(root, entry);
    if (statSync(fullPath).isDirectory()) return walkFiles(fullPath);
    return fullPath;
  });
}

const tenants = getGovTenants();
const cases = getGovCases();
const failures: string[] = [];

for (const tenantType of REQUIRED_TYPES) {
  if (!GOV_TENANT_TYPE_LABELS[tenantType]) failures.push(`Missing tenant type label: ${tenantType}`);
}

for (const tenant of tenants) {
  if (tenant.demoLabel !== "DEMO_DEV_ONLY") failures.push(`Tenant fixture missing demo label: ${tenant.id}`);
  for (const moduleId of UNIVERSAL_GOVCRM_MODULES) {
    if (!tenant.modules.includes(moduleId)) failures.push(`Tenant ${tenant.id} missing universal module: ${moduleId}`);
  }
  if (!tenant.profile.publicCivicRecordPolicy.toLowerCase().includes("read-only")) {
    failures.push(`Tenant ${tenant.id} missing read-only public civic record policy.`);
  }
  for (const department of tenant.departments) {
    if (!department.demoOnly) failures.push(`Tenant ${tenant.id} department ${department.id} is not marked demo-only.`);
  }
  for (const role of tenant.staffRoles) {
    if (!role.demoOnly) failures.push(`Tenant ${tenant.id} role ${role.id} is not marked demo-only.`);
  }
}

for (const caseItem of cases) {
  for (const link of caseItem.linkedPublicRecords) {
    if (link.readOnly !== true) failures.push(`GovCRM case ${caseItem.id} has mutable public record link ${link.id}.`);
  }
}

const govCrmFiles = [...walkFiles(path.join(process.cwd(), "app", "gov")), ...walkFiles(path.join(process.cwd(), "lib", "govcrm"))].filter((filePath) =>
  /\.(ts|tsx)$/.test(filePath),
);
const forbiddenImportPattern = /from\s+["']@\/(lib\/admin\/operations|scripts\/|lib\/public-meetings\/importer|lib\/civic-data\/source-definitions)|runAdminOperation|run-dataops|retrieve-public-meeting|extract-public-meeting|discover-public-meeting/i;
const forbiddenMatches = govCrmFiles.flatMap((filePath) => {
  const text = readFileSync(filePath, "utf8");
  return forbiddenImportPattern.test(text) ? [path.relative(process.cwd(), filePath)] : [];
});

if (forbiddenMatches.length) {
  failures.push(`GovCRM imports or references admin/DataOps ingestion controls: ${forbiddenMatches.join(", ")}`);
}

const audit = {
  generatedAt: new Date().toISOString(),
  totals: {
    tenantTypesRequired: REQUIRED_TYPES.length,
    fixtureTenants: tenants.length,
    universalModules: UNIVERSAL_GOVCRM_MODULES.length,
    govCrmFiles: govCrmFiles.length,
    readOnlyPublicRecordLinks: cases.reduce((sum, caseItem) => sum + caseItem.linkedPublicRecords.length, 0),
    failures: failures.length,
  },
  tenantTypes: REQUIRED_TYPES,
  fixtureTenants: tenants.map((tenant) => ({
    id: tenant.id,
    slug: tenant.slug,
    type: tenant.type,
    demoLabel: tenant.demoLabel,
    modules: tenant.modules,
    capabilities: tenant.capabilities,
  })),
  separation: {
    govOwns: "customer-facing government CRM workflows",
    adminOperationsOwns: "Direct Democracy platform DataOps, ingestion, source adapters, evidence acquisition, trust artifacts, and platform audits",
    publicRecordLinks: "read_only",
    forbiddenGovCrmImportsFound: forbiddenMatches,
  },
  failures,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(audit, null, 2)}\n`);

if (failures.length) {
  console.error("GovCRM tenant model audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Generated GovCRM tenant model audit at ${OUTPUT_PATH}`);
console.log(JSON.stringify(audit.totals, null, 2));
