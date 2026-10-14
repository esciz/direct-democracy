import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { hasAdminDashboardPermission } from "@/lib/admin/permissions";
import { getSeedUserById } from "@/lib/auth/mock-users";
import { OWNER_ADMIN_USER_ID } from "@/lib/identity/constants";

const GENERATED_DIR = path.join(process.cwd(), "data", "generated");
const REPORT_PATH = path.join(GENERATED_DIR, "admin-dashboard-link-audit.json");

function sourceIncludes(filePath: string, text: string) {
  return existsSync(filePath) && readFileSync(filePath, "utf8").includes(text);
}

const admin = getSeedUserById("user_admin_riley_morgan");
const trusted = getSeedUserById("user_trusted_citizen_marco_silva");
const unverified = getSeedUserById("user_citizen_miles_reed");
const government = { id: "audit_government_staff", role: "government_staff" as const };
const owner = { id: OWNER_ADMIN_USER_ID, role: "admin" as const };
const profilePath = path.join(process.cwd(), "app", "profile", "page.tsx");
const adminIndexPath = path.join(process.cwd(), "app", "admin", "page.tsx");
const adminLayoutPath = path.join(process.cwd(), "app", "admin", "layout.tsx");
const proxyPath = path.join(process.cwd(), "proxy.ts");

const validations = {
  profileUsesServerSessionUser: sourceIncludes(profilePath, "getCurrentSessionUser"),
  profileUsesAdminPermissionHelper: sourceIncludes(profilePath, "hasAdminDashboardPermission"),
  profileLinksCanonicalAdminRoute: sourceIncludes(profilePath, 'href="/admin"'),
  profileLabelsButton: sourceIncludes(profilePath, "Admin Dashboard"),
  adminSeedSeesButton: admin ? hasAdminDashboardPermission(admin, "dataops.view") : false,
  ownerAdminSeesButton: hasAdminDashboardPermission(owner, "dataops.view"),
  trustedCitizenDoesNotSeeButton: trusted ? !hasAdminDashboardPermission(trusted, "dataops.view") : false,
  unverifiedDoesNotSeeButton: unverified ? !hasAdminDashboardPermission(unverified, "dataops.view") : false,
  governmentDoesNotSeeButton: !hasAdminDashboardPermission(government, "dataops.view"),
  loggedOutDoesNotSeeButton: !hasAdminDashboardPermission(null, "dataops.view"),
  adminIndexRedirectsToOperations: sourceIncludes(adminIndexPath, 'redirect("/admin/operations")'),
  adminLayoutRequiresServerPermission: sourceIncludes(adminLayoutPath, 'requireAdminPage("dataops.view")'),
  proxyProtectsAdminIndex: sourceIncludes(proxyPath, '"/admin"'),
  proxyProtectsAdminApi: sourceIncludes(proxyPath, '"/api/admin/:path*"'),
};

const failures = Object.entries(validations).filter(([, passed]) => !passed).map(([name]) => name);
const report = {
  generatedAt: new Date().toISOString(),
  validations,
  totals: {
    validations: Object.keys(validations).length,
    failures: failures.length,
  },
  failures,
};

mkdirSync(GENERATED_DIR, { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  console.error("Admin dashboard link audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Admin dashboard link audit passed.");
console.log(JSON.stringify(report.totals, null, 2));
