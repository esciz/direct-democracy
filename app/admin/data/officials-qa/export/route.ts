import { NextResponse } from "next/server";

import {
  OFFICIALS_QA_GROUPS,
  getOfficialsQaRows,
  officialsQaRowsToCsv,
  type OfficialQaFlagKey,
} from "@/lib/civic-data/officials-qa";
import { getCurrentUser } from "@/lib/server/auth-session";

export const dynamic = "force-dynamic";

const missingFilters: OfficialQaFlagKey[] = [
  "missing_photo",
  "missing_email",
  "missing_phone",
  "missing_website",
  "missing_district",
  "missing_term_start",
  "missing_term_end",
];

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const group = url.searchParams.get("group") ?? undefined;
  const missing = url.searchParams.get("missing") as OfficialQaFlagKey | null;
  const rows = await getOfficialsQaRows({
    group: group && OFFICIALS_QA_GROUPS.includes(group) ? group : undefined,
    missing: missing && missingFilters.includes(missing) ? missing : undefined,
    sourceWarnings: url.searchParams.get("sourceWarnings") === "1",
    duplicates: url.searchParams.get("duplicates") === "1",
  });
  const csv = officialsQaRowsToCsv(rows);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"nevada-officials-qa.csv\"",
    },
  });
}

