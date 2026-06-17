import { NextResponse } from "next/server";

import { getCivicImportJobKeys, syncCivicImportJob, type CivicImportJobKey } from "@/lib/civic-data/import-jobs";
import { syncCivicSource } from "@/lib/civic-data/service";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request, url: URL) {
  const secret = process.env.CIVIC_IMPORT_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;

  return bearerToken === secret || url.searchParams.get("secret") === secret;
}

function isCivicImportJobKey(value: string): value is CivicImportJobKey {
  return (getCivicImportJobKeys() as string[]).includes(value);
}

async function runImport(request: Request) {
  const url = new URL(request.url);

  if (!isAuthorized(request, url)) {
    return NextResponse.json({ ok: false, error: "Unauthorized civic import request." }, { status: 401 });
  }

  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const job = String(body.job ?? url.searchParams.get("job") ?? "");
  const source = String(body.source ?? url.searchParams.get("source") ?? "");

  try {
    if (job) {
      if (!isCivicImportJobKey(job)) {
        return NextResponse.json({ ok: false, error: `Unknown civic import job: ${job}` }, { status: 400 });
      }

      const results = await syncCivicImportJob(job, "scheduled");
      return NextResponse.json({
        ok: true,
        job,
        sources: results.map((result) => ({
          sourceSlug: result.sourceSlug,
          status: result.status,
          recordsSeen: result.recordsSeen,
          recordsChanged: result.recordsChanged,
        })),
      });
    }

    if (source) {
      const result = await syncCivicSource(source, "scheduled");
      return NextResponse.json({
        ok: true,
        source,
        status: result.status,
        recordsSeen: result.recordsSeen,
        recordsChanged: result.recordsChanged,
      });
    }

    return NextResponse.json({ ok: false, error: "Provide a job or source query parameter." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown civic import error.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runImport(request);
}

export async function POST(request: Request) {
  return runImport(request);
}
