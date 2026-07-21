const DEMO_ORGANIZATION_IDS = [
  "org_carson_budget_transparency_coalition",
  "org_nevada_housing_action_coalition",
  "org_washoe_service_workers_union",
  "org_nevada_open_government_project",
  "org_carson_neighborhood_council",
  "org_reno_faith_and_service_network",
  "org_nevada_small_business_council",
  "org_northern_nevada_tenants_network",
];

const DEMO_ORGANIZATION_NAMES = [
  "Carson Budget Transparency Coalition",
  "Nevada Housing Action Coalition",
  "Washoe Service Workers Union",
  "Nevada Open Government Project",
  "Carson Neighborhood Council",
  "Reno Faith and Service Network",
  "Nevada Small Business Council",
  "Northern Nevada Tenants Network",
];

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function normalizeBaseUrl(value: string | undefined) {
  if (!value) return null;
  return value.replace(/\/+$/, "");
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html",
      "user-agent": "Direct Democracy production organization audit",
    },
    redirect: "follow",
  });

  return {
    url,
    status: response.status,
    ok: response.ok,
    text: await response.text(),
  };
}

async function main() {
  const demoModeEnabled = process.env.DIRECT_DEMOCRACY_ENABLE_DEMO_ORGANIZATIONS === "true";
  const allowDemo = process.argv.includes("--allow-demo");
  const baseUrl = normalizeBaseUrl(getArg("url") ?? process.env.ORGANIZATIONS_AUDIT_URL ?? process.env.NEXT_PUBLIC_APP_URL);
  const failures: string[] = [];
  const checkedUrls: Array<{ url: string; status: number; ok: boolean }> = [];

  if (demoModeEnabled && !allowDemo) {
    failures.push("DIRECT_DEMOCRACY_ENABLE_DEMO_ORGANIZATIONS is true. Production organization pages would include seeded demo organizations.");
  }

  if (baseUrl && !demoModeEnabled) {
    const listing = await fetchText(`${baseUrl}/organizations`);
    checkedUrls.push({ url: listing.url, status: listing.status, ok: listing.ok });

    for (const name of DEMO_ORGANIZATION_NAMES) {
      if (listing.text.includes(name)) {
        failures.push(`Demo organization name appeared on /organizations: ${name}`);
      }
    }

    const demoDetail = await fetchText(`${baseUrl}/organizations/${DEMO_ORGANIZATION_IDS[0]}`);
    checkedUrls.push({ url: demoDetail.url, status: demoDetail.status, ok: demoDetail.ok });

    if (demoDetail.ok && demoDetail.text.includes(DEMO_ORGANIZATION_NAMES[0])) {
      failures.push(`Demo organization detail route is public: ${DEMO_ORGANIZATION_IDS[0]}`);
    }
  }

  const report = {
    status: failures.length ? "failed" : "passed",
    demoModeEnabled,
    liveAuditUrl: baseUrl,
    checkedUrls,
    demoOrganizationIds: DEMO_ORGANIZATION_IDS.length,
    failures,
  };

  console.log("Production organization audit complete.");
  console.log(JSON.stringify(report, null, 2));

  if (failures.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
