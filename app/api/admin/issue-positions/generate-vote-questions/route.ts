import { NextResponse } from "next/server";

import { generateVoteQuestionsFromApprovedIssuePositions } from "@/lib/issue-positions/store";

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

async function run(request: Request) {
  const url = new URL(request.url);

  if (!isAuthorized(request, url)) {
    return NextResponse.json({ ok: false, error: "Unauthorized issue-position vote generation request." }, { status: 401 });
  }

  try {
    const result = await generateVoteQuestionsFromApprovedIssuePositions();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown issue-position vote generation error.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
