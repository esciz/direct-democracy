import { NextResponse } from "next/server";

import { getPublicOfficials } from "@/lib/civic-data/public";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jurisdiction = url.searchParams.get("jurisdiction") ?? undefined;

  try {
    const officials = await getPublicOfficials(jurisdiction);

    return NextResponse.json({
      data: officials,
      count: officials.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        data: [],
        count: 0,
        error: error instanceof Error ? error.message : "Officials API failed.",
      },
      { status: 500 },
    );
  }
}
